import { useEffect, useMemo, useRef, useState } from "react";
import { artworkName, ART_COLORS, downloadArtwork, intensity } from "./art";
import {
  Artwork,
  ErrorNotice,
  Hamster,
  Icon,
  Legend,
  MoonLogo,
  Stat,
} from "./components";
import {
  activeHours,
  API,
  bestBucket,
  bestLabel,
  distance,
  formatDate,
  liveState,
  nightDate,
  observed,
  parseStats,
  parseStatus,
  STATUS_INTERVAL,
  STATS_INTERVAL,
  timeLabel,
  work,
} from "./data";
import type { Night, Stats, TypicalBucket } from "./data";
import { useResource } from "./useResource";

function initialTheme(): "dark" | "light" {
  try {
    return localStorage.getItem("night-canvas-theme") === "light"
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}
function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function App() {
  const [hash, setHash] = useState(window.location.hash);
  const [theme, setTheme] = useState(initialTheme);
  const now = useNow();
  const stats = useResource(
    `${API}/measurement/stats?range=30d`,
    parseStats,
    STATS_INTERVAL,
  );
  const status = useResource(`${API}/status`, parseStatus, STATUS_INTERVAL);
  const route = /^#\/art\/(\d{4}-\d{2}-\d{2})$/.exec(hash);
  const routeDate = route?.[1];
  const detailDate =
    routeDate &&
    !Number.isNaN(Date.parse(routeDate)) &&
    new Date(routeDate).toISOString().slice(0, 10) === routeDate
      ? routeDate
      : undefined;
  const invalidRoute = hash.startsWith("#/") && !detailDate;
  const currentDate = nightDate(new Date(now));
  const currentNight = stats.data?.days.find((d) => d.date === currentDate);
  const state = liveState(status.data, !!status.error, now);
  const m = state !== "SIGNAL LOST" ? status.data?.measurement : null;

  useEffect(() => {
    const change = () => setHash(window.location.hash);
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#17141f" : "#faf5ec");
    try {
      localStorage.setItem("night-canvas-theme", theme);
    } catch {
      /* A theme still works when storage is unavailable. */
    }
  }, [theme]);
  useEffect(() => {
    document.title = detailDate
      ? `${formatDate(detailDate, true)} · Night Canvas`
      : "Night Canvas · Tiny paws. Big art.";
    const frame = requestAnimationFrame(() => {
      if (detailDate || invalidRoute) {
        window.scrollTo(0, 0);
        document.getElementById("page-heading")?.focus({ preventScroll: true });
      } else if (
        ["#tonight", "#gallery", "#records", "#about"].includes(hash)
      ) {
        const section = document.getElementById(hash.slice(1));
        section?.scrollIntoView({ behavior: "auto", block: "start" });
        section?.querySelector("h2")?.focus({ preventScroll: true });
      } else window.scrollTo(0, 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [hash, detailDate, invalidRoute]);

  const activeSection = detailDate ? "gallery" : hash.slice(1) || "tonight";
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          const main = document.getElementById("main");
          main?.focus();
          main?.scrollIntoView({ block: "start" });
        }}
      >
        Skip to content
      </a>
      <header className="site-header shell">
        <a className="brand" href="#" aria-label="Night Canvas home">
          <MoonLogo />
          <span>
            Night Canvas<span className="brand-dot">.</span>
          </span>
        </a>
        <nav className="primary-nav" aria-label="Main navigation">
          {["Tonight", "Gallery", "Records", "About"].map((label) => (
            <a
              key={label}
              href={`#${label.toLowerCase()}`}
              aria-current={
                activeSection === label.toLowerCase() ? "location" : undefined
              }
            >
              {label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          className="theme-button"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} />
        </button>
      </header>

      <main id="main" className="shell" tabIndex={-1}>
        {detailDate ? (
          <ArtworkPage
            date={detailDate}
            night={stats.data?.days.find((d) => d.date === detailDate)}
            loading={stats.loading && !stats.data}
            statsError={stats.error}
            stats={stats.data}
          />
        ) : invalidRoute ? (
          <div className="route-empty">
            <h1 id="page-heading" tabIndex={-1}>
              This sky isn’t here
            </h1>
            <p>Choose a night from the gallery to find its artwork.</p>
            <a className="button button-primary" href="#gallery">
              Explore the gallery <Icon name="arrow" />
            </a>
          </div>
        ) : (
          <>
            <section className="intro" aria-labelledby="page-heading">
              <div>
                <h1 id="page-heading">
                  Tiny paws. <span>Big art.</span>
                </h1>
                <p>Squeektoshi’s nightly runs, turned into pixel art.</p>
              </div>
              <div className="artist-note">
                <Hamster />
                <span>
                  A little wheelwork.
                  <br />A new world every night.
                </span>
                <svg
                  viewBox="0 0 60 40"
                  className="note-arrow"
                  aria-hidden="true"
                >
                  <path
                    d="M5 4c20 0 4 29 38 24m-8-9 11 9-12 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
            </section>

            <section
              id="tonight"
              className="tonight-section"
              aria-labelledby="tonight-heading"
            >
              <div className="section-heading tonight-heading">
                <h2 id="tonight-heading" tabIndex={-1}>
                  <Icon name="moon" />
                  Tonight
                </h2>
                <span className="live-caption">
                  <span
                    className={`signal-dot ${state === "SIGNAL LOST" ? "signal-lost" : ""}`}
                  />
                  {status.loading && !status.data
                    ? "Connecting to the wheel"
                    : "Updates every 15 seconds"}
                </span>
              </div>
              <div className="tonight-panel">
                <a
                  className="tonight-art"
                  href={`#/art/${currentDate}`}
                  aria-label={`Open tonight’s artwork for ${formatDate(currentDate, true)}`}
                >
                  <Artwork night={currentNight} date={currentDate} live={m} />
                  <div className="art-topline">
                    <span>{formatDate(currentDate, true)}</span>
                    <span>
                      <Icon name="spark" />
                      {observed(currentNight)
                        ? "Made of wheelwork"
                        : stats.loading
                          ? "Reading the stars"
                          : "Waiting for readings"}
                    </span>
                  </div>
                  <div className="art-bottomline">
                    <span>{artworkName(currentNight)}</span>
                    <span className="art-open">
                      <Icon name="external" />
                    </span>
                  </div>
                </a>
                <div className="live-info">
                  <div className="live-state-row">
                    <span
                      className={`state-badge state-${state.replace(" ", "-").toLowerCase()}`}
                      role="status"
                    >
                      <span className="signal-dot" />
                      {status.loading && !status.data ? "CONNECTING" : state}
                    </span>
                    <span className="info-date">Noon to noon UTC</span>
                  </div>
                  <h3>
                    {status.loading && !status.data
                      ? "Finding our little artist…"
                      : state === "RUNNING"
                        ? "The artist is at work."
                        : state === "RESTING"
                          ? "A well-earned breather."
                          : "A pause in the signal."}
                  </h3>
                  <p className="live-description">
                    {state === "RUNNING"
                      ? "One small step after another. Watch tonight’s canvas find its colors."
                      : state === "RESTING"
                        ? "The wheel is quiet for now. More colors will come when he feels like running."
                        : "The wheel’s state is unknown. The canvas will catch up when fresh readings return."}
                  </p>
                  <dl className="live-stats">
                    <Stat
                      label="Distance today"
                      icon="distance"
                      value={distance(m?.distanceMm)}
                    />
                    <Stat
                      label="Speed"
                      icon="signal"
                      value={
                        m?.speedMmPerSecond === null ||
                        m?.speedMmPerSecond === undefined ? (
                          "Unknown"
                        ) : (
                          <>
                            {(m.speedMmPerSecond / 1000).toFixed(2)}{" "}
                            <span className="metric-unit">m/s</span>
                          </>
                        )
                      }
                    />
                    <Stat
                      label="Wheel speed"
                      icon="refresh"
                      value={
                        m?.rpmMilli === null || m?.rpmMilli === undefined ? (
                          "Unknown"
                        ) : (
                          <>
                            {(m.rpmMilli / 1000).toFixed(1)}{" "}
                            <span className="metric-unit">rpm</span>
                          </>
                        )
                      }
                    />
                    <Stat
                      label="Active hours*"
                      icon="clock"
                      value={activeHours(currentNight)}
                    />
                  </dl>
                  <a
                    className="button button-primary"
                    href={`#/art/${currentDate}`}
                  >
                    View tonight’s artwork <Icon name="arrow" />
                  </a>
                  <p className="live-footnote">
                    {m?.provenance && m.provenance !== "hardware"
                      ? `Source: ${m.provenance} telemetry. `
                      : ""}
                    *From observed active half-hours.
                  </p>
                </div>
              </div>
              <ErrorNotice resource={status} label="Live signal unavailable" />
              <div className="canvas-caption">
                <span>
                  <Icon name="grid" />
                  48 slices. One little night.
                </span>
                <Legend compact />
              </div>
            </section>

            <Gallery
              stats={stats.data}
              loading={stats.loading && !stats.data}
            />
            <ErrorNotice resource={stats} label="Night history unavailable" />
            <Records stats={stats.data} />
            <About />
          </>
        )}
      </main>
      <footer className="site-footer shell">
        <a className="footer-brand" href="#">
          <MoonLogo />
          <span>Night Canvas</span>
        </a>
        <p>Unofficial community art project</p>
        <a href="https://squeekchain.com" target="_blank" rel="noreferrer">
          Meet Squeekchain <Icon name="external" />
        </a>
      </footer>
    </>
  );
}

function Gallery({
  stats,
  loading,
}: {
  stats: Stats | null;
  loading: boolean;
}) {
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [limit, setLimit] = useState(6);
  const nights = useMemo(() => {
    const filtered =
      stats?.days.filter((d) =>
        filter === "active"
          ? observed(d) && work(d) > 0
          : filter === "quiet"
            ? observed(d) && work(d) === 0
            : true,
      ) ?? [];
    return sort === "active"
      ? filtered.sort(
          (a, b) =>
            Number(observed(b)) - Number(observed(a)) ||
            work(b) - work(a) ||
            b.date.localeCompare(a.date),
        )
      : filtered;
  }, [stats, filter, sort]);
  return (
    <section
      id="gallery"
      className="gallery-section section-space"
      aria-labelledby="gallery-heading"
    >
      <div className="section-heading">
        <div>
          <h2 id="gallery-heading" tabIndex={-1}>
            The nightly collection
            <span className="heading-star" aria-hidden="true">
              ✦
            </span>
          </h2>
          <p>Every run leaves a different kind of magic.</p>
        </div>
        <span className="period-label">The last 30 days</span>
      </div>
      <div className="gallery-toolbar">
        <div className="filter-group" aria-label="Filter nights">
          {[
            ["all", "All nights"],
            ["active", "With activity"],
            ["quiet", "Quiet nights"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
                setLimit(6);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="sort-control">
          <span className="sr-only">Sort nights</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="active">Most active first</option>
          </select>
        </label>
      </div>
      <p className="sr-only" role="status">
        {loading
          ? "Loading nightly artworks."
          : !stats
            ? "Night readings are unavailable."
            : `${nights.length} nights match this filter.`}
      </p>
      {loading ? (
        <div className="gallery-loading">
          <span className="pixel-loader" aria-hidden="true" />
          <p>Gathering little constellations…</p>
        </div>
      ) : !stats ? (
        <div className="empty-state">
          <Icon name="moon" />
          <h3>The collection is waiting</h3>
          <p>
            Nightly artworks will appear when the public readings are available.
            Retry below or explore how the art is made.
          </p>
          <a href="#about" className="text-link">
            How the canvas works <Icon name="arrow" />
          </a>
        </div>
      ) : nights.length === 0 ? (
        <div className="empty-state">
          <h3>
            No {filter === "quiet" ? "quiet" : "active"} nights in this window
          </h3>
          <p>Try all nights to see every available date.</p>
          <button className="button" onClick={() => setFilter("all")}>
            Show all nights
          </button>
        </div>
      ) : (
        <>
          <ul className="gallery-grid">
            {nights.slice(0, limit).map((night) => (
              <li key={night.date}>
                <NightCard night={night} />
              </li>
            ))}
          </ul>
          <div className="gallery-bottom">
            <p>
              {Math.min(limit, nights.length)} of {nights.length} nights
              <span> · Dates start at noon UTC</span>
            </p>
            {nights.length > limit && (
              <button
                className="button"
                onClick={() => setLimit(nights.length)}
              >
                Show all {nights.length} nights <Icon name="arrow" />
              </button>
            )}
            {limit > 6 && (
              <button
                className="button"
                onClick={() => {
                  setLimit(6);
                  document
                    .getElementById("gallery")
                    ?.scrollIntoView({ block: "start" });
                }}
              >
                Show fewer nights
              </button>
            )}
          </div>
        </>
      )}
      <p className="collection-note">
        *Active hours estimate time windows with observed work, not exact
        running time. Unrecorded half-hours stay unknown.
      </p>
    </section>
  );
}

function NightCard({ night }: { night: Night }) {
  const known = observed(night);
  return (
    <a className="night-card" href={`#/art/${night.date}`}>
      <div className="card-art">
        <Artwork night={night} date={night.date} />
        {!known && <span className="no-readings">No readings</span>}
        <span className="card-open">
          <Icon name="arrow" />
        </span>
      </div>
      <div className="card-info">
        <div className="card-heading">
          <h3>{formatDate(night.date)}</h3>
          <span className="card-title">{artworkName(night)}</span>
        </div>
        <dl className="card-stats">
          <div>
            <dt>Distance</dt>
            <dd>{distance(night.distanceMm)}</dd>
          </div>
          <div>
            <dt>Active hours*</dt>
            <dd>{activeHours(night)}</dd>
          </div>
        </dl>
        <div className="card-best">
          <span>Best half-hour</span>
          <span>
            {bestLabel(night)}
            {bestBucket(night) && " UTC"}
          </span>
        </div>
      </div>
    </a>
  );
}

function Records({ stats }: { stats: Stats | null }) {
  const best = stats?.bestNight;
  const streak = stats?.longestStreak;
  return (
    <section
      id="records"
      className="records-section section-space"
      aria-labelledby="records-heading"
    >
      <div className="section-heading">
        <div>
          <h2 id="records-heading" tabIndex={-1}>
            Small hamster, big nights.
          </h2>
          <p>A few moments worth keeping.</p>
        </div>
        <Icon name="trophy" />
      </div>
      <div className="records-grid">
        <div className="record">
          <Icon name="distance" />
          <h3>Best night</h3>
          <p className="record-value">{distance(best?.value)}</p>
          <p>
            {best ? (
              <>
                {formatDate(best.occurredAt, true)} · by distance
                {best.coverage === "partial" && " · partial record"}
              </>
            ) : (
              "Waiting for a recorded distance"
            )}
          </p>
        </div>
        <div className="record">
          <Icon name="spark" />
          <h3>Longest streak</h3>
          <p className="record-value">
            {streak ? (
              <>
                {Number(streak.value).toLocaleString()} <span>nights</span>
              </>
            ) : (
              "Unknown"
            )}
          </p>
          <p>
            {streak ? (
              <>
                From {formatDate(streak.occurredAt)}
                {streak.coverage === "partial" && " · partial record"}
              </>
            ) : (
              "Waiting for observed active days"
            )}
          </p>
        </div>
        <div className="record">
          <Icon name="grid" />
          <h3>Squeek blocks</h3>
          <p className="record-value">
            {stats?.blocks !== null && stats?.blocks !== undefined
              ? Number(stats.blocks).toLocaleString()
              : "Unknown"}
          </p>
          <p>
            {stats?.blocks !== null && stats?.blocks !== undefined
              ? "Completed in this 30-day window"
              : "Block history is not available"}
          </p>
        </div>
      </div>
      <Heatmap slots={stats?.typicalDay} />
    </section>
  );
}

function Heatmap({ slots }: { slots?: TypicalBucket[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const sorted = useMemo(
    () =>
      slots
        ? [...slots].sort(
            (a, b) =>
              ((a.startMinuteUtc + 720) % 1440) -
              ((b.startMinuteUtc + 720) % 1440),
          )
        : [],
    [slots],
  );
  const slotText = (b: TypicalBucket) =>
    `${timeLabel(b.startMinuteUtc)}–${timeLabel(b.startMinuteUtc + 30)} UTC: ${b.meanWorkMilli === null ? "unknown activity" : `${(Number(b.meanWorkMilli) / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })} mean work units`}${b.observedDayCount === null ? "" : ` across ${b.observedDayCount} observed nights`}.`;
  return (
    <div className="typical-day">
      <div className="heatmap-heading">
        <div>
          <h3>A typical day in his paws</h3>
          <p>Average activity in each half-hour, from noon to noon UTC.</p>
        </div>
        <Legend compact />
      </div>
      <div className="heatmap" aria-label="Typical-day half-hour activity">
        {sorted.length
          ? sorted.map((b) => (
              <button
                key={b.startMinuteUtc}
                className={`heat-cell ${b.meanWorkMilli === null ? "heat-unknown" : ""}`}
                type="button"
                aria-label={slotText(b)}
                title={slotText(b)}
                aria-pressed={selected === b.startMinuteUtc}
                onClick={() => setSelected(b.startMinuteUtc)}
                style={{
                  backgroundColor:
                    b.meanWorkMilli === null
                      ? undefined
                      : Number(b.meanWorkMilli) === 0
                        ? "#51405f"
                        : ART_COLORS[
                            Math.min(
                              7,
                              Math.floor(
                                intensity(Number(b.meanWorkMilli) / 1000) * 7,
                              ),
                            )
                          ],
                }}
              />
            ))
          : Array.from({ length: 48 }, (_, i) => (
              <span key={i} className="heat-cell heat-unknown" />
            ))}
      </div>
      <p className="heatmap-times">
        12:00 UTC onward · Left to right, row by row
      </p>
      <p className="heatmap-selection" role="status">
        {selected !== null && sorted.find((b) => b.startMinuteUtc === selected)
          ? slotText(sorted.find((b) => b.startMinuteUtc === selected)!)
          : sorted.length
            ? "Select a square to explore that half-hour."
            : "Typical-day activity is unknown until readings arrive."}
      </p>
      {sorted.length > 0 && (
        <details className="data-details">
          <summary>View half-hour data</summary>
          <div className="table-wrap">
            <table>
              <caption>
                Average observed work by half-hour. Missing observations are
                excluded.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Time (UTC)</th>
                  <th scope="col">Mean work units</th>
                  <th scope="col">Observed nights</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((b) => (
                  <tr key={b.startMinuteUtc}>
                    <th scope="row">{timeLabel(b.startMinuteUtc)}</th>
                    <td>
                      {b.meanWorkMilli === null
                        ? "Unknown"
                        : (Number(b.meanWorkMilli) / 1000).toLocaleString(
                            "en-GB",
                            { maximumFractionDigits: 1 },
                          )}
                    </td>
                    <td>{b.observedDayCount ?? "Unknown"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

function About() {
  return (
    <section
      id="about"
      className="about-section section-space"
      aria-labelledby="about-heading"
    >
      <div className="about-copy">
        <h2 id="about-heading" tabIndex={-1}>
          A wheel becomes a world.
        </h2>
        <p>
          Squeektoshi runs on the WHEELY9000. His wheelwork powers Squeekchain,
          a hamster-powered proof-of-work toychain on Ethereum. Night Canvas
          turns those public readings into something you can keep.
        </p>
        <ol className="how-list">
          <li>
            <span className="step-number">01</span>
            <div>
              <h3>Time makes the shape</h3>
              <p>
                48 slices form a wheel. Each is one half-hour, with midnight at
                the top. A night runs from noon to noon UTC.
              </p>
            </div>
          </li>
          <li>
            <span className="step-number">02</span>
            <div>
              <h3>Movement makes the color</h3>
              <p>
                More observed work adds brighter colors and more pixel rings.
                Quiet nights stay soft. Missing readings leave gaps; they never
                count as rest.
              </p>
            </div>
          </li>
          <li>
            <span className="step-number">03</span>
            <div>
              <h3>The night leaves a signature</h3>
              <p>
                The date sets the stars and palette. The same 48 readings always
                make the same saved artwork. Live golden accents follow the
                wheel’s speed and distance.
              </p>
            </div>
          </li>
        </ol>
        <div className="about-links">
          <a
            className="text-link"
            href="https://squeekchain.com"
            target="_blank"
            rel="noreferrer"
          >
            Squeekchain <Icon name="external" />
          </a>
          <a
            className="text-link"
            href="https://docs.squeekchain.com/developers/api/"
            target="_blank"
            rel="noreferrer"
          >
            Explore the public data <Icon name="external" />
          </a>
        </div>
      </div>
      <aside className="welfare-note">
        <div className="hamster-portrait">
          <Hamster large />
          <span className="portrait-star star-one" aria-hidden="true">
            ✦
          </span>
          <span className="portrait-star star-two" aria-hidden="true">
            ✧
          </span>
        </div>
        <h3>The artist sets the pace.</h3>
        <p>
          Squeektoshi only runs when he chooses to. Rest is part of the picture,
          too.
        </p>
        <span className="welfare-signature">
          <Icon name="heart" />
          Little paws, no pressure.
        </span>
      </aside>
    </section>
  );
}

function ArtworkPage({
  date,
  night,
  loading,
  statsError,
  stats,
}: {
  date: string;
  night?: Night;
  loading: boolean;
  statsError: string | null;
  stats: Stats | null;
}) {
  const [download, setDownload] = useState<"idle" | "loading" | "success">(
    "idle",
  );
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    setDownload("idle");
    setError("");
    heading.current?.focus({ preventScroll: true });
  }, [date]);
  const save = async () => {
    if (!night) return;
    setDownload("loading");
    setError("");
    try {
      await downloadArtwork(night);
      setDownload("success");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to create this PNG. Try again.",
      );
      setDownload("idle");
    }
  };
  const shareUrl = new URL(window.location.href);
  shareUrl.hash = `/art/${date}`;
  const text = night
    ? `${artworkName(night)} · ${formatDate(date, true)}. ${distance(night.distanceMm)} of tiny paws, turned into pixel art. Meet Squeektoshi’s Night Canvas.`
    : `A little wheelwork, a new world. Night Canvas · ${formatDate(date, true)}.`;
  const share = `https://twitter.com/intent/tweet?${new URLSearchParams({ text, url: shareUrl.href })}`;
  const best = bestBucket(night);
  return (
    <article className="artwork-page">
      <a href="#gallery" className="back-link">
        <Icon name="back" />
        Back to the collection
      </a>
      <div className="artwork-page-heading">
        <div>
          <h1 id="page-heading" ref={heading} tabIndex={-1}>
            {artworkName(night)}
          </h1>
          <p>{formatDate(date, true)} · Noon to noon UTC</p>
        </div>
        <Icon name="spark" />
      </div>
      <div className="artwork-large">
        <Artwork night={night} date={date} />
        {!observed(night) && (
          <div className="artwork-unavailable">
            <span>
              {loading
                ? "Gathering the night’s readings…"
                : "No recorded artwork for this night"}
            </span>
          </div>
        )}
      </div>
      <div className="artwork-actions">
        <Legend />
        <div className="action-buttons">
          <button
            className="button button-primary"
            type="button"
            disabled={!observed(night) || download === "loading"}
            onClick={() => {
              void save();
            }}
          >
            <Icon name="download" />
            {download === "loading" ? "Creating PNG…" : "Download PNG"}
          </button>
          <a
            className="button"
            href={share}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="x" />
            Share on X
          </a>
        </div>
      </div>
      <div className="download-feedback" role="status">
        {error ||
          (download === "success"
            ? "Your 1200 × 675 PNG is ready. Check your downloads."
            : "")}
      </div>
      {!night && !loading && (
        <div className="error-notice">
          <Icon name="moon" />
          <p>
            {statsError
              ? "The public readings could not be loaded. Return to Tonight to retry."
              : "This date has no readings in the current 30-day window. Choose another night from the collection."}
          </p>
          <a className="button button-small" href="#gallery">
            Explore nights
          </a>
        </div>
      )}
      <dl className="artwork-stats">
        <Stat
          icon="distance"
          label="Distance"
          value={distance(night?.distanceMm)}
        />
        <Stat icon="clock" label="Active hours*" value={activeHours(night)} />
        <Stat
          icon="spark"
          label="Best half-hour"
          value={
            best
              ? `${timeLabel(best.startMinuteUtc)}–${timeLabel(best.startMinuteUtc + 30)}`
              : observed(night)
                ? "No activity"
                : "Unknown"
          }
          note={
            best
              ? `${Number(best.workUnits).toLocaleString()} work units · UTC`
              : undefined
          }
        />
        <Stat
          icon="grid"
          label="Readings recorded"
          value={
            night
              ? `${night.buckets.filter((b) => b.workUnits !== null).length} / 48`
              : "Unknown"
          }
        />
      </dl>
      <div className="artwork-explanation">
        <p>
          *Active hours count half-hours with any observed work × 0.5. They
          describe active windows, not exact running time. Missing and future
          half-hours are not counted as rest. The current night’s saved artwork
          may change as new readings arrive.
        </p>
        <p>
          PNG exports use the recorded half-hour data, without provisional live
          accents.{" "}
          {stats &&
            `Readings generated ${new Date(stats.generatedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC.`}
        </p>
      </div>
      {night && (
        <details className="data-details night-data">
          <summary>Explore the 48 half-hours</summary>
          <div className="table-wrap">
            <table>
              <caption>
                Observed work for {formatDate(date, true)}, in noon-to-noon
                order.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Time (UTC)</th>
                  <th scope="col">Work units</th>
                  <th scope="col">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {[...night.buckets]
                  .sort(
                    (a, b) =>
                      ((a.startMinuteUtc + 720) % 1440) -
                      ((b.startMinuteUtc + 720) % 1440),
                  )
                  .map((b) => (
                    <tr key={b.startMinuteUtc}>
                      <th scope="row">
                        {timeLabel(b.startMinuteUtc)}–
                        {timeLabel(b.startMinuteUtc + 30)}
                      </th>
                      <td>
                        {b.workUnits === null
                          ? "Unknown"
                          : Number(b.workUnits).toLocaleString()}
                      </td>
                      <td>{b.coverage}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <div className="artwork-note">
        <Icon name="heart" />
        <p>
          Made at Squeektoshi’s own pace. Squeektoshi only runs when he chooses
          to.
        </p>
        <a className="text-link" href="#about">
          How it’s made <Icon name="arrow" />
        </a>
      </div>
    </article>
  );
}
