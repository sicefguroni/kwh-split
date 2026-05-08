# API Contracts (Current + Target)

## Existing (already implemented)

### Auth
- `POST /api/auth/signup`
  - body: `{ name, email, password, confirmPassword }`
  - response: `201 { user }`
- `POST /api/auth/login`
  - body: `{ email, password }`
  - response: `200 { user }`
- `POST /api/auth/logout`
  - response: `204`
- `GET /api/auth/me`
  - response: `200 { user }`
- `GET /api/auth/google/start`
  - response: `302` redirect to Google OAuth
- `GET /api/auth/google/callback`
  - response: `302` redirect back to web app callback route

### Offline sync
- `POST /api/sync`
  - body: `{ items: [{ action, id, payload }] }`
  - response: `200 { success: true, successIds: string[] }`
- `GET /api/expenses`
  - response: `200 [{ id, description, amount, timestamp }]`

## Added in this plan

### Groups
- `POST /api/groups`
  - body: `{ name, description?, currency? }`
  - response: `201 { group }`
- `GET /api/groups`
  - response: `200 { groups }`
- `GET /api/groups/:id`
  - response: `200 { group }`
- `POST /api/groups/:id/join`
  - body: `{ userId }`
  - response: `204`

### Expenses CRUD
- `POST /api/expenses`
  - body: `{ groupId, titleDescription, totalAmount, saleDate, taxAmount?, tipAmount?, splitType, participantUserIds?, splits?, receiptItems? }`
  - response: `201 { expenseId }`
- `GET /api/expenses/:groupId`
  - response: `200 { expenses }`
- `PUT /api/expenses/:id`
  - body: same as create
  - response: `204`
- `DELETE /api/expenses/:id`
  - response: `204`

### Settlements
- `GET /api/settlements/:groupId`
  - response: `200 { dashboard }`
- `POST /api/settlements/:groupId/mark-paid`
  - body: `{ fromUserId, toUserId, amount, note?, reference?, paidAt? }`
  - response: `204`
- `GET /api/settlements/:groupId/history`
  - response: `200 { history }`

## Error shape
- all validation/domain errors return:
  - `{ error: { code: string, message: string } }`
