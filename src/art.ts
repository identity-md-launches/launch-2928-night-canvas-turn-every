import {
  activeHours,
  bestLabel,
  distance,
  formatDate,
  observed,
  work,
} from "./data.ts";
import type { Measurement, Night } from "./data.ts";

export const ART_VERSION = 1;
export const SKY = "#181423";
export const ART_COLORS = [
  "#796391",
  "#a68ac6",
  "#c1a5df",
  "#e7b8c8",
  "#e99b92",
  "#f0ae73",
  "#f5cd8a",
  "#d9dfb1",
];
export const intensity = (value: number) =>
  Math.min(1, Math.log1p(Math.max(0, value)) / Math.log1p(2500));

export function hash(text: string): number {
  let result = 2166136261;
  for (let i = 0; i < text.length; i++)
    result = Math.imul(result ^ text.charCodeAt(i), 16777619);
  return result >>> 0;
}
function random(seed: number): () => number {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function artworkName(night: Night | undefined): string {
  if (!night || !observed(night)) return "A sky still waiting";
  if (work(night) === 0) return "A quiet little orbit";
  const names = [
    "Midnight marigold",
    "Stardust in motion",
    "The apricot hour",
    "A pocket of cosmos",
    "Lavender daydream",
    "Little solar dance",
    "Orbits of amber",
    "Moonlit confetti",
    "Afterglow garden",
    "A wheel of wonder",
    "The violet hour",
    "Dreams in orbit",
  ];
  return names[
    hash(
      `${night.date}:${night.buckets.map((b) => b.workUnits ?? b.coverage).join(",")}`,
    ) % names.length
  ];
}

// Original 23 × 18 pixel sprite. No external image service or remote runtime assets.
const HAMSTER = [
  "    oooo       oooo    ",
  "   oddddo     oddddo   ",
  "   odppdooooooodppdo   ",
  "   odddddddddddddddo   ",
  "  odddddddddddddddddo  ",
  " oddddddddddddddddddo ",
  " oddddffdddddddffdddo ",
  " oddeeffdddddddffeedo ",
  " oddpeeeddddddeeepddo ",
  " odddwwwwwnwwwwwdddo ",
  "  oddwwwwwwwwwwwddo  ",
  "   oddwwwwwwwwwddo   ",
  "    oddwwwwwwwddo    ",
  "   odddwwwwwwwdddo   ",
  "  odddddwwwwwdddddo  ",
  "  oooooodddd oooooo  ",
  "   pppp      pppp    ",
];
const SPRITE_COLORS: Record<string, string> = {
  o: "#593c3c",
  d: "#e3aa72",
  p: "#e6a3a0",
  f: "#2b2131",
  e: "#f1c28d",
  w: "#ffdfac",
  n: "#bc6b79",
};
export function paintHamster(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  running = false,
) {
  HAMSTER.forEach((row, j) =>
    [...row].forEach((cell, i) => {
      if (!SPRITE_COLORS[cell]) return;
      ctx.fillStyle = SPRITE_COLORS[cell];
      ctx.fillRect(
        x + i * scale + (running && j > 14 ? scale : 0),
        y + j * scale,
        scale,
        scale,
      );
    }),
  );
  ctx.fillStyle = "#ffedc8";
  ctx.fillRect(x + 7 * scale, y + 6 * scale, scale, scale);
  ctx.fillRect(x + 15 * scale, y + 6 * scale, scale, scale);
}

function pixelMoon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1,
) {
  const shape = [
    "   xxxx ",
    " xxxxxx ",
    "xxxxxx  ",
    "xxxxx   ",
    "xxxxx   ",
    "xxxxxx  ",
    " xxxxxx ",
    "   xxxx ",
  ];
  ctx.fillStyle = "#edce98";
  shape.forEach((row, j) =>
    [...row].forEach((cell, i) => {
      if (cell === "x")
        ctx.fillRect(x + i * scale, y + j * scale, scale, scale);
    }),
  );
}

