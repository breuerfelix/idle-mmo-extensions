---
applyTo: "**"
---

the main purpose for this project is to use the idle-mmo api.
api key is in the env var "API_KEY".
all env vars are already set in the file `.env` which is in gitignore.
the app is called "IdleData".

# API Documentation

Complete reference for the IdleMMO Public API endpoints and usage.

---

## Base Information

- **Base URL:** `https://api.idle-mmo.com/v1`
- **Authentication:** Bearer Token
- **Default Rate Limit:** 20 req/min
- **Timestamp Format:** UTC ISO 8601

## Required Headers

```
Authorization: Bearer YOUR_API_KEY   (required)
Accept: application/json
User-Agent: YourApp/1.0.0            (required)
```

## Rate Limit

All API requests are rate limited. The default limit is 20 requests per minute, shared across all API keys for a user unless a custom rate limit is set.

- **X-RateLimit-Limit** – Maximum requests allowed in the current window
- **X-RateLimit-Remaining** – Requests remaining in the current window
- **X-RateLimit-Reset** – Unix timestamp when the rate limit window resets

## Response Codes

- **200 Success** – Request completed successfully.
- **400 Bad Request** – See error code for details.
- **401 Unauthorized** – Invalid or missing API key.
- **403 Forbidden** – Insufficient permissions or account banned.
- **404 Not Found** – Endpoint or entity does not exist.
- **422 Unprocessable Entity** – Validation failed. Check the errors field for details.
- **429 Too Many Requests** – Rate limit exceeded.

## Error Codes

- **1** – Missing User-Agent header

---

# GET Item Search

`/v1/item/search`

Search for items by name. Returns paginated results with basic item information.

## Endpoint URL

`https://api.idle-mmo.com/v1/item/search`

## Required Scope

- `v1.item.search`

## Parameters

- **query** (string, optional) – Search query to filter items by name or description
- **page** (integer, optional) – Page number for pagination (default: 1)

## Example Request

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "User-Agent: YourApp/1.0.0" \
     https://api.idle-mmo.com/v1/item/search
```

## Example Response

```json
{
  "items": [
    {
      "hashed_id": "abc123def456",
      "name": "Iron Sword",
      "description": "A basic iron sword for combat.",
      "image_url": "https://cdn.idle-mmo.com/images/iron-sword.png",
      "type": "weapon",
      "quality": "COMMON",
      "vendor_price": 100
    },
    {
      "hashed_id": "ghi789jkl012",
      "name": "Iron Shield",
      "description": "A sturdy iron shield for defense.",
      "image_url": "https://cdn.idle-mmo.com/images/iron-shield.png",
      "type": "SHIELD",
      "quality": "COMMON",
      "vendor_price": 150
    }
  ],
  "pagination": {
    "current_page": 1,
    "last_page": 3,
    "per_page": 20,
    "total": 45,
    "from": 1,
    "to": 20
  }
}
```

## Response Fields

```
•	items (array)
•	items.*.hashed_id (string)
•	items.*.name (string)
•	items.*.description (string | null)
•	items.*.image_url (string)
•	items.*.type (string)
•	items.*.quality (string)
•	items.*.vendor_price (integer | null)
•	pagination.current_page (integer)
•	pagination.last_page (integer)
•	pagination.per_page (integer)
•	pagination.total (integer)
•	pagination.from (integer | null)
•	pagination.to (integer | null)
```

---

# GET Item Market History

`/v1/item/{hashed_item_id}/market-history`

Get historical market data for an item including price trends and recent transactions.

## Endpoint URL

`https://api.idle-mmo.com/v1/item/{hashed_item_id}/market-history`

## Required Scope

- `v1.item.market_history`

## Parameters

- **tier** (integer) – The tier of the item (0 for base tier)
- **type** (string) – Type of market data to retrieve (`listings` or `orders`)

## Example Request

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "User-Agent: YourApp/1.0.0" \
     https://api.idle-mmo.com/v1/item/{hashed_item_id}/market-history
```

## Example Response

```json
{
  "history_data": [
    {
      "date": "2025-01-15T00:00:00.000000Z",
      "total_sold": 1250,
      "average_price": 100
    },
    {
      "date": "2025-01-16T00:00:00.000000Z",
      "total_sold": 1250,
      "average_price": 100
    }
  ],
  "latest_sold": [
    {
      "item": {
        "hashed_id": "abc123def456",
        "name": "Iron Sword",
        "image_url": "https://cdn.idle-mmo.com/images/iron-sword.png"
      },
      "tier": 3,
      "quantity": 5,
      "price_per_item": 1350,
      "total_price": 6750,
      "sold_at": "2025-01-16T14:30:00.000000Z"
    },
    {
      "item": {
        "hashed_id": "abc123def456",
        "name": "Iron Sword",
        "image_url": "https://cdn.idle-mmo.com/images/iron-sword.png"
      },
      "tier": 2,
      "quantity": 1,
      "price_per_item": 1200,
      "total_price": 1200,
      "sold_at": "2025-01-16T14:25:00.000000Z"
    }
  ],
  "type": "listings",
  "endpoint_updates_at": "2025-01-16T15:00:00.000000Z"
}
```

## Response Fields

```
•	history_data (array)
•	history_data.*.date (string)
•	history_data.*.average_price (integer)
•	history_data.*.total_sold (integer)
•	latest_sold (array)
•	latest_sold.*.item.hashed_id (string)
•	latest_sold.*.item.name (string)
•	latest_sold.*.item.image_url (string)
•	latest_sold.*.tier (integer)
•	latest_sold.*.quantity (integer)
•	latest_sold.*.price_per_item (integer)
•	latest_sold.*.total_price (integer)
•	latest_sold.*.sold_at (string)
•	type (string)
•	endpoint_updates_at (string)
```
