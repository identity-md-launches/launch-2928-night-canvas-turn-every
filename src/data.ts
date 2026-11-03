export const API = "https://api.squeekchain.com/v1";
export const STATUS_INTERVAL = 15_000;
export const STATS_INTERVAL = 300_000;

export type Coverage = "complete" | "partial" | "missing" | "future";
export interface Bucket {
  startMinuteUtc: number;
  coverage: Coverage;
  workUnits: string | null;
}
export interface Night {
  date: string;
  distanceMm: string | null;
  buckets: Bucket[];
  coverageBps: number | null;
}
export interface TypicalBucket {
  startMinuteUtc: number;
  meanWorkMilli: string | null;
  observedDayCount: number | null;
}
export interface RecordValue {
  value: string;
  occurredAt: string;
  coverage: "complete" | "partial";
}
export interface Stats {
  generatedAt: string;
  days: Night[];
  typicalDay: TypicalBucket[];
  bestNight: RecordValue | null;
  longestStreak: RecordValue | null;
  blocks: string | null;
}
export interface Measurement {
  coreStatus: "IDLE" | "ACTIVE" | "COUNTER_FAULT" | null;
  freshness: string | null;
  receivedAt: string | null;
  staleAfterSeconds: number;
  rpmMilli: number | null;
  speedMmPerSecond: number | null;
  distanceMm: number | null;
  provenance: string | null;
}
export interface Status {
  measurement: Measurement | null;
  generatedAt: string;
}

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Obj)
    : {};
const number = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
const decimal = (value: unknown): string | null =>
  typeof value === "string" &&
  /^\d+$/.test(value) &&
  Number.isFinite(Number(value))
    ? value
    : null;
const dateTime = (value: unknown): string | null =>
  typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;

function version(value: unknown): Obj {
  const root = object(value);
  if (root.schemaVersion !== 1)
    throw new Error(
      "This data version is not supported. Check the API documentation for updates.",
    );
  if (root.status === "unavailable")
    throw new Error(
      "Readings are temporarily unavailable. Retrying automatically.",
    );
  return root;
}

function record(value: unknown): RecordValue | null {
  const r = object(value);
  const amount = decimal(r.value);
  const at = dateTime(r.occurredAt);
  return amount !== null &&
    at &&
    (r.coverage === "complete" || r.coverage === "partial")
    ? { value: amount, occurredAt: at, coverage: r.coverage }
    : null;
}

export function parseStats(value: unknown): Stats {
  const root = version(value);
  const activity = object(root.activity);
  if (
    root.range !== "30d" ||
    root.timezone !== "UTC" ||
    !Array.isArray(activity.days) ||
    activity.days.length === 0 ||
    activity.days.length > 30 ||
    !Array.isArray(activity.typicalDay) ||
    activity.typicalDay.length !== 48
  )
    throw new Error(
      "The night readings are incomplete. Retrying automatically.",
    );
  const days: Night[] = activity.days.map((value) => {
    const day = object(value);
    const date = day.date;
    if (
      typeof date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !dateTime(date) ||
      new Date(date).toISOString().slice(0, 10) !== date ||
      !Array.isArray(day.buckets) ||
      day.buckets.length !== 48
    )
      throw new Error(
        "A night has an invalid date or half-hour readings. Retrying automatically.",
      );
    const seen = new Set<number>();
    const buckets: Bucket[] = day.buckets.map((value) => {
      const b = object(value);
      const minute = number(b.startMinuteUtc);
      if (
        minute === null ||
        minute > 1410 ||
        minute % 30 !== 0 ||
        seen.has(minute) ||
        !["complete", "partial", "missing", "future"].includes(
          String(b.coverage),
        )
      )
        throw new Error(
          "The half-hour readings could not be understood. Retrying automatically.",
        );
      seen.add(minute);
      const coverage = b.coverage as Coverage;
      return {
        startMinuteUtc: minute,
        coverage,
        workUnits:
          coverage === "missing" || coverage === "future"
            ? null
            : decimal(b.workUnits),
      };
    });
    return {
      date,
      buckets: buckets.sort((a, b) => a.startMinuteUtc - b.startMinuteUtc),
      distanceMm: decimal(day.distanceMm),
      coverageBps: number(object(day.coverage).coverageBps),
    };
  });
  if (new Set(days.map((d) => d.date)).size !== days.length)
    throw new Error(
      "The API returned duplicate nights. Retrying automatically.",
    );
  const seen = new Set<number>();
  const typicalDay = activity.typicalDay.map((value): TypicalBucket => {
    const b = object(value);
    const minute = number(b.startMinuteUtc);
    if (
      minute === null ||
      minute > 1410 ||
      minute % 30 !== 0 ||
      seen.has(minute)
    )
      throw new Error(
        "The typical-day readings could not be understood. Retrying automatically.",
      );
    seen.add(minute);
    const count = number(b.observedDayCount);
    return {
      startMinuteUtc: minute,
      meanWorkMilli: count === 0 ? null : decimal(b.meanWorkMilli),
      observedDayCount: count,
    };
  });
  const records = object(root.records);
  const blocks = object(root.blocks);
  const generatedAt = dateTime(root.generatedAt);
  if (!generatedAt)
    throw new Error(
      "The readings have no valid timestamp. Retrying automatically.",
    );
  return {
    generatedAt,
    days: days.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30),
    typicalDay,
    bestNight: record(records.maximumDailyDistanceMm),
    longestStreak: record(records.longestActiveDayStreak),
    blocks:
      blocks.status === "available" ? decimal(blocks.completedInRange) : null,
  };
}

