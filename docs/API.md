# Hyper Tech Payment Gateway - Full API Docs

Base URL:

```text
http://localhost:4000/api
```

## Auth Summary

| API group | Auth type |
|---|---|
| Auth | Public (except `/auth/me`) |
| Invoices list | JWT (`Authorization: Bearer <token>`) |
| Invoice create | API key (`x-api-key`) |
| Invoice detail | Origin guard (`Origin` or `Referer`) |
| Invoice payment methods | Origin guard (`Origin` or `Referer`) |
| Dashboard | Public |
| Settings | JWT (`Authorization: Bearer <token>`) |

Origin guard allow-list (hardcoded in server):

- `https://payment.hypertechstudio.xyz`
- `http://localhost:3000`

---

## 1. Authentication APIs

### 1.1 POST `/auth/login`

Login and return JWT token.

Request body example:

```json
{
  "email": "admin@hpayment.vn",
  "password": "admin123"
}
```

Response 200 example:

```json
{
  "success": true,
  "user": {
    "email": "admin@hpayment.vn",
    "name": "Admin"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Response 400 example:

```json
{
  "success": false,
  "message": "Thong tin dang nhap khong hop le",
  "issues": {
    "formErrors": [],
    "fieldErrors": {
      "email": ["Email khong hop le"]
    }
  }
}
```

Response 401 example:

```json
{
  "success": false,
  "message": "Email hoac mat khau khong dung"
}
```

### 1.2 POST `/auth/logout`

Logout endpoint (for JWT app, client usually removes token).

Request body example:

```json
{}
```

Response 200 example:

```json
{
  "success": true,
  "message": "Dang xuat thanh cong"
}
```

### 1.3 GET `/auth/me`

Get current user profile.

Required header:

```text
Authorization: Bearer <jwt-token>
```

Response 200 example:

```json
{
  "email": "admin@hpayment.vn",
  "name": "Admin"
}
```

Response 401 example:

```json
{
  "message": "Khong duoc phep: Token het han hoac khong hop le"
}
```

---

## 2. Invoice APIs

### 2.1 GET `/invoices`

List invoices with pagination.

Required header:

```text
Authorization: Bearer <jwt-token>
```

Query params:

- `page` (number, default `1`)
- `limit` (number, default `20`, max `100`)
- `status` (`pending | completed | failed | expired`)

Example request:

```text
GET /api/invoices?page=1&limit=20&status=pending
```

Response 200 example:

```json
{
  "invoices": [
    {
      "invoiceId": 1205,
      "memoCode": "HTS1205",
      "amount": 99000,
      "currency": "VND",
      "paymentMethods": ["mbbank", "vietcombank"],
      "status": "pending",
      "description": "Order #7123",
      "siteUrl": "https://merchant-demo.hypertech.vn",
      "createdAt": "2026-02-27T08:30:00.000Z",
      "expiresAt": "2026-02-27T08:45:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### 2.2 POST `/invoices`

Create new invoice.

Required header:

```text
x-api-key: <api-key>
```

Request body example:

```json
{
  "amount": 99000,
  "currency": "VND",
  "siteUrl": "https://merchant-demo.hypertech.vn",
  "paymentMethods": ["mbbank", "vietcombank"],
  "description": "Order #7123",
  "webhookUrl": "https://merchant-demo.hypertech.vn/payment/callback"
}
```

Notes:

- `paymentMethods` is optional.
- If omitted, backend defaults to `["mbbank", "vietcombank"]`.

Response 201 example:

```json
{
  "invoice": {
    "invoiceId": 1205,
    "memoCode": "HTS1205",
    "siteUrl": "https://merchant-demo.hypertech.vn",
    "siteOrigin": "https://merchant-demo.hypertech.vn",
    "amount": 99000,
    "currency": "VND",
    "paymentMethods": ["mbbank", "vietcombank"],
    "description": "Order #7123",
    "status": "pending",
    "webhookUrl": "https://merchant-demo.hypertech.vn/payment/callback",
    "expiresAt": "2026-02-27T08:45:00.000Z",
    "createdAt": "2026-02-27T08:30:00.000Z",
    "updatedAt": "2026-02-27T08:30:00.000Z"
  }
}
```

Response 400 example:

```json
{
  "message": "Payload khong hop le",
  "issues": {
    "formErrors": [],
    "fieldErrors": {
      "amount": ["So tien phai lon hon 0"]
    }
  }
}
```

Response 403 example:

```json
{
  "message": "siteUrl khong nam trong danh sach duoc phep"
}
```

### 2.3 GET `/invoices/:invoiceId`

Get invoice detail by `invoiceId`.

Required header (`Origin` or `Referer`):

```text
Origin: http://localhost:3000
```

Example request:

```text
GET /api/invoices/1205
```

Response 200 example:

```json
{
  "invoice": {
    "invoiceId": 1205,
    "memoCode": "HTS1205",
    "siteUrl": "https://merchant-demo.hypertech.vn",
    "siteOrigin": "https://merchant-demo.hypertech.vn",
    "amount": 99000,
    "currency": "VND",
    "paymentMethods": ["mbbank", "vietcombank"],
    "description": "Order #7123",
    "status": "completed",
    "transactionSnapshot": {
      "transactionID": "5388 - 71420",
      "amount": 99000,
      "description": "822730.310124.205233.SP HTS1205",
      "transactionDate": "31/01/2024",
      "type": "IN",
      "paymentMethod": "vietcombank"
    },
    "expiresAt": "2026-02-27T08:45:00.000Z",
    "completedAt": "2026-02-27T08:33:25.000Z",
    "createdAt": "2026-02-27T08:30:00.000Z",
    "updatedAt": "2026-02-27T08:33:25.000Z"
  }
}
```

Response 403 example:

```json
{
  "message": "Khong duoc phep truy cap tu origin nay"
}
```

Response 404 example:

```json
{
  "message": "Khong tim thay hoa don"
}
```

### 2.4 GET `/invoices/:invoiceId/payment-methods`

Get payment method info for a specific invoice.

Required header (`Origin` or `Referer`):

```text
Origin: http://localhost:3000
```

Example request:

```text
GET /api/invoices/1205/payment-methods
```

Response 200 example:

```json
{
  "invoiceId": 1205,
  "amount": 99000,
  "memoCode": "HTS1205",
  "paymentMethods": [
    {
      "method": "mbbank",
      "bankCode": "MB",
      "bankName": "MBBank",
      "accountNumber": "0347970961",
      "accountName": "Nguyen Viet Hieu",
      "logo": "https://cdn.vietqr.io/img/MB.png",
      "qrCode": "https://img.vietqr.io/image/MB-0347970961-qr_only.png?amount=99000&addInfo=HTS1205"
    },
    {
      "method": "vietcombank",
      "bankCode": "VCB",
      "bankName": "Vietcombank",
      "accountNumber": "3335085080",
      "accountName": "Nguyen Viet Hieu",
      "logo": "https://cdn.vietqr.io/img/VCB.png",
      "qrCode": "https://img.vietqr.io/image/VCB-3335085080-qr_only.png?amount=99000&addInfo=HTS1205"
    }
  ]
}
```

---

## 3. Dashboard APIs

Note: current code does not apply JWT/API key guard to dashboard endpoints.

### 3.1 GET `/dashboard/stats`

Response 200 example:

```json
{
  "todayRevenue": 15750000,
  "monthlyRevenue": 487320000,
  "todayBills": 42,
  "monthlyBills": 1247,
  "lastMonthRevenue": 425180000,
  "lastMonthBills": 1089
}
```

### 3.2 GET `/charts/revenue`

Query params:

- `days` (number, default `7`)

Example request:

```text
GET /api/charts/revenue?days=7
```

Response 200 example:

```json
[
  { "date": "21/02", "revenue": 18500000, "bills": 48 },
  { "date": "22/02", "revenue": 21200000, "bills": 55 },
  { "date": "23/02", "revenue": 19800000, "bills": 51 },
  { "date": "24/02", "revenue": 25600000, "bills": 62 },
  { "date": "25/02", "revenue": 22100000, "bills": 58 },
  { "date": "26/02", "revenue": 20300000, "bills": 53 },
  { "date": "27/02", "revenue": 15750000, "bills": 42 }
]
```

### 3.3 GET `/transactions/recent`

Query params:

- `limit` (number, default `5`)

Example request:

```text
GET /api/transactions/recent?limit=5
```

Response 200 example:

```json
[
  {
    "id": "INV-001247",
    "amount": 250000,
    "status": "completed",
    "time": "14:32",
    "description": "Order #7891"
  },
  {
    "id": "INV-001246",
    "amount": 180000,
    "status": "pending",
    "time": "14:28",
    "description": "Order #7890"
  }
]
```

---

## 4. Settings APIs

All settings endpoints require:

```text
Authorization: Bearer <jwt-token>
```

### 4.1 GET `/settings`

Response 200 example:

```json
{
  "apiKey": "hypertech-api-a1b2-c3d4-e5f6",
  "webhookSecret": "whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "webhookUrl": "https://merchant-demo.hypertech.vn/webhook",
  "allowedSites": [
    "https://merchant-demo.hypertech.vn",
    "https://shop.example.com"
  ]
}
```

### 4.2 PUT `/settings`

Request body example:

```json
{
  "webhookUrl": "https://merchant-demo.hypertech.vn/webhook",
  "allowedSites": [
    "https://merchant-demo.hypertech.vn",
    "https://shop.example.com"
  ]
}
```

Response 200 example:

```json
{
  "success": true,
  "message": "Luu settings thanh cong",
  "settings": {
    "apiKey": "hypertech-api-a1b2-c3d4-e5f6",
    "webhookSecret": "whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "webhookUrl": "https://merchant-demo.hypertech.vn/webhook",
    "allowedSites": [
      "https://merchant-demo.hypertech.vn",
      "https://shop.example.com"
    ]
  }
}
```

### 4.3 PUT `/settings/webhook`

Request body example:

```json
{
  "webhookUrl": "https://merchant-demo.hypertech.vn/new-webhook"
}
```

Response 200 example:

```json
{
  "success": true,
  "message": "Cap nhat webhook thanh cong",
  "webhookUrl": "https://merchant-demo.hypertech.vn/new-webhook"
}
```

### 4.4 POST `/settings/api-key/regenerate`

Request body example:

```json
{}
```

Response 200 example:

```json
{
  "success": true,
  "message": "Tao API key moi thanh cong",
  "apiKey": "hypertech-api-z1y2-x3w4-v5u6"
}
```

### 4.5 POST `/settings/webhook-secret/regenerate`

Request body example:

```json
{}
```

Response 200 example:

```json
{
  "success": true,
  "message": "Tao webhook secret moi thanh cong",
  "webhookSecret": "whsec_yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"
}
```

### 4.6 POST `/settings/allowed-sites`

Request body example:

```json
{
  "site": "https://new-merchant.com"
}
```

Response 200 example:

```json
{
  "success": true,
  "message": "Them site thanh cong",
  "allowedSites": [
    "https://merchant-demo.hypertech.vn",
    "https://new-merchant.com"
  ]
}
```

Response 400 example (duplicate):

```json
{
  "message": "Site da ton tai trong danh sach"
}
```

### 4.7 DELETE `/settings/allowed-sites/:site`

Example request:

```text
DELETE /api/settings/allowed-sites/https%3A%2F%2Fnew-merchant.com
```

Response 200 example:

```json
{
  "success": true,
  "message": "Xoa site thanh cong",
  "allowedSites": [
    "https://merchant-demo.hypertech.vn"
  ]
}
```

Response 404 example:

```json
{
  "message": "Site khong ton tai trong danh sach"
}
```

---

## 5. Common Error Responses

400 example:

```json
{
  "message": "Payload khong hop le",
  "issues": {
    "formErrors": [],
    "fieldErrors": {}
  }
}
```

401 example:

```json
{
  "message": "Khong duoc phep: Token khong hop le"
}
```

403 example:

```json
{
  "message": "Khong duoc phep truy cap tu origin nay"
}
```

404 example:

```json
{
  "message": "Khong tim thay hoa don"
}
```

500 example:

```json
{
  "message": "Khong the thuc hien yeu cau"
}
```
