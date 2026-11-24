# API documentation

All application endpoints use the `/api/v1` prefix except `GET /`. JSON requests should use `Content-Type: application/json`. Protected endpoints use `Authorization: Bearer <jwt>`.

## Endpoint summary

| Method | Path | Auth | Current behavior |
| --- | --- | --- | --- |
| GET | `/` | No | Plain-text welcome response. |
| POST | `/api/v1/auth/sign-up` | No | Creates an account and returns a JWT. |
| POST | `/api/v1/auth/sign-in` | No | Verifies credentials and returns a JWT. |
| POST | `/api/v1/auth/sign-out` | No | Handler is empty; it does not send a response. |
| GET | `/api/v1/users` | No | Returns all user documents, including password hashes. |
| GET | `/api/v1/users/:id` | Bearer JWT | Returns a user without the password field; does not enforce ownership. |
| POST | `/api/v1/users` | No | Placeholder response only; does not create a user. |
| PUT | `/api/v1/users/:id` | No | Placeholder response only; does not update a user. |
| DELETE | `/api/v1/users/:id` | No | Placeholder response only; does not delete a user. |
| GET | `/api/v1/subscriptions` | Bearer JWT | Lists the authenticated user's subscriptions, newest first. |
| POST | `/api/v1/subscriptions` | Bearer JWT | Creates a subscription and triggers a QStash workflow. |
| GET | `/api/v1/subscriptions/:id` | Bearer JWT | Returns one owned subscription. |
| PUT | `/api/v1/subscriptions/:id` | Bearer JWT | Updates allowed subscription fields. |
| DELETE | `/api/v1/subscriptions/:id` | Bearer JWT | Permanently deletes an owned subscription. |
| PUT | `/api/v1/subscriptions/:id/cancel` | Bearer JWT | Sets an owned subscription's status to `cancelled`. |
| GET | `/api/v1/subscriptions/user/:id` | Bearer JWT | Lists subscriptions for the authenticated owner. |
| GET | `/api/v1/subscriptions/upcoming-renewals` | Bearer JWT in current route order | Intended placeholder is shadowed by `/:id`; currently produces an invalid-ID not-found response. |
| POST | `/api/v1/workflows/subscription/reminder` | QStash signature | Upstash `serve` workflow callback; not a normal client endpoint. |

The route list describes the current implementation, including incomplete and shadowed routes. Do not treat placeholders as completed functionality.

## Common responses

Application error middleware generally returns:

```json
{
  "success": false,
  "error": "Error message"
}
```

Known mappings include Mongoose validation errors to 400, duplicate-key errors to 409, and cast errors to 404. Missing bearer tokens on protected routes return 401 with `{ "message": "unauthorized" }`. Other JWT errors are passed to the generic error middleware and may return 500.

## Health

### `GET /`

Returns plain text:

```text
welcome to subscription tracker api!
```

## Authentication

### `POST /api/v1/auth/sign-up`

Request:

```json
{
  "name": "Example User",
  "email": "example@example.com",
  "password": "replace-me"
}
```

On success, returns 201 with `success`, `message`, and `data.token` / `data.user`. The current response contains the newly created Mongoose user document, including its hashed `password` field. This is a confirmed security issue; do not use real credentials until it is fixed.

The user schema requires a name (3-50 characters), email matching the schema's basic pattern, and password with at least 6 characters. Existing emails are explicitly rejected with 409; a concurrent duplicate can surface as a database duplicate-key error.

### `POST /api/v1/auth/sign-in`

Request:

```json
{
  "email": "example@example.com",
  "password": "replace-me"
}
```

Returns 200 with a JWT and a user object containing `id`, `name`, and `email`. Missing email/password returns 400. Unknown email and password mismatch both return 401 with the same message.

### `POST /api/v1/auth/sign-out`

The route exists, but `signOut` is empty and never responds. It does not revoke JWTs.

## Users

### `GET /api/v1/users`

No authentication is required. Returns `{ "success": true, "data": [...] }`. The controller currently returns raw user documents, including password hashes. Avoid calling this endpoint with real data.

### `GET /api/v1/users/:id`

Requires a bearer JWT. Returns `{ "success": true, "data": user }` with `password` excluded. It does not verify that the authenticated user owns the requested ID, so any valid account token can request another user's profile.

