# Idle Proxy

A simple Go proxy that forwards all requests to the IdleMMO API with CORS support.

## Features

- Forwards all HTTP requests to `https://api.idle-mmo.com`
- Preserves all headers from incoming requests
- Adds CORS headers for browser compatibility
- Handles preflight OPTIONS requests
- Logs all proxied requests
- Configurable port via environment variable

## Usage

### Running locally

```bash
go run main.go
```

The proxy will start on port 8080 by default.

### Environment Variables

- `PORT`: Port to run the server on (default: 8080)

### Docker

Build the image:

```bash
docker build -t idle-proxy .
```

Run the container:

```bash
docker run -p 8080:8080 idle-proxy
```

## API Usage

Once running, you can make requests to the proxy instead of directly to the IdleMMO API:

```bash
# Instead of: https://api.idle-mmo.com/v1/item/search
# Use: http://localhost:8080/v1/item/search

curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "User-Agent: YourApp/1.0.0" \
     http://localhost:8080/v1/item/search
```

The proxy will forward the request to the IdleMMO API and return the response with CORS headers added.
