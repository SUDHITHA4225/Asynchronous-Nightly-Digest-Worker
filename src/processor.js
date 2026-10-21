function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createDigestProcessor({
  appendActivityLog,
  deadLetterQueue,
  deadLetterQueueName,
  processingDelayMs,
  wait = delay
}) {
  async function moveToDeadLetter(job, message) {
    await deadLetterQueue.add(
      job.name,
      { ...job.data, original_job_id: job.id, failure_message: message },
      { jobId: `dlq-${job.id}`, removeOnComplete: false }
    );
    await appendActivityLog(job.data.jobId, "dead_letter", `Moved to ${deadLetterQueueName}`);
  }

  return async function processDigest(job) {
    const { jobId, simulate_failure: simulateFailure } = job.data;
    await appendActivityLog(jobId, "started", "Nightly digest processing started");

    try {
      await wait(processingDelayMs);
      if (simulateFailure) {
        throw new Error("Injected failure requested for this job");
      }
    } catch (error) {
      await appendActivityLog(jobId, "failed", error.message);
      await moveToDeadLetter(job, error.message);
      throw error;
    }

    await appendActivityLog(jobId, "success", "Nightly digest processing completed");
    return { state: "success" };
  };
}

module.exports = { createDigestProcessor };