Invalid IDs map to 404 through the cast-error handler; missing users return 404.

### `POST /api/v1/users`, `PUT /api/v1/users/:id`, `DELETE /api/v1/users/:id`

These are placeholder routes. They return a 200 response with a `title` string and do not write to MongoDB or require authentication.

## Subscriptions

### `POST /api/v1/subscriptions`

Requires a bearer JWT. `SERVER_URL` must be configured and reachable for the workflow callback. The controller creates the MongoDB document first, then calls QStash. A QStash/network failure therefore returns an error after the subscription has already been saved.

Example request:

```json
{
  "name": "Premium",
  "price": 200.99,
  "currency": "USD",
  "frequency": "monthly",
  "category": "entertainment",
  "startDate": "2026-11-24",
  "paymentMethod": "Credit Card"
}
```

The `user` field comes from the authenticated user and should not be supplied by the client. `renewalDate` is calculated by the model when omitted. On success, the endpoint returns 201 with `data` and `workflowRunId`.

Schema constraints include: `name` 2-155 characters; `price` numeric and at least 0; `currency` one of `USD`, `EUR`, `RUPEE` (default `USD`); `frequency` one of `daily`, `weekly`, `monthly`, `yearly`; `category` one of `sports`, `news`, `entertainment`, `lifestyle`, `technology`, `finance`, `politics`, `other`; `startDate` required and not later than the current time; `paymentMethod` required; `user` required.

### `GET /api/v1/subscriptions`

Requires a bearer JWT. Returns the current user's subscriptions sorted by `createdAt` descending:

```json
{
  "success": true,
  "count": 1,
  "data": []
}
```

### `GET /api/v1/subscriptions/:id`

Requires a bearer JWT. Returns one subscription if it exists and belongs to the caller. Invalid ObjectId values are mapped to 404. For a valid but nonexistent ID or another user's subscription, the controller sets `error.status`, while the error middleware reads `statusCode`; these cases currently return 500.

### `PUT /api/v1/subscriptions/:id`

Requires a bearer JWT. Updates only fields present from this allowlist: `name`, `price`, `currency`, `frequency`, `category`, `paymentMethod`, `startDate`, and `renewalDate`. The document is loaded and saved, which runs the schema's save hook. Returns 200 with a success message and the updated document. Changing `startDate` or `frequency` does not recalculate an already-present `renewalDate`. Invalid ObjectId values map to 404; valid but nonexistent IDs and ownership failures currently return 500 because the controller sets `error.status` rather than `statusCode`.

### `DELETE /api/v1/subscriptions/:id`

Requires a bearer JWT. Permanently deletes the owned subscription. Returns 200 with a message. The reminder workflow is not explicitly cancelled by this controller. Invalid ObjectId values map to 404; valid but nonexistent IDs and ownership failures currently return 500 due to the error-status property mismatch.

### `PUT /api/v1/subscriptions/:id/cancel`

Requires a bearer JWT. Sets an owned subscription to `cancelled`; repeating the operation is intended to return 400, but the controller currently sets `error.status` and the error middleware reads `statusCode`, so that condition currently returns 500. The same mismatch affects nonexistent IDs and ownership failures. The workflow checks status before sending reminders. Successful cancellation returns 200 with the cancelled document.

### `GET /api/v1/subscriptions/user/:id`

Requires a bearer JWT and checks that the requested ID equals the caller. The ownership failure sets `error.status` rather than `error.statusCode`; because the error middleware reads `statusCode`, this case currently returns 500 instead of the apparent intended 401.

### `GET /api/v1/subscriptions/upcoming-renewals`

The route is registered after `GET /:id`, so the dynamic route handles the single-segment path first and attempts to query MongoDB with `upcoming-renewals` as an ObjectId. It currently returns a 404 cast error rather than upcoming subscription data.

## Workflow callback

### `POST /api/v1/workflows/subscription/reminder`

This route is wrapped by Upstash Workflow's `serve` adapter. It expects a QStash workflow invocation and, when signing keys are configured, a valid QStash signature. It receives a payload containing `subscriptionId`, loads the subscription and user, and schedules email steps. Call it through QStash rather than as an ordinary Postman request.

