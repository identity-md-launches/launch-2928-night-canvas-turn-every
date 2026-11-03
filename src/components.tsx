import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { paintHamster, paintScene } from "./art";
import type { Measurement, Night } from "./data";
import { formatDate } from "./data";
import type { Resource } from "./useResource";

type IconName =
  | "arrow"
  | "external"
  | "sun"
  | "moon"
  | "download"
  | "back"
  | "grid"
  | "clock"
  | "distance"
  | "spark"
  | "trophy"
  | "heart"
  | "x"
  | "refresh"
  | "signal";
const paths: Record<IconName, ReactNode> = {
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  external: (
    <>
      <path d="M13 5h6v6M19 5l-9 9" />
      <path d="M9 5H5v14h14v-4" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
    </>
  ),
  moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />,
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
    </>
  ),
  back: <path d="M20 12H5m6-6-6 6 6 6" />,
  grid: (
    <>
      <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  distance: (
    <>
      <path d="M3 16c2-5 5-5 8-2s6 3 10-5M3 20h18" />
      <circle cx="5" cy="6" r="2" />
    </>
  ),
  spark: (
    <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />
  ),
  trophy: (
    <>
      <path d="M7 3h10v8a5 5 0 0 1-10 0V3ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 16v5m-5 0h10" />
    </>
  ),
  heart: (
    <path d="M12 21 3.7 13A5.5 5.5 0 0 1 12 5.8 5.5 5.5 0 0 1 20.3 13L12 21Z" />
  ),
  x: <path d="m4 3 16 18h-5L4 3h5l11 18M20 3 4 21" />,
  refresh: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M5.3 7a8 8 0 0 1 13-1L20 8M4 16l1.7 2a8 8 0 0 0 13-1" />
    </>
  ),
  signal: (
    <>
      <path d="M4 18v2m5-7v7m5-12v12m5-17v17" />
    </>
  ),
};
export function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      className={`icon ${className}`}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function MoonLogo() {
  return (
    <svg
      className="moon-logo"
      viewBox="0 0 32 32"
      width="32"
      height="32"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M9 3h11v3h-5v4h-3v11h4v4h8v3H12v-3H8v-4H5V10h4z"
      />
      <path className="logo-star" d="M25 4h3v3h3v3h-3v3h-3v-3h-3V7h3z" />
    </svg>
  );
}
export function Hamster({ large = false }: { large?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) paintHamster(ctx, 0, 0, 3);
  }, []);
  return (
    <canvas
      ref={ref}
      width="69"
      height="54"
      className={`hamster ${large ? "hamster-large" : ""}`}
      role="img"
      aria-label="Squeektoshi, a tiny golden pixel hamster"
    />
  );
}
export function Artwork({
  night,
  date,
  live,
  className = "",
}: {
  night?: Night;
  date: string;
  live?: Measurement | null;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) paintScene(ctx, night, date, live);
  }, [night, date, live]);
  const count = night?.buckets.filter(
    (b) => b.workUnits !== null && Number(b.workUnits) > 0,
  ).length;
  const readingCount =
    night?.buckets.filter((b) => b.workUnits !== null).length ?? 0;
  return (
    <canvas
      ref={ref}
      className={`artwork ${className}`}
      width="480"
      height="270"
      role="img"
      aria-label={`Pixel wheel for ${formatDate(date, true)}. ${readingCount === 0 ? "No readings available." : `${count} active half-hours among ${readingCount} recorded readings.`} Each slice is a half-hour; brighter colors and more rings show more work.`}
    />
  );
}
export function ErrorNotice<T>({
  resource,
  label,
}: {
  resource: Resource<T>;
  label: string;
}) {
  if (!resource.error) return <div role="status" className="sr-only" />;
  const waiting = resource.retryAt > Date.now();
  return (
    <div className="error-notice" role="status">
      <Icon name="signal" />
      <div>
        <strong>{label}</strong>
        <p>
          {resource.error}{" "}
          {waiting &&
            `Next attempt after ${new Date(resource.retryAt).toLocaleTimeString("en-GB", { timeZone: "UTC" })} UTC.`}
        </p>
        {resource.data && <p>Showing the last successful readings.</p>}
      </div>
      <button
        className="button button-small"
        type="button"
        disabled={resource.loading || waiting}
        onClick={resource.retry}
      >
        <Icon name="refresh" />
        Retry
      </button>
    </div>
  );
}
export function Stat({
  label,
  value,
  icon,
  note,
}: {
  label: string;
  value: ReactNode;
  icon?: IconName;
  note?: string;
}) {
  return (
    <div className="stat">
      <dt>
        {icon && <Icon name={icon} />}
        {label}
      </dt>
      <dd>
        {value}
        {note && <span className="stat-note">{note}</span>}
      </dd>
    </div>
  );
}
export function Legend({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`legend ${compact ? "legend-compact" : ""}`}
      aria-label="Activity color legend"
    >
      <span>Quiet</span>
      <div className="legend-colors" aria-hidden="true">
        {["#51405f", "#a68ac6", "#e7b8c8", "#e99b92", "#f5cd8a"].map((c) => (
          <i key={c} style={{ backgroundColor: c }} />
        ))}
      </div>
      <span>Busy</span>
      {!compact && (
        <>
          <i className="missing-swatch" aria-hidden="true" />
          <span>No reading</span>
        </>
      )}
    </div>
  );
}
