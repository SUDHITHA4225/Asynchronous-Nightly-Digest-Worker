const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
const { databaseUrl } = require("./config");

const pool = new Pool({ connectionString: databaseUrl });

async function runMigrations() {
  const migrationPath = path.join(__dirname, "..", "migrations", "001_create_jobs_and_activity_logs.sql");
  const migration = await fs.readFile(migrationPath, "utf8");
  await pool.query(migration);
}

async function createJob(jobId, payload) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO jobs (id, name, payload) VALUES ($1, $2, $3)",
      [jobId, "nightly_digest", payload]
    );
    await client.query(
      "INSERT INTO job_activity_logs (id, job_id, state, message) VALUES ($1, $2, $3, $4)",
      [randomUUID(), jobId, "pending", "Job accepted and queued for processing"]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function appendActivityLog(jobId, state, message) {
  await pool.query(
    "INSERT INTO job_activity_logs (id, job_id, state, message) VALUES ($1, $2, $3, $4)",
    [randomUUID(), jobId, state, message]
  );
}

async function getJobLogs(jobId) {
  const result = await pool.query(
    `SELECT state, message, created_at
       FROM job_activity_logs
      WHERE job_id = $1
      ORDER BY created_at ASC, id ASC`,
    [jobId]
  );
  return result.rows;
}

async function jobExists(jobId) {
  const result = await pool.query("SELECT 1 FROM jobs WHERE id = $1", [jobId]);
  return result.rowCount > 0;
}

module.exports = {
  appendActivityLog,
  createJob,
  getJobLogs,
  jobExists,
  pool,
  runMigrations
};