export function parseStatus(value: unknown): Status {
  const root = version(value);
  const generatedAt = dateTime(root.generatedAt);
  if (!generatedAt)
    throw new Error(
      "The live signal has no valid timestamp. Retrying automatically.",
    );
  if (!root.measurement || object(root.measurement).status === "unavailable")
    return { generatedAt, measurement: null };
  const m = object(root.measurement);
  return {
    generatedAt,
    measurement: {
      coreStatus: ["IDLE", "ACTIVE", "COUNTER_FAULT"].includes(
        String(m.coreStatus),
      )
        ? (m.coreStatus as Measurement["coreStatus"])
        : null,
      freshness: typeof m.freshness === "string" ? m.freshness : null,
      receivedAt: dateTime(m.receivedAt),
      staleAfterSeconds: number(m.staleAfterSeconds) ?? 120,
      rpmMilli: number(m.rpmMilli),
      speedMmPerSecond: number(m.speedMmPerSecond),
      distanceMm: number(m.distanceMm),
      provenance: typeof m.provenance === "string" ? m.provenance : null,
    },
  };
}

export type LiveState = "RUNNING" | "RESTING" | "SIGNAL LOST";
export function liveState(
  status: Status | null,
  failed: boolean,
  now = Date.now(),
): LiveState {
  const m = status?.measurement;
  if (
    failed ||
    !m ||
    !m.receivedAt ||
    m.freshness !== "online" ||
    now - Date.parse(m.receivedAt) > m.staleAfterSeconds * 1000 ||
    !m.coreStatus ||
    m.coreStatus === "COUNTER_FAULT"
  )
    return "SIGNAL LOST";
  return m.coreStatus === "ACTIVE" ? "RUNNING" : "RESTING";
}

export function nightDate(now = new Date()): string {
  return new Date(now.getTime() - 12 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}
export function formatDate(date: string, long = false): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: long ? "long" : "short",
    year: long ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
}
export function timeLabel(minute: number): string {
  return `${String(Math.floor((minute % 1440) / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
export function distance(value: string | number | null | undefined): string {
  return value === null || value === undefined
    ? "Unknown"
    : `${(Number(value) / 1_000_000).toFixed(2)} km`;
}
export function observed(night: Night | undefined): boolean {
  return !!night?.buckets.some((b) => b.workUnits !== null);
}
export function work(night: Night): number {
  return night.buckets.reduce(
    (sum, b) => sum + (b.workUnits === null ? 0 : Number(b.workUnits)),
    0,
  );
}
export function activeHours(night: Night | undefined): string {
  if (!observed(night)) return "Unknown";
  const count = night!.buckets.filter(
    (b) => b.workUnits !== null && Number(b.workUnits) > 0,
  ).length;
  return `${(count / 2).toLocaleString("en-GB", { maximumFractionDigits: 1 })} h`;
}
export function bestBucket(night: Night | undefined): Bucket | null {
  if (!night) return null;
  return (
    night.buckets
      .filter((b) => b.workUnits !== null && Number(b.workUnits) > 0)
      .sort(
        (a, b) =>
          Number(b.workUnits) - Number(a.workUnits) ||
          a.startMinuteUtc - b.startMinuteUtc,
      )[0] ?? null
  );
}
export function bestLabel(night: Night | undefined): string {
  const bucket = bestBucket(night);
  return bucket
    ? `${timeLabel(bucket.startMinuteUtc)}–${timeLabel(bucket.startMinuteUtc + 30)}`
    : observed(night)
      ? "No activity observed"
      : "Unknown";
}
export function retryDelay(value: string | null, now = Date.now()): number {
  if (value !== null && /^\d+(\.\d+)?$/.test(value.trim()))
    return Math.max(1000, Number(value) * 1000);
  if (value && !Number.isNaN(Date.parse(value)))
    return Math.max(1000, Date.parse(value) - now);
  return 60_000;
}
