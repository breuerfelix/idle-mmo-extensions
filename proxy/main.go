package main

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
)

const (
	idleMMOAPIBase = "https://api.idle-mmo.com"
	defaultPort    = "8080"
)

func main() {
	// Parse the target URL
	targetURL, err := url.Parse(idleMMOAPIBase)
	if err != nil {
		log.Fatal("Failed to parse target URL:", err)
	}

	// Create reverse proxy
	proxy := httputil.NewSingleHostReverseProxy(targetURL)

	// Custom director to modify the request
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		// Log original request headers before modification
		log.Printf("=== INCOMING REQUEST ===")
		log.Printf("Method: %s, URL: %s", req.Method, req.URL.String())
		log.Printf("Host header: %s", req.Host)
		log.Printf("Remote address: %s", req.RemoteAddr)
		
		// Log all headers
		for name, values := range req.Header {
			for _, value := range values {
				log.Printf("Header %s: %s", name, value)
			}
		}
		
		originalDirector(req)
		req.Host = targetURL.Host
		req.URL.Host = targetURL.Host
		req.URL.Scheme = targetURL.Scheme
		
		// Log the request with additional headers after modification
		userAgent := req.Header.Get("User-Agent")
		accept := req.Header.Get("Accept")
		authorization := req.Header.Get("Authorization")
		
		log.Printf("=== OUTGOING REQUEST ===")
		log.Printf("Proxying %s %s to %s", req.Method, req.URL.Path, req.URL.String())
		log.Printf("Host: %s | User-Agent: %s | Accept: %s", req.Host, userAgent, accept)
		log.Printf("Authorization: %s", authorization)
		
		// Log all outgoing headers
		for name, values := range req.Header {
			for _, value := range values {
				log.Printf("Outgoing %s: %s", name, value)
			}
		}
		log.Printf("=== END REQUEST LOG ===")
	}

	// Custom error handler
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("=== PROXY ERROR ===")
		log.Printf("Error: %v", err)
		log.Printf("Request: %s %s", r.Method, r.URL.String())
		log.Printf("Host: %s", r.Host)
		log.Printf("Remote: %s", r.RemoteAddr)
		log.Printf("=== END ERROR LOG ===")
		
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusBadGateway)
		w.Write([]byte("Bad Gateway"))
	}

	// Custom response modifier
	proxy.ModifyResponse = func(resp *http.Response) error {
		// Log response details
		log.Printf("=== RESPONSE FROM API ===")
		log.Printf("Status: %d %s", resp.StatusCode, resp.Status)
		log.Printf("Content-Type: %s", resp.Header.Get("Content-Type"))
		log.Printf("Content-Length: %s", resp.Header.Get("Content-Length"))
		
		// Log rate limiting headers if present
		if rateLimit := resp.Header.Get("X-RateLimit-Limit"); rateLimit != "" {
			log.Printf("Rate Limit: %s", rateLimit)
		}
		if rateRemaining := resp.Header.Get("X-RateLimit-Remaining"); rateRemaining != "" {
			log.Printf("Rate Remaining: %s", rateRemaining)
		}
		
		// Add CORS headers
		resp.Header.Set("Access-Control-Allow-Origin", "*")
		resp.Header.Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		resp.Header.Set("Access-Control-Allow-Headers", "Content-Type, Authorization, User-Agent")
		
		log.Printf("=== END RESPONSE LOG ===")
		return nil
	}

	// Handle CORS preflight requests and authentication
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "OPTIONS" {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, User-Agent")
			w.WriteHeader(http.StatusOK)
			return
		}

		// Check for authentication
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			log.Printf("Rejected request from %s: missing Authorization header", r.RemoteAddr)
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte("Unauthorized: Missing Authorization header"))
			return
		}

		// Check if it's a Bearer token starting with "idlemmo"
		if len(authHeader) < 7 || authHeader[:7] != "Bearer " {
			log.Printf("Rejected request from %s: invalid Authorization format", r.RemoteAddr)
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte("Unauthorized: Invalid Authorization format"))
			return
		}

		token := authHeader[7:] // Remove "Bearer " prefix
		if len(token) < 7 || token[:7] != "idlemmo" {
			log.Printf("Rejected request from %s: invalid token format", r.RemoteAddr)
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte("Unauthorized: Invalid token format"))
			return
		}

		log.Printf("Authenticated request from %s with token: %s...", r.RemoteAddr, token[:10])
		proxy.ServeHTTP(w, r)
	})

	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	log.Printf("Starting proxy server on port %s", port)
	log.Printf("Forwarding requests to %s", idleMMOAPIBase)
	
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}
