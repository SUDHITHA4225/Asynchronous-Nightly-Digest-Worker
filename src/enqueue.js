const { randomUUID } = require("node:crypto");
const { appendActivityLog, createJob } = require("./db");
const { digestQueue } = require("./queue");

async function enqueueNightlyDigest(simulateFailure = false) {
  const jobId = randomUUID();
  const payload = { simulate_failure: simulateFailure };
  await createJob(jobId, payload);

  try {
    await digestQueue.add(
      "nightly_digest",
      { jobId, ...payload },
      { jobId, attempts: 1, removeOnComplete: true, removeOnFail: false }
    );
  } catch (error) {
    await appendActivityLog(jobId, "failed", `Queue submission failed: ${error.message}`);
    throw error;
  }

  return jobId;
}

module.exports = { enqueueNightlyDigest };
