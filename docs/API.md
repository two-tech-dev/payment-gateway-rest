# HPayment API Documentation

Base URL: `http://localhost:4000/api`

---

## Authentication APIs

### POST /auth/login
Đăng nhập và lấy JWT token.

**Request:**
```json
{
  "email": "admin@hpayment.vn",
  "password": "admin123"
}
```

**Response (200):**
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

**Response (401):**
```json
{
  "success": false,
  "message": "Email hoac mat khau khong dung"
}
```

---

### POST /auth/logout
Đăng xuất (client xóa token).

**Response (200):**
```json
{
  "success": true,
  "message": "Dang xuat thanh cong"
}
```

---

### GET /auth/me
Lấy thông tin user hiện tại.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (200):**
```json
{
  "email": "admin@hpayment.vn",
  "name": "Admin"
}
```

---

## Dashboard APIs

### GET /dashboard/stats
Thống kê doanh thu và hóa đơn.

**Response (200):**
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

---

### GET /charts/revenue
Dữ liệu biểu đồ doanh thu.

**Query Params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| days | number | 7 | Số ngày lấy dữ liệu |

**Example:** `GET /charts/revenue?days=7`

**Response (200):**
```json
[
  { "date": "28/01", "revenue": 18500000, "bills": 48 },
  { "date": "29/01", "revenue": 21200000, "bills": 55 },
  { "date": "30/01", "revenue": 19800000, "bills": 51 },
  { "date": "31/01", "revenue": 25600000, "bills": 62 },
  { "date": "01/02", "revenue": 22100000, "bills": 58 },
  { "date": "02/02", "revenue": 20300000, "bills": 53 },
  { "date": "03/02", "revenue": 15750000, "bills": 42 }
]
```

---

### GET /transactions/recent
Danh sách giao dịch gần đây.

**Query Params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| limit | number | 5 | Số giao dịch trả về |

**Example:** `GET /transactions/recent?limit=5`

**Response (200):**
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
  },
  {
    "id": "INV-001245",
    "amount": 520000,
    "status": "expired",
    "time": "14:15",
    "description": "Order #7889"
  }
]
```

---

## Invoice APIs

### GET /invoices
Danh sách tất cả hóa đơn (yêu cầu JWT).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Trang hiện tại |
| limit | number | 20 | Số item mỗi trang (max 100) |
| status | string | - | Filter: pending, completed, failed, expired |

**Example:** `GET /invoices?page=1&limit=20&status=completed`

**Response (200):**
```json
{
  "invoices": [
    {
      "invoiceId": 1247,
      "memoCode": "HTS1247",
      "amount": 250000,
      "currency": "VND",
      "status": "completed",
      "description": "Order #7891",
      "siteUrl": "https://merchant-demo.hypertech.vn",
      "createdAt": "2026-02-04T07:32:00.000Z",
      "completedAt": "2026-02-04T07:35:00.000Z",
      "expiresAt": "2026-02-04T07:47:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1247,
    "totalPages": 63
  }
}
```

---

### POST /invoices
Tạo hóa đơn mới (yêu cầu API Key).

**Headers:**
```
X-API-Key: <api-key>
```

**Request:**
```json
{
  "amount": 250000,
  "currency": "VND",
  "siteUrl": "https://merchant-demo.hypertech.vn",
  "description": "Order #7891",
  "webhookUrl": "https://webhook.site/your-id"
}
```

**Response (201):**
```json
{
  "invoice": {
    "invoiceId": 1248,
    "memoCode": "HTS1248",
    "amount": 250000,
    "currency": "VND",
    "status": "pending",
    "description": "Order #7891",
    "expiresAt": "2026-02-04T08:00:00.000Z",
    "createdAt": "2026-02-04T07:45:00.000Z"
  }
}
```

**Response (403):**
```json
{
  "message": "siteUrl khong nam trong danh sach duoc phep"
}
```

---

### GET /invoices/:invoiceId
Lấy thông tin hóa đơn theo ID.

**Example:** `GET /invoices/1247`

**Response (200):**
```json
{
  "invoice": {
    "invoiceId": 1247,
    "memoCode": "HTS1247",
    "amount": 250000,
    "currency": "VND",
    "status": "completed",
    "description": "Order #7891",
    "expiresAt": "2026-02-04T07:47:00.000Z",
    "completedAt": "2026-02-04T07:35:00.000Z",
    "createdAt": "2026-02-04T07:32:00.000Z"
  }
}
```

---

## Settings APIs (Yêu cầu JWT)

### GET /settings
Lấy tất cả settings.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (200):**
```json
{
  "apiKey": "hypertech-api-a1b2-c3d4-e5f6-g7h8",
  "webhookUrl": "https://webhook.site/your-webhook-id",
  "allowedSites": [
    "https://merchant-demo.hypertech.vn",
    "https://shop.example.com"
  ]
}
```

---

### PUT /settings
Cập nhật tất cả settings.

**Request:**
```json
{
  "webhookUrl": "https://new-webhook.site/id",
  "allowedSites": [
    "https://merchant-demo.hypertech.vn",
    "https://new-site.com"
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Luu settings thanh cong",
  "settings": {
    "apiKey": "hypertech-api-a1b2-c3d4-e5f6-g7h8",
    "webhookUrl": "https://new-webhook.site/id",
    "allowedSites": [
      "https://merchant-demo.hypertech.vn",
      "https://new-site.com"
    ]
  }
}
```

---

### PUT /settings/webhook
Cập nhật webhook URL.

**Request:**
```json
{
  "webhookUrl": "https://webhook.site/new-id"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Cap nhat webhook thanh cong",
  "webhookUrl": "https://webhook.site/new-id"
}
```

---

### POST /settings/api-key/regenerate
Tạo API key mới.

**Response (200):**
```json
{
  "success": true,
  "message": "Tao API key moi thanh cong",
  "apiKey": "hypertech-api-x1y2-z3w4-a5b6-c7d8"
}
```

---

### POST /settings/allowed-sites
Thêm site được phép.

**Request:**
```json
{
  "site": "https://new-merchant.com"
}
```

**Response (200):**
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

---

### DELETE /settings/allowed-sites/:site
Xóa site khỏi danh sách.

**Example:** `DELETE /settings/allowed-sites/https%3A%2F%2Fnew-merchant.com`

**Response (200):**
```json
{
  "success": true,
  "message": "Xoa site thanh cong",
  "allowedSites": [
    "https://merchant-demo.hypertech.vn"
  ]
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "message": "Payload khong hop le",
  "issues": {
    "fieldErrors": {
      "email": ["Email khong hop le"]
    }
  }
}
```

### 401 Unauthorized
```json
{
  "message": "Khong duoc phep: Token khong hop le"
}
```

### 404 Not Found
```json
{
  "message": "Khong tim thay hoa don"
}
```

### 500 Internal Server Error
```json
{
  "message": "Khong the thuc hien yeu cau"
}
```
