const cron = require("node-cron");
const { Worker } = require("bullmq");
const { createServer } = require("node:http");
const { appendActivityLog, pool } = require("./db");
const {
  processingDelayMs,
  redisConnectionOptions,
  scheduleCron,
  scheduleTimezone,
  workerHealthPort
} = require("./config");
const { DEAD_LETTER_QUEUE_NAME, deadLetterQueue, digestQueue, QUEUE_NAME } = require("./queue");
const { enqueueNightlyDigest } = require("./enqueue");
const { createDigestProcessor } = require("./processor");

const processDigest = createDigestProcessor({
  appendActivityLog,
  deadLetterQueue,
  deadLetterQueueName: DEAD_LETTER_QUEUE_NAME,
  processingDelayMs
});

async function start() {
  if (!cron.validate(scheduleCron)) {
    throw new Error(`Invalid SCHEDULE_CRON expression: ${scheduleCron}`);
  }

  const worker = new Worker(QUEUE_NAME, processDigest, {
    connection: redisConnectionOptions(),
    concurrency: 4
  });
  const healthServer = createServer((request, response) => {
    if (request.url === "/health" && worker.isRunning()) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }
    response.writeHead(503);
    response.end();
  });
  healthServer.listen(workerHealthPort, () => {
    console.log(`Worker health endpoint listening on port ${workerHealthPort}`);
  });

  worker.on("ready", () => console.log(`Worker listening on ${QUEUE_NAME}`));
  worker.on("failed", (job, error) => {
    console.error(`Queue job ${job ? job.id : "unknown"} failed:`, error);
  });
  worker.on("error", (error) => {
    console.error("Worker error:", error);
  });

  const scheduledTask = cron.schedule(
    scheduleCron,
    async () => {
      try {
        const jobId = await enqueueNightlyDigest(false);
        console.log(`Scheduled nightly digest job ${jobId}`);
      } catch (error) {
        console.error("Scheduled nightly digest enqueue failed:", error);
      }
    },
    { timezone: scheduleTimezone }
  );
  console.log(`Nightly scheduler active: "${scheduleCron}" (${scheduleTimezone})`);

  const shutdown = async () => {
    scheduledTask.stop();
    healthServer.close();
    await Promise.all([worker.close(), digestQueue.close(), deadLetterQueue.close(), pool.end()]);
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

start().catch((error) => {
  console.error("Worker startup failed:", error);
  process.exitCode = 1;
});
