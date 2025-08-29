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
		originalDirector(req)
		req.Host = targetURL.Host
		req.URL.Host = targetURL.Host
		req.URL.Scheme = targetURL.Scheme
		
		// Log the request
		log.Printf("Proxying %s %s to %s", req.Method, req.URL.Path, req.URL.String())
	}

	// Custom error handler
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("Proxy error: %v", err)
		w.WriteHeader(http.StatusBadGateway)
		w.Write([]byte("Bad Gateway"))
	}

	// Custom response modifier
	proxy.ModifyResponse = func(resp *http.Response) error {
		// Add CORS headers
		resp.Header.Set("Access-Control-Allow-Origin", "*")
		resp.Header.Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		resp.Header.Set("Access-Control-Allow-Headers", "Content-Type, Authorization, User-Agent")
		
		return nil
	}

	// Handle CORS preflight requests
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "OPTIONS" {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, User-Agent")
			w.WriteHeader(http.StatusOK)
			return
		}

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
