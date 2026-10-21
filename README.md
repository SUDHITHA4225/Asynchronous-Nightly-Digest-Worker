# Asynchronous Nightly Digest Worker

## Overview
The Asynchronous Nightly Digest Worker is a backend application that processes jobs in the background. It uses Node.js, Express.js, BullMQ, Redis, and PostgreSQL to manage jobs, track activities, and handle failures.

## Features
- Asynchronous background job processing.
- Activity logging to track job status.
- REST APIs to trigger jobs and view logs.
- Failure handling and Dead Letter Queue (DLQ) support.
- Automatic nightly job scheduling using cron.
- Docker Compose for easy setup and deployment.

## Technologies Used
- Node.js and Express.js
- BullMQ and Redis
- PostgreSQL
- Docker and Docker Compose
- Cron Scheduler

## API Endpoints

**1. Trigger a job**

`POST /api/jobs/trigger`

Triggers a nightly digest job and returns a job ID with a `202 Accepted` response.

Example request:

```json
{
  "type": "nightly_digest",
  "simulate_failure": false
}
```

**2. Get job activity logs**

`GET /api/jobs/{job_id}/logs`

Returns the job's current state and complete activity history in chronological order.

## Job Processing
- **Successful job:** `pending → started → success`
- **Failed job:** `pending → started → failed → dead_letter`

All state changes are recorded in PostgreSQL for tracking and debugging.

## Scheduled Execution
A cron scheduler automatically triggers the nightly digest job at midnight UTC using the expression `0 0 * * *`.

## Docker Setup
Start all services using:

```bash
docker-compose up -d --build
```

Database initialization and migrations run automatically during startup.

## Conclusion
This project demonstrates asynchronous job processing, scheduled tasks, activity logging, and failure handling. It provides a simple and reliable way to manage background jobs using modern backend technologies.