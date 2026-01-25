# Hyper Tech Payment Gateway

Node.js + TypeScript backend that exposes a minimal set of APIs to create and track deposit invoices for Hyper Tech Payment. The service persists data in MongoDB, white-lists partner sites via `config/config.js`, broadcasts invoice events to Discord, and reconciles paid invoices through the SieuThiCode MBBank history API.

## Features

- Authenticated REST API built with Fastify (API key via `x-api-key`).
- Invoice creation with optional webhook callbacks and automatic memo code prefix (`HTS`).
- Invoice lookup endpoint to check payment status.
- Discord notifications when invoices are created.
- Cron reconciliation (every 30 seconds) that marks invoices completed when matching transactions are found via the third-party API response.

## Prerequisites

- Node.js 18+
- npm 9+
- Access to the Mongo cluster (URI provided by the user)

## Installation

```bash
npm install
cp .env.example .env # then update the values
```

Required environment variables (see `.env.example`):

- `PORT` – API port (default `4000`).
- `MONGO_URI` – MongoDB connection string (provided URI).
- `API_KEY` – API key required in `x-api-key` header.
- `DISCORD_WEBHOOK_URL` – Discord webhook that receives invoice notifications.
- `HISTORY_API_TOKEN` – Token appended to `https://api.sieuthicode.net/historyapimbbankv2/<TOKEN>`.

### config/config.js

Maintain the partner allow-list and default values outside of the code:

```js
module.exports = {
    allowedSites: [
        "https://hypertechpayment.com",
        "https://merchant-demo.hypertech.vn",
    ],
    fallbackApiKey: "hypertech-default-key",
    defaultCurrency: "VND",
};
```

- Update `allowedSites` with the origins that are permitted to use the gateway.
- `fallbackApiKey` is only used if `API_KEY` is missing.
- Restart the server after editing this file.

## Development

```bash
npm run dev    # ts-node-dev watcher
npm run build  # emit compiled JS to dist/
npm start      # run the compiled server
```

## API Reference

All requests require the header `x-api-key: <API_KEY>` and must reference a `siteUrl` that matches `config/config.js`.

### Create Invoice

- **POST** `/api/invoices`
- **Body**

```json
{
    "amount": 99000,
    "currency": "VND",
    "siteUrl": "https://merchant-demo.hypertech.vn",
    "description": "Order #7123",
    "webhookUrl": "https://merchant-demo.hypertech.vn/payment/callback"
}
```

**Response**

```json
{
    "invoice": {
        "invoiceId": 1205,
        "memoCode": "HTS1205",
        "status": "pending",
        "amount": 99000,
        "currency": "VND",
        "siteUrl": "https://merchant-demo.hypertech.vn",
        "createdAt": "2024-01-31T09:52:12.611Z"
    }
}
```

**curl example**

```bash
curl -X POST http://localhost:4000/api/invoices \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${API_KEY}" \
    -d '{
        "amount": 99000,
        "currency": "VND",
        "siteUrl": "https://merchant-demo.hypertech.vn",
        "description": "Order #7123",
        "webhookUrl": "https://merchant-demo.hypertech.vn/payment/callback"
    }'
```

### Check Invoice Status

- **GET** `/api/invoices/:invoiceId`

```http
GET /api/invoices/1205
```

**curl example**

```bash
curl -X GET http://localhost:4000/api/invoices/1205 \
    -H "x-api-key: ${API_KEY}"
```

Returns the same invoice payload with updated status, `transactionSnapshot`, and `completedAt` when reconciled.

## Cron Reconciliation Flow

The job defined in `src/jobs/invoiceReconciliation.ts` runs every 30 seconds (Asia/Ho_Chi_Minh):

1. Calls `https://api.sieuthicode.net/historyapimbbankv2/<HISTORY_API_TOKEN>`.
2. For each `IN` transaction, extracts the `HTS` memo from the description (`parse_order_id` equivalent in `src/utils/orderId.ts`).
3. Marks the matching invoice as `completed`, stores the transaction snapshot, triggers the merchant webhook (if provided), and logs the update.

Ensure the third-party token is valid; otherwise the job logs a warning and no invoices will be closed.

## Webhooks & Discord

- Discord notifications use `DISCORD_WEBHOOK_URL` and include invoice metadata in an embed.
- Merchant webhooks (optional per invoice) receive `event: "invoice.completed"` plus the latest invoice payload.

## Testing Tips

- Use a tool such as Hoppscotch or curl with the `x-api-key` header for manual verification.
- Seed the database with a sample invoice, then mock the reconciliation API by crafting a transaction description containing `HTS<invoiceId>` to confirm the cron flow.
