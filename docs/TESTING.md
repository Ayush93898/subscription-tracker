# Testing

## Current setup

The project uses Node's built-in `node:test` runner and Supertest for isolated HTTP request tests. Supertest is a development dependency. Run the tests with:

```sh
npm test
```

The lint check is:

```sh
npm run lint
```

## Prerequisites and safety

The current tests mock Mongoose model methods and the QStash workflow client. They do not connect to MongoDB, QStash, Gmail, or Arcjet. The test HTTP harness mounts the application routers and error middleware without importing `app.js` (which starts a listener and database connection).

No database env file or real development/production database is needed. The test module sets fake process-local keys before dynamically importing modules that load configuration.

## Covered behavior

- Root endpoint response.
- Successful registration and sign-in; invalid credentials and simulated database failure.
- Missing bearer-token rejection and user profile response behavior.
- User listing's current password-hash exposure.
- Mongoose required-field, enum, price, and date validation.
- Successful subscription creation with a mocked QStash trigger.
- QStash failure after persistence, missing-resource and ownership error status behavior, and upcoming-renewals route shadowing.

## Manual Postman testing

Import the files under `postman/` and set `baseUrl` to the local API origin. Sign up or sign in to populate the `token` environment variable. The collection includes destructive subscription operations and intentionally incomplete routes; run requests individually against disposable data. A successful subscription create also requires a reachable QStash endpoint, valid token, callback URL, MongoDB, and email configuration for later reminders.

## Known test gaps

- Arcjet behavior is not executed because its client method is non-configurable in the installed package and the suite must not contact the external service.
- The tests pin several currently known defects (including password-hash exposure and incorrect 500 mappings) to document behavior; update those expectations when fixes are authorized.
- No live MongoDB transaction, QStash signature, workflow wait, or Gmail delivery integration test is run.
