/**
 * Static-export build for the Android shell.
 *
 * A static export cannot host route handlers, and Next refuses to build if it
 * finds any. So the api directory is moved aside for the duration of the build
 * and put straight back afterwards, including when the build fails. Nothing
 * about the API source changes; it simply is not part of this bundle.
 *
 * The resulting app has no server, so point it at a deployed one with
 * NEXT_PUBLIC_API_BASE_URL. Without that, dialogue falls back to canned lines.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const apiDir = path.join(root, "app", "api");
const parked = path.join(root, ".api-parked");

// Copy-then-delete rather than rename: this repo can live inside a synced
// folder (OneDrive, Dropbox), where a directory rename fails with EPERM
// because the sync client holds a handle on it. Deletes get retries for the
// same reason.
const RM = { recursive: true, force: true, maxRetries: 8, retryDelay: 250 };

function restore() {
  if (!fs.existsSync(parked)) return;
  fs.cpSync(parked, apiDir, { recursive: true });
  fs.rmSync(parked, RM);
}

process.on("exit", restore);
process.on("SIGINT", () => {
  restore();
  process.exit(130);
});

try {
  if (fs.existsSync(apiDir)) {
    fs.rmSync(parked, RM);
    fs.cpSync(apiDir, parked, { recursive: true });
    fs.rmSync(apiDir, RM);
    console.log("[capacitor] api routes parked for the static export");
  }

  execFileSync(
    process.execPath,
    [path.join(root, "node_modules", "next", "dist", "bin", "next"), "build"],
    {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, BUILD_TARGET: "capacitor" },
    },
  );
} finally {
  restore();
  console.log("[capacitor] api routes restored");
}
