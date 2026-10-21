const { Queue } = require("bullmq");
const { redisConnectionOptions } = require("./config");

const QUEUE_NAME = "nightly-digest";
const DEAD_LETTER_QUEUE_NAME = "nightly-digest-dead-letter";
const connection = redisConnectionOptions();
const digestQueue = new Queue(QUEUE_NAME, { connection });
const deadLetterQueue = new Queue(DEAD_LETTER_QUEUE_NAME, { connection });

module.exports = {
  DEAD_LETTER_QUEUE_NAME,
  QUEUE_NAME,
  deadLetterQueue,
  digestQueue
};
