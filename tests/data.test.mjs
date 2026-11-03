import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  activeHours,
  bestBucket,
  distance,
  liveState,
  nightDate,
  observed,
  parseStats,
  parseStatus,
  retryDelay,
  timeLabel,
} from "../src/data.ts";
import { artworkName, paintScene } from "../src/art.ts";
import { statsFixture, statusFixture, TEST_TIME } from "./fixtures.mjs";

test("published schemaVersion 1 is accepted; unknown versions are rejected", () => {
  assert.equal(parseStats(statsFixture()).days.length, 30);
  assert.throws(
    () => parseStats({ ...statsFixture(), schemaVersion: 2 }),
    /version/,
  );
  assert.throws(
    () => parseStatus({ ...statusFixture(), schemaVersion: "1" }),
    /version/,
  );
});
test("unavailable statistics are an error, never an empty collection", () => {
  assert.throws(
    () => parseStats({ schemaVersion: 1, status: "unavailable" }),
    /unavailable/,
  );
});
test("millimetres, thousandths of RPM, and positive zero retain their meaning", () => {
  assert.equal(distance("3456000"), "3.46 km");
  assert.equal(distance(0), "0.00 km");
  assert.equal(parseStatus(statusFixture()).measurement.rpmMilli, 76500);
});
test("missing values, strings in numeric status fields, and unavailable distance are unknown", () => {
  assert.equal(distance(undefined), "Unknown");
  assert.equal(distance(null), "Unknown");
  assert.equal(
    parseStatus(statusFixture({ speedMmPerSecond: "0", distanceMm: undefined }))
      .measurement.speedMmPerSecond,
    null,
  );
  assert.equal(
    parseStatus(statusFixture({ distanceMm: undefined })).measurement
      .distanceMm,
    null,
  );
});
test("ACTIVE and IDLE map to running and resting only with fresh telemetry", () => {
  const now = Date.parse(TEST_TIME);
  assert.equal(liveState(parseStatus(statusFixture()), false, now), "RUNNING");
  assert.equal(
    liveState(parseStatus(statusFixture({ coreStatus: "IDLE" })), false, now),
    "RESTING",
  );
});
test("fault, stale, missing measurement, expired receipt and fetch failure mean signal lost", () => {
  const now = Date.parse(TEST_TIME);
  for (const overrides of [
    { coreStatus: "COUNTER_FAULT" },
    { freshness: "stale" },
    { coreStatus: undefined },
    { receivedAt: "2026-11-03T17:50:00Z" },
  ])
    assert.equal(
      liveState(parseStatus(statusFixture(overrides)), false, now),
      "SIGNAL LOST",
    );
  assert.equal(
    liveState(
      parseStatus({
        schemaVersion: 1,
        generatedAt: TEST_TIME,
        measurement: null,
      }),
      false,
      now,
    ),
    "SIGNAL LOST",
  );
  assert.equal(
    liveState(parseStatus(statusFixture()), true, now),
    "SIGNAL LOST",
  );
});
test("the artwork date rolls over at noon UTC, not midnight", () => {
  assert.equal(nightDate(new Date("2026-11-03T11:59:59Z")), "2026-11-02");
  assert.equal(nightDate(new Date("2026-11-03T12:00:00Z")), "2026-11-03");
});
test("a half-hour must appear exactly once in all 48 slots", () => {
  const data = statsFixture();
  data.activity.days[0].buckets[1].startMinuteUtc = 0;
  assert.throws(() => parseStats(data), /half-hour/);
  const short = statsFixture();
  short.activity.days[0].buckets.pop();
  assert.throws(() => parseStats(short), /half-hour/);
});
test("duplicate dates and duplicate typical-day slots reject malformed data", () => {
  const data = statsFixture();
  data.activity.days[1].date = data.activity.days[0].date;
  assert.throws(() => parseStats(data), /duplicate nights/);
  const typical = statsFixture();
  typical.activity.typicalDay[1].startMinuteUtc = 0;
  assert.throws(() => parseStats(typical), /typical-day/);
});
test("impossible dates, wrong ranges, and empty malformed histories are rejected", () => {
  const badDate = statsFixture();
  badDate.activity.days[0].date = "2026-02-31";
  assert.throws(() => parseStats(badDate), /invalid date/);
  const wrongRange = statsFixture();
  wrongRange.range = "7d";
  assert.throws(() => parseStats(wrongRange), /incomplete/);
  const empty = statsFixture();
  empty.activity.days = [];
  assert.throws(() => parseStats(empty), /incomplete/);
});
test("missing and future coverage cannot turn into recorded zeros", () => {
  const data = statsFixture();
  data.activity.days[0].buckets[0] = {
    startMinuteUtc: 0,
    coverage: "future",
    workUnits: "0",
  };
  assert.equal(parseStats(data).days[0].buckets[0].workUnits, null);
  assert.equal(observed(parseStats(data).days[7]), false);
  assert.equal(activeHours(parseStats(data).days[7]), "Unknown");
  assert.equal(activeHours(parseStats(data).days[0]), "0 h");
});
test("active hours describe observed active half-hour windows and best bucket uses the actual maximum", () => {
  const data = parseStats(statsFixture());
  assert.equal(activeHours(data.days[1]), "6.5 h");
  assert.equal(bestBucket(data.days[1]).startMinuteUtc, 1410);
  assert.equal(timeLabel(1440), "00:00");
});
test("blocks and records stay unknown when unavailable; typical slots with no observed days are unknown", () => {
  const data = parseStats(statsFixture());
  assert.equal(data.blocks, null);
  assert.equal(data.typicalDay[8].meanWorkMilli, null);
  assert.equal(data.bestNight.value, "6000000");
  assert.equal(data.longestStreak.coverage, "partial");
});
test("Retry-After accepts seconds and HTTP dates, with a conservative fallback", () => {
  const now = Date.parse(TEST_TIME);
  assert.equal(retryDelay("45", now), 45000);
  assert.equal(retryDelay("Tue, 03 Nov 2026 18:01:00 GMT", now), 60000);
  assert.equal(retryDelay(null, now), 60000);
  assert.equal(retryDelay("0", now), 1000);
});

