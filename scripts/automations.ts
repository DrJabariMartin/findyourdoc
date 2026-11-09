// Runs every automation once (or one named job) from the command line:
//   npm run automations            # all jobs
//   npm run automations -- recheck-licenses
import { runJobs } from "../src/lib/automation/jobs";
import { db } from "../src/lib/db";

runJobs(process.argv[2] ?? "all")
  .then((results) => {
    for (const r of results) console.log(`${r.ok ? "ok  " : "FAIL"} ${r.job}: ${r.summary}`);
    process.exitCode = results.every((r) => r.ok) ? 0 : 1;
  })
  .finally(() => db.$disconnect());
