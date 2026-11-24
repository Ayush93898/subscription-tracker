# Technical overview

## Runtime and modules

The project is JavaScript using Node.js ES modules (`"type": "module"`). Express handles HTTP routing. Mongoose 9 is used for model definitions and MongoDB access; its installed package metadata requires Node.js 20.19 or later.

## Express middleware

The application trusts proxy headers, parses JSON and URL-encoded bodies, parses cookies, then applies Arcjet before mounting API routers. Individual routers add JWT authorization to selected endpoints. The final error middleware formats errors passed through Express's `next(error)` convention.

## Persistence

Mongoose schemas define validation, defaults, timestamps, indexes, and a subscription `pre("save")` hook. User registration uses a session transaction. Subscription creation is not transactional with QStash publishing: it persists first and then makes a separate network request.

## Authentication

Registration hashes passwords with bcryptjs. Sign-in compares the submitted password with the stored hash. A JWT containing the user's ID is signed with `JWT_SECRET` and configured `JWT_EXPIRES`. Protected routes require a bearer token; authorization verifies the token and fetches the user for `req.user`.

## Request protection

Arcjet is configured with:

- Shield in `LIVE` mode.
- Bot detection in `DRY_RUN` mode, with selected bot categories allowed.
- A token bucket in `LIVE` mode with capacity 10 and refill rate 5 per 10-second interval.

`ARCJET_ENV` is loaded from environment but is not used in the shown Arcjet configuration.

## QStash workflows and time

`@upstash/workflow` is initialized with `QSTASH_URL` and `QSTASH_TOKEN`. Subscription creation triggers the configured `SERVER_URL` callback with a subscription ID. The workflow uses `serve`, `context.run()`, and `context.sleepUntil()` to persist workflow steps and wait until reminder dates. Reminder offsets are 7, 5, 2, and 1 days.

The `serve` integration reads `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` directly from the process environment. If both are absent, the installed adapter disables QStash signature verification; configure the signing keys for any internet-reachable deployment.

## Email

Nodemailer is configured with its Gmail service and a source-defined sender account. `EMAIL_PASSWORD` supplies the mail credential. Reminder templates interpolate subscription and user fields into HTML. The current mail sender uses the callback form of `transporter.sendMail()` and does not return a promise for the send result.

## Environment variables

The runtime loads `.env.<NODE_ENV>.local`, with development as the default. Values below are used by source or the workflow adapter:

| Variable | Use |
| --- | --- |
| `NODE_ENV` | Selects the local env file and appears in connection logging. |
| `PORT` | HTTP listener port; no code default is provided. |
| `DB_URI` | MongoDB connection string. |
| `JWT_SECRET` | Signs and verifies JWTs. |
| `JWT_EXPIRES` | JWT expiration accepted by `jsonwebtoken`. |
| `ARCJET_KEY` | Arcjet client key. |
| `ARCJET_ENV` | Loaded but currently unused by the Arcjet configuration. |
| `QSTASH_URL` | QStash API base URL used by the workflow client. |
| `QSTASH_TOKEN` | QStash API token. |
| `QSTASH_CURRENT_SIGNING_KEY` | QStash callback signature verification key, read by the SDK. |
| `QSTASH_NEXT_SIGNING_KEY` | Next/rotated QStash callback verification key, read by the SDK. |
| `SERVER_URL` | Public API origin used to construct the workflow callback URL. The current code accepts legacy `SERVER_URl` as fallback. |
| `EMAIL_PASSWORD` | Gmail transport password/app password. |

Never commit populated local env files or paste secrets into issue reports.

