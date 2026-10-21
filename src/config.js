require("dotenv").config();

function requiredEnvironmentVariable(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function redisConnectionOptions() {
  const redisUrl = new URL(requiredEnvironmentVariable("REDIS_URL"));
  if (redisUrl.protocol !== "redis:" && redisUrl.protocol !== "rediss:") {
    throw new Error("REDIS_URL must use the redis:// or rediss:// protocol");
  }

  const databasePath = redisUrl.pathname.replace("/", "");
  const options = {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    maxRetriesPerRequest: null
  };

  if (redisUrl.username) {
    options.username = decodeURIComponent(redisUrl.username);
  }
  if (redisUrl.password) {
    options.password = decodeURIComponent(redisUrl.password);
  }
  if (databasePath) {
    options.db = Number(databasePath);
  }
  if (redisUrl.protocol === "rediss:") {
    options.tls = {};
  }

  return options;
}

const processingDelayMs = Number(process.env.PROCESSING_DELAY_MS || 2000);
if (!Number.isSafeInteger(processingDelayMs) || processingDelayMs < 0) {
  throw new Error("PROCESSING_DELAY_MS must be a non-negative integer");
}

module.exports = {
  databaseUrl: requiredEnvironmentVariable("DATABASE_URL"),
  port: Number(process.env.PORT || 3000),
  processingDelayMs,
  redisConnectionOptions,
  scheduleCron: process.env.SCHEDULE_CRON || "0 0 * * *",
  scheduleTimezone: process.env.SCHEDULE_TIMEZONE || "UTC",
  workerHealthPort: Number(process.env.WORKER_HEALTH_PORT || 3001)
};
