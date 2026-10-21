const assert = require("node:assert/strict");
const test = require("node:test");
const { createDigestProcessor } = require("../src/processor");

function createHarness() {
  const states = [];
  const deadLetterJobs = [];
  const processor = createDigestProcessor({
    appendActivityLog: async (_jobId, state) => states.push(state),
    deadLetterQueue: {
      add: async (...args) => deadLetterJobs.push(args)
    },
    deadLetterQueueName: "nightly-digest-dead-letter",
    processingDelayMs: 0,
    wait: async () => {}
  });

  return { deadLetterJobs, processor, states };
}

test("successful jobs record pending-independent processing transitions", async () => {
  const { processor, states } = createHarness();
  const result = await processor({
    id: "job-1",
    name: "nightly_digest",
    data: { jobId: "job-1", simulate_failure: false }
  });

  assert.deepEqual(states, ["started", "success"]);
  assert.deepEqual(result, { state: "success" });
});

test("injected failures record failed and dead-letter states, enqueue the DLQ job, and throw", async () => {
  const { deadLetterJobs, processor, states } = createHarness();
  await assert.rejects(processor({
    id: "job-2",
    name: "nightly_digest",
    data: { jobId: "job-2", simulate_failure: true }
  }), /Injected failure requested/);

  assert.deepEqual(states, ["started", "failed", "dead_letter"]);
  assert.equal(deadLetterJobs.length, 1);
  assert.equal(deadLetterJobs[0][2].jobId, "dlq-job-2");
  assert.equal(deadLetterJobs[0][1].original_job_id, "job-2");
});
