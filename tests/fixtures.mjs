// Synthetic API shapes for validation only. These are never imported by the website.
export const TEST_TIME = "2026-11-03T18:00:00.000Z";
export function statusFixture(overrides = {}) {
  return {
    schemaVersion: 1,
    generatedAt: TEST_TIME,
    measurement: {
      coreStatus: "ACTIVE",
      freshness: "online",
      receivedAt: TEST_TIME,
      observedAt: TEST_TIME,
      staleAfterSeconds: 120,
      rpmMilli: 76500,
      speedMmPerSecond: 1100,
      distanceMm: 3456000,
      provenance: "hardware",
      ...overrides,
    },
  };
}
export function statsFixture() {
  return {
    schemaVersion: 1,
    generatedAt: TEST_TIME,
    range: "30d",
    timezone: "UTC",
    activity: {
      days: Array.from({ length: 30 }, (_, i) => {
        const date = new Date(Date.parse("2026-11-03T12:00:00Z") - i * 86400000)
          .toISOString()
          .slice(0, 10);
        const known = i < 6;
        return {
          date,
          distanceMm: known ? String(i * 1200000) : null,
          coverage: { coverageBps: known ? 10000 : 0 },
          buckets: Array.from({ length: 48 }, (_, j) => ({
            startMinuteUtc: j * 30,
            coverage: known ? "complete" : "missing",
            observedRoundCount: known ? 3 : 0,
            workUnits: known
              ? String(i > 0 && (j < 6 || j > 40) ? 200 + i * 80 + j * 10 : 0)
              : null,
          })),
        };
      }),
      typicalDay: Array.from({ length: 48 }, (_, j) => ({
        startMinuteUtc: j * 30,
        meanWorkMilli: j === 8 ? null : String(j * 20000),
        observedDayCount: j === 8 ? 0 : 6,
      })),
    },
    records: {
      maximumDailyDistanceMm: {
        value: "6000000",
        occurredAt: "2026-10-29T12:00:00Z",
        coverage: "complete",
      },
      longestActiveDayStreak: {
        value: "5",
        occurredAt: "2026-10-29T12:00:00Z",
        coverage: "partial",
      },
    },
    blocks: {
      status: "unavailable",
      reason: "completion_boundaries_unavailable",
    },
  };
}