export function paintScene(
  ctx: CanvasRenderingContext2D,
  night: Night | undefined,
  date: string,
  live?: Measurement | null,
) {
  const W = 480,
    H = 270;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, W, H);
  const rng = random(hash(date));
  // Fixed stars identify each date; neither time nor Math.random changes a saved artwork.
  for (let i = 0; i < 95; i++) {
    const x = Math.floor(rng() * W),
      y = Math.floor(rng() * 228);
    const size = rng() > 0.92 ? 2 : 1;
    ctx.fillStyle =
      i % 4 === 0 ? "#bca1aa" : i % 3 === 0 ? "#7d6b92" : "#493b5c";
    ctx.fillRect(x, y, size, size);
    if (size === 2 && i % 3 === 0) {
      ctx.fillRect(x - 2, y + 1, 6, 1);
      ctx.fillRect(x + 1, y - 2, 1, 6);
    }
  }
  pixelMoon(ctx, 411, 28, 2);
  ctx.fillStyle = "#262033";
  for (let x = 0; x < W; x += 12) {
    const height = 15 + Math.floor(rng() * 20);
    ctx.fillRect(x, H - height, 12, height);
  }
  ctx.fillStyle = "#33283e";
  ctx.fillRect(0, 256, W, 14);
  ctx.fillStyle = "#46334a";
  for (let x = 0; x < W; x += 4) {
    if (rng() > 0.7) ctx.fillRect(x, 255, 2, 2);
  }

  const cx = 240,
    cy = 128,
    maxR = 100;
  const buckets = night?.buckets ?? [];
  const anyReadings = observed(night);
  const rotate = hash(date + ":palette") % 3;
  for (let slice = 0; slice < 48; slice++) {
    const b = buckets.find((b) => b.startMinuteUtc === slice * 30);
    const value =
      b?.workUnits === null || b?.workUnits === undefined
        ? null
        : Number(b.workUnits);
    const power = value === null ? -1 : intensity(value);
    const angle = (slice / 48) * Math.PI * 2 - Math.PI / 2;
    for (let ring = 0; ring < 14; ring++) {
      const r = 25 + ring * 5.5;
      const pieces = Math.max(1, Math.round((r * Math.PI * 2) / 48 / 3));
      for (let piece = 0; piece < pieces; piece++) {
        const a = angle + (((piece + 0.5) / pieces) * Math.PI * 2) / 48;
        let color =
          b?.coverage === "future"
            ? "#282232"
            : value === null
              ? "#302837"
              : "#51405f";
        const filled = power > 0 && ring < 2 + Math.round(power * 11);
        if (filled)
          color = ART_COLORS[Math.min(7, Math.floor(ring / 2) + rotate)];
        else if (power === 0 && ring % 4 !== 0) continue;
        else if (power < 0 && (ring % 4 !== 0 || slice % 2 !== 0)) continue;
        ctx.fillStyle = color;
        const size = filled ? 3 : 2;
        ctx.fillRect(
          Math.round(cx + Math.cos(a) * r),
          Math.round(cy + Math.sin(a) * r),
          size,
          size,
        );
      }
    }
  }
  // Clock marks: midnight at the top; noon at the bottom. The data day starts at noon.
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 - Math.PI / 2;
    ctx.fillStyle = i % 12 === 0 ? "#b69cbf" : "#5d4769";
    ctx.fillRect(
      Math.round(cx + Math.cos(a) * (maxR + 9)),
      Math.round(cy + Math.sin(a) * (maxR + 9)),
      i % 12 === 0 ? 3 : 1,
      3,
    );
  }
  ctx.fillStyle = "#282031";
  ctx.fillRect(cx - 12, cy - 10, 25, 22);
  ctx.fillStyle = anyReadings ? "#b49bc7" : "#584762";
  ctx.fillRect(cx - 3, cy - 3, 8, 8);
  ctx.fillStyle = "#f2c795";
  ctx.fillRect(cx - 1, cy - 1, 4, 4);

  // A clearly provisional current-speed accent, never written into the historical buckets.
  const running = live?.coreStatus === "ACTIVE" && live.freshness === "online";
  if (
    running &&
    live.rpmMilli !== null &&
    live.rpmMilli > 0 &&
    live.receivedAt
  ) {
    const at = new Date(live.receivedAt);
    const minute = at.getUTCHours() * 60 + at.getUTCMinutes();
    const a = (Math.floor(minute / 30) / 48) * Math.PI * 2 - Math.PI / 2;
    const count = Math.min(14, Math.max(1, Math.ceil(live.rpmMilli / 10_000)));
    ctx.fillStyle = "#ffdc9c";
    for (let j = 0; j < count; j++)
      ctx.fillRect(
        Math.round(cx + Math.cos(a) * (25 + j * 5.5)),
        Math.round(cy + Math.sin(a) * (25 + j * 5.5)),
        3,
        3,
      );
    if (live.distanceMm !== null) {
      const ink = random(hash(`live:${live.distanceMm}`));
      for (let j = 0; j < 4; j++) {
        const r = 35 + Math.floor(ink() * 65),
          offset = (ink() - 0.5) * 0.1;
        ctx.fillRect(
          Math.round(cx + Math.cos(a + offset) * r),
          Math.round(cy + Math.sin(a + offset) * r),
          2,
          2,
        );
      }
    }
  }
  // The artist sits under the wheel, leaving the data visible.
  ctx.fillStyle = "#110f1a";
  ctx.fillRect(cx - 33, 248, 69, 4);
  paintHamster(ctx, cx - 22, 211, 2, running);
  // Pixel flowers, a small signature detail along the horizon.
  for (const x of [37, 79, 390, 442]) {
    ctx.fillStyle = "#71806b";
    ctx.fillRect(x, 249, 2, 8);
    ctx.fillStyle = "#bf8c9e";
    ctx.fillRect(x - 2, 246, 6, 3);
    ctx.fillStyle = "#f3c88a";
    ctx.fillRect(x, 245, 2, 2);
  }
}

