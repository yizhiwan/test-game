/**
 * Captures portfolio media: still screenshots of every screen, plus a short
 * gameplay clip.
 *
 * Drives the locally installed Chrome rather than a downloaded Chromium, so
 * there is no browser payload to fetch. Point it at a production server
 * (`npm run start`) rather than the dev server, otherwise the Next.js dev
 * badge lands in the corner of every shot.
 *
 *   node scripts/capture.mjs [baseUrl]
 *
 * Output goes to docs/screenshots and docs/media.
 */

import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.argv[2] ?? "http://localhost:3100";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const shotDir = path.join(root, "docs", "screenshots");
const mediaDir = path.join(root, "docs", "media");

fs.mkdirSync(shotDir, { recursive: true });
fs.mkdirSync(mediaDir, { recursive: true });

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  const file = path.join(shotDir, `${name}.png`);
  await page.screenshot({ path: file });
  console.log("  saved", path.relative(root, file));
}

/** Clears persisted state so every run starts from a clean case file. */
async function resetState(page) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
}

/** Walks the case far enough to reach every screen worth showing. */
async function captureStills(browser) {
  const context = await browser.newContext({
    viewport: DESKTOP,
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  const page = await context.newPage();

  await resetState(page);
  await page.goto(BASE, { waitUntil: "networkidle" });
  await wait(3500); // let the briefing finish typing
  await shot(page, "01-title");

  await page.click('button[aria-label*="Initiate"]');
  await page.waitForURL("**/room/lab404", { timeout: 15000 });
  await wait(1200);
  await shot(page, "02-room");

  // The vent is bolted until the workbench has been searched.
  await page.click('button[aria-label="Examine Air Vent"]');
  await wait(1400);
  await shot(page, "03-locked-vent");
  await page.click('button[aria-label="Close examination"]');
  await wait(600);

  await page.click('button[aria-label="Examine Workbench"]');
  await wait(2600);
  await shot(page, "04-evidence-found");
  await page.click('button[aria-label="Close examination"]');
  await wait(600);

  await page.click('button[aria-label="Examine Air Vent"]');
  await wait(2600);
  await page.click('button[aria-label="Close examination"]');
  await wait(600);

  await page.click('button[aria-label="Open evidence inventory"]');
  await wait(900);
  await shot(page, "05-inventory");
  await page.click('button[aria-label="Close inventory"]');
  await wait(600);

  await page.click('button[aria-label*="Interrogate Dr. Aris"]');
  await page.waitForURL("**/dialogue/aris", { timeout: 15000 });
  await wait(1200);
  await shot(page, "06-dialogue-empty");

  await page.fill('textarea[aria-label="Your question"]', "Where were you at 09:40 PM?");
  await page.click('button[aria-label="Send question"]');
  await wait(3500);
  await shot(page, "07-dialogue-reply");

  await page.click('button[aria-label="Present evidence to this suspect"]');
  await wait(900);
  await page.click('button:has-text("Encrypted Drive")');
  await wait(700);
  await shot(page, "08-present-evidence");

  await page.click('button[aria-label="Confirm and present this evidence"]');
  await wait(5000);
  await shot(page, "09-alibi-broken");

  await page.goto(`${BASE}/terminal`, { waitUntil: "networkidle" });
  await wait(1200);
  await shot(page, "10-terminal");

  // File the accusation with both required exhibits in hand.
  await page.click('button[role="tab"]:has-text("File Accusation")');
  await wait(500);
  await page.selectOption("#suspect", "aris");
  await wait(400);
  await page.click('button[aria-label="Submit accusation"]');
  await page.waitForURL("**/ending/**", { timeout: 15000 });
  await wait(1600);
  await shot(page, "11-ending-case-closed");

  await page.goto(`${BASE}/ending/lose_time`, { waitUntil: "networkidle" });
  await wait(1400);
  await shot(page, "12-ending-cleanup");

  await context.close();

  // Mobile portrait, to show the stacked interrogation layout.
  const mobile = await browser.newContext({
    viewport: MOBILE,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const mPage = await mobile.newPage();
  await resetState(mPage);
  await mPage.goto(BASE, { waitUntil: "networkidle" });
  await wait(3200);
  await shot(mPage, "13-mobile-title");
  await mPage.click('button[aria-label*="Initiate"]');
  await mPage.waitForURL("**/room/lab404", { timeout: 15000 });
  await wait(1200);
  await shot(mPage, "14-mobile-room");
  await mPage.click('button[aria-label*="Interrogate Dr. Aris"]');
  await mPage.waitForURL("**/dialogue/aris", { timeout: 15000 });
  await wait(1200);
  await shot(mPage, "15-mobile-dialogue");
  await mobile.close();
}

/** A short continuous run, recorded to video. */
async function captureClip(browser) {
  const context = await browser.newContext({
    viewport: DESKTOP,
    recordVideo: { dir: mediaDir, size: DESKTOP },
  });
  const page = await context.newPage();

  await resetState(page);
  await page.goto(BASE, { waitUntil: "networkidle" });
  await wait(3000);

  await page.click('button[aria-label*="Initiate"]');
  await page.waitForURL("**/room/lab404", { timeout: 15000 });
  await wait(1500);

  await page.click('button[aria-label="Examine Workbench"]');
  await wait(3200);
  await page.click('button[aria-label="Close examination"]');
  await wait(800);

  await page.click('button[aria-label="Examine Air Vent"]');
  await wait(3200);
  await page.click('button[aria-label="Close examination"]');
  await wait(800);

  await page.click('button[aria-label*="Interrogate Dr. Aris"]');
  await page.waitForURL("**/dialogue/aris", { timeout: 15000 });
  await wait(1200);

  await page.fill('textarea[aria-label="Your question"]', "Where were you at 09:40 PM?");
  await wait(600);
  await page.click('button[aria-label="Send question"]');
  await wait(3500);

  await page.click('button[aria-label="Present evidence to this suspect"]');
  await wait(1000);
  await page.click('button:has-text("Encrypted Drive")');
  await wait(800);
  await page.click('button[aria-label="Confirm and present this evidence"]');
  await wait(5000);

  const video = page.video();
  await context.close(); // the file is only finalized on close

  if (video) {
    const src = await video.path();
    const dest = path.join(mediaDir, "gameplay.webm");
    fs.rmSync(dest, { force: true });
    fs.renameSync(src, dest);
    console.log("  saved", path.relative(root, dest));
  }
}

/**
 * Playwright records WebM, which no social platform accepts. Re-encode to MP4
 * for embedding and a short GIF for READMEs, which cannot embed video at all.
 * Skipped with a note when ffmpeg is not installed; the WebM is still written.
 */
function transcode() {
  const webm = path.join(mediaDir, "gameplay.webm");
  if (!fs.existsSync(webm)) return;

  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    console.log("  ffmpeg not on PATH, skipping mp4/gif (webm is still there)");
    return;
  }

  const mp4 = path.join(mediaDir, "gameplay.mp4");
  execFileSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", "-i", webm,
     "-c:v", "libx264", "-preset", "slow", "-crf", "23",
     "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", mp4],
    { stdio: "inherit" },
  );
  console.log("  saved", path.relative(root, mp4));

  // Ten seconds from the payoff, small enough to load in a README.
  const gif = path.join(mediaDir, "gameplay.gif");
  execFileSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", "-ss", "17.5", "-t", "10", "-i", webm,
     "-vf",
     "fps=9,scale=640:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4",
     "-loop", "0", gif],
    { stdio: "inherit" },
  );
  console.log("  saved", path.relative(root, gif));
}

const browser = await chromium.launch({ channel: "chrome" });
try {
  console.log("Capturing stills...");
  await captureStills(browser);
  console.log("Recording gameplay clip...");
  await captureClip(browser);
  console.log("Transcoding...");
  transcode();
  console.log("Done.");
} finally {
  await browser.close();
}
