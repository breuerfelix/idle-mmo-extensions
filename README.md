# IdleData

A Node.js script to fetch all items from the IdleMMO API using an alphabetical search approach.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set your API key in the `.env` file (already configured in this project)

## Usage

Run the script to fetch all items:

```bash
npm start
```

The script will:

- Search for items using each letter of the alphabet (a-z) as query parameters
- Fetch all pages for each letter using pagination
- Respect the 20 req/min rate limit (3 second delays between requests)
- Save individual letter results to `items/a.json`, `items/b.json`, etc.
- Combine and deduplicate all items into `items.json`
- Display statistics about the fetched items

## Output Files

- **`items/`** - Directory containing individual letter search results (`a.json`, `b.json`, etc.)
- **`items.json`** - Final deduplicated list of all unique items

Each item contains:

- `hashed_id` - Unique item identifier
- `name` - Item name
- `description` - Item description
- `image_url` - Item image URL
- `type` - Item type (weapon, shield, etc.)
- `quality` - Item quality (COMMON, etc.)
- `vendor_price` - Base vendor price

## How It Works

Since the API requires a search query, this script:

1. Searches for items starting with each letter (a-z)
2. Fetches all pages for each letter
3. Saves results to individual JSON files
4. Combines all files and removes duplicates based on `hashed_id`
5. Outputs final statistics and saves to `items.json`

## Rate Limiting

The script automatically handles rate limiting by waiting 3 seconds between API calls to stay within the 20 requests per minute limit.