function painting(night, live) {
  const commands = [];
  const ctx = {
    fillStyle: "",
    imageSmoothingEnabled: false,
    fillRect(...args) {
      commands.push([this.fillStyle, ...args]);
    },
  };
  paintScene(ctx, night, night.date, live);
  return createHash("sha256").update(JSON.stringify(commands)).digest("hex");
}
test("saved artwork and name are deterministic for the same date and all 48 readings", () => {
  const night = parseStats(statsFixture()).days[1];
  assert.equal(painting(night), painting(structuredClone(night)));
  assert.equal(artworkName(night), artworkName(structuredClone(night)));
});
test("different bucket work produces different pixels; input arrays are never mutated", () => {
  const night = parseStats(statsFixture()).days[1];
  const original = structuredClone(night);
  const changed = structuredClone(night);
  changed.buckets[0].workUnits = "0";
  assert.notEqual(painting(night), painting(changed));
  assert.deepEqual(night, original);
});
test("quiet readings, missing readings, and different dates have distinct art", () => {
  const nights = parseStats(statsFixture()).days;
  assert.notEqual(painting(nights[0]), painting(nights[7]));
  assert.notEqual(
    painting(nights[1]),
    painting({ ...nights[1], date: "2026-11-01" }),
  );
});
test("provisional current-speed accents change the live canvas without changing saved art", () => {
  const night = parseStats(statsFixture()).days[0];
  const live = parseStatus(statusFixture()).measurement;
  const saved = painting(night);
  assert.notEqual(saved, painting(night, live));
  assert.equal(saved, painting(night));
});
test("the live canvas paints new pixels as measured distance increases at a steady RPM", () => {
  const night = parseStats(statsFixture()).days[0];
  const live = parseStatus(statusFixture()).measurement;
  assert.notEqual(
    painting(night, live),
    painting(night, { ...live, distanceMm: live.distanceMm + 15000 }),
  );
});
