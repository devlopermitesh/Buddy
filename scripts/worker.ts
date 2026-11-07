import { processDuePublishJobs } from "../lib/publishing";

let stopping = false;

async function tick() {
  try {
    const processed = await processDuePublishJobs(20);
    if (processed > 0) {
      console.log(`[worker] processed ${processed} job(s)`);
    }
  } catch (error) {
    console.error("[worker] tick failed:", error);
  }
}

async function main() {
  console.log("[worker] SocialFlow publish worker started (polling every 30s).");
  while (!stopping) {
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 30_000));
  }
  console.log("[worker] stopped.");
  process.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
  });
}

main();