export async function downloadArtwork(night: Night): Promise<void> {
  if (!observed(night))
    throw new Error("There are no readings to export for this night.");
  await document.fonts.ready;
  const scene = document.createElement("canvas");
  scene.width = 480;
  scene.height = 270;
  const sceneContext = scene.getContext("2d");
  if (!sceneContext)
    throw new Error(
      "This browser cannot create an artwork. Try another browser.",
    );
  paintScene(sceneContext, night, night.date);
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 675;
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new Error(
      "This browser cannot create an artwork. Try another browser.",
    );
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, 1200, 675);
  ctx.fillStyle = "#33283e";
  ctx.fillRect(0, 522, 1200, 43);
  // Reserve a caption band without cutting off the artist or distorting the circular wheel.
  ctx.drawImage(scene, 120, 12, 960, 540);
  ctx.fillStyle = "#f9e4cc";
  ctx.font = '24px "Silkscreen", sans-serif';
  ctx.fillText("Night Canvas", 38, 48);
  ctx.font = '20px "DM Sans", sans-serif';
  ctx.fillStyle = "#d0bdce";
  ctx.fillText(`${formatDate(night.date, true)} · noon to noon UTC`, 38, 82);
  ctx.fillStyle = "#201a2a";
  ctx.fillRect(0, 565, 1200, 110);
  ctx.fillStyle = "#f9e4cc";
  ctx.font = '24px "Silkscreen", sans-serif';
  ctx.fillText(artworkName(night), 38, 603);
  ctx.font = '20px "DM Sans", sans-serif';
  ctx.fillStyle = "#d0bdce";
  ctx.fillText(
    `${distance(night.distanceMm)}  ·  Active windows: ${activeHours(night)}  ·  Best half-hour: ${bestLabel(night)}${bestLabel(night).includes("–") ? " UTC" : ""}`,
    38,
    642,
  );
  ctx.textAlign = "right";
  ctx.fillStyle = "#f5cd8a";
  ctx.fillText("squeekchain.com", 1162, 603);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(new Error("The PNG could not be created. Try again.")),
      "image/png",
    ),
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `night-canvas-${night.date}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
