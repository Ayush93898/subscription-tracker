# Database

## Technology and connection

The API uses MongoDB through Mongoose. `database/mongodb.js` reads `DB_URI` and calls `mongoose.connect()`. The connection is started from the `app.listen()` callback. The code exits the process if connection setup throws. Registration starts a MongoDB transaction, so the database must support transactions (normally a replica set or sharded cluster); a standalone MongoDB server is insufficient for that flow.

## User model

Collection/model: `User` (Mongoose collection naming is handled by Mongoose).

| Field | Type | Constraints/default | Notes |
| --- | --- | --- | --- |
| `_id` | ObjectId | Mongoose default | Primary identifier. |
| `name` | String | Required, trimmed, 3-50 chars |  |
| `email` | String | Required, unique, trimmed, lowercase, regex `\\S+@\\S+\\.\\S+` | Unique index is declared by the schema. |
| `password` | String | Required, minimum 6 chars | Registration hashes it with bcryptjs before persistence. |
| `createdAt` | Date | Automatic | Added by schema timestamps. |
| `updatedAt` | Date | Automatic | Added by schema timestamps. |

## Subscription model

| Field | Type | Constraints/default | Notes |
| --- | --- | --- | --- |
| `_id` | ObjectId | Mongoose default | Primary identifier. |
| `name` | String | Required, trimmed, 2-155 chars | Subscription/provider label. |
| `price` | Number | Required, minimum 0 | The validation message says greater than 0, but the schema minimum allows 0. |
| `currency` | String | Enum `USD`, `EUR`, `RUPEE`; default `USD` |  |
| `frequency` | String | Enum `daily`, `weekly`, `monthly`, `yearly` | Not marked required in the schema. |
| `category` | String | Required enum: `sports`, `news`, `entertainment`, `lifestyle`, `technology`, `finance`, `politics`, `other` |  |
| `status` | String | Enum `active`, `expired`, `cancelled`; default `active` | Save hook marks a non-cancelled subscription expired when its renewal date is past. |
| `startDate` | Date | Required; validator allows values `<= new Date()` | Error text says “in the past,” but the validator also accepts the present. |
| `renewalDate` | Date | Optional; validator requires a value after `startDate` | Save hook calculates this when falsy. |
| `paymentMethod` | String | Required, trimmed | Free-form value; no enum is defined. |
| `user` | ObjectId | Required, indexed, ref `User` | Owner reference. |
| `createdAt` | Date | Automatic | Added by schema timestamps. |
| `updatedAt` | Date | Automatic | Added by schema timestamps. |

## Renewal-date lifecycle

When `renewalDate` is absent, the subscription pre-save hook clones `startDate` and adds a fixed number of days:

| Frequency | Days added |
| --- | ---: |
| daily | 1 |
| weekly | 7 |
| monthly | 30 |
| yearly | 365 |

This is fixed-day arithmetic, not calendar-month/year arithmetic. The same save hook changes status to `expired` when a non-cancelled renewal date is earlier than the current time. The hook calculates only when `renewalDate` is falsy; changing `startDate` or `frequency` on a document with an existing renewal date does not recalculate it automatically.

## Relationships and indexes

- `Subscription.user` references a `User` document and has `index: true`.
- `User.email` is declared unique.
- MongoDB's default `_id` index applies to both models.

No explicit database migrations, TTL indexes, or database transaction abstraction is defined for subscription operations. User registration uses a Mongoose session transaction.

## Important queries and data lifecycle

- User sign-in and duplicate checking query by email.
- Authorization loads a user by the `userId` claim.
- Subscription list operations filter by owner; detail/update/delete operations also check ownership.
- Reminder workflows query a subscription by ID and populate the owner's `name` and `email`.
- Delete removes a subscription document. Cancel retains it and changes `status`.
- User deletion is not implemented by the user routes.

