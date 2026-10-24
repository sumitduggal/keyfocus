// Re-encodes the audio in public/music and public/sounds to smaller MP3s before the build.
// Files already at or below the target bitrate are skipped, and a file is only replaced when the
// new one is smaller. Needs ffmpeg and ffprobe on the PATH; without them it warns and does nothing.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const TARGETS = [
  { dir: "public/music", bitrate: 128, channels: 2 },
  { dir: "public/sounds", bitrate: 96, channels: 1 },
];
const dryRun = process.argv.includes("--dry-run");

function hasTool(name) {
  try {
    execFileSync(name, ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function bitrateOf(file) {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=bit_rate", "-of", "csv=p=0", file],
    { encoding: "utf8" },
  ).trim();
  const bits = Number(out);
  return Number.isFinite(bits) && bits > 0 ? bits / 1000 : null;
}

function reencode({ file, bitrate, channels }) {
  const temp = `${file}.tmp.mp3`;
  execFileSync(
    "ffmpeg",
    ["-v", "error", "-y", "-i", file, "-vn", "-ac", String(channels), "-b:a", `${bitrate}k`, "-codec:a", "libmp3lame", temp],
    { stdio: "inherit" },
  );
  return temp;
}

if (!hasTool("ffmpeg") || !hasTool("ffprobe")) {
  console.warn("optimise-audio: ffmpeg/ffprobe not found, skipping audio optimisation.");
  process.exit(0);
}

let saved = 0;
for (const { dir, bitrate, channels } of TARGETS) {
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".mp3"))) {
    const file = join(dir, name);
    const current = bitrateOf(file);
    if (current !== null && current <= bitrate * 1.05) continue;
    if (dryRun) {
      console.log(`would re-encode ${file} (${current?.toFixed(0) ?? "?"} kbps -> ${bitrate} kbps)`);
      continue;
    }
    const before = statSync(file).size;
    const temp = reencode({ file, bitrate, channels });
    const after = statSync(temp).size;
    if (after < before) {
      renameSync(temp, file);
      saved += before - after;
      console.log(`optimised ${file}: ${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(1)} MB`);
    } else {
      rmSync(temp);
      console.log(`kept ${file}: re-encoding did not make it smaller`);
    }
  }
}
if (!dryRun) console.log(`optimise-audio: saved ${(saved / 1e6).toFixed(1)} MB`);
