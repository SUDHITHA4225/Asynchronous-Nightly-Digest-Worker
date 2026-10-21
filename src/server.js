const express = require("express");
const { getJobLogs, jobExists, pool, runMigrations } = require("./db");
const { digestQueue, deadLetterQueue } = require("./queue");
const { enqueueNightlyDigest } = require("./enqueue");
const { port } = require("./config");

const app = express();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
app.use(express.json());

app.get("/health", async (_request, response, next) => {
  try {
    await pool.query("SELECT 1");
    await digestQueue.getJobCounts("waiting");
    response.status(200).json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

app.post("/api/jobs/trigger", async (request, response, next) => {
  const { type, simulate_failure: simulateFailure = false } = request.body || {};
  if (type !== "nightly_digest" || typeof simulateFailure !== "boolean") {
    return response.status(400).json({
      error: "Request must include type 'nightly_digest' and an optional boolean simulate_failure"
    });
  }

  try {
    const jobId = await enqueueNightlyDigest(simulateFailure);
    return response.status(202).json({
      job_id: jobId,
      message: "Nightly digest job accepted"
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/jobs/:job_id/logs", async (request, response, next) => {
  const { job_id: jobId } = request.params;
  if (!UUID_PATTERN.test(jobId)) {
    return response.status(404).json({ error: "Job not found" });
  }

  try {
    if (!(await jobExists(jobId))) {
      return response.status(404).json({ error: "Job not found" });
    }

    const logs = await getJobLogs(jobId);
    return response.status(200).json({
      job_id: jobId,
      current_state: logs.length ? logs[logs.length - 1].state : null,
      logs: logs.map((log) => ({
        state: log.state,
        message: log.message,
        created_at: log.created_at.toISOString()
      }))
    });
  } catch (error) {
    return next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error("API request failed:", error);
  response.status(500).json({ error: "Internal server error" });
});

async function start() {
  await runMigrations();
  const server = app.listen(port, () => {
    console.log(`API listening on port ${port}`);
  });

  const shutdown = async () => {
    server.close();
    await Promise.all([digestQueue.close(), deadLetterQueue.close(), pool.end()]);
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

start().catch((error) => {
  console.error("API startup failed:", error);
  process.exitCode = 1;
});
