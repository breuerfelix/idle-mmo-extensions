# Use official Go runtime as base image
FROM golang:1.25-alpine AS builder

# Set working directory inside container
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY main.go main.go

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Use minimal alpine image for final stage
FROM alpine:latest

# Install ca-certificates for HTTPS requests
RUN apk --no-cache add ca-certificates

# Set working directory
WORKDIR /root/

# Copy binary from builder stage
COPY --from=builder /app/main .

# Expose port 8080
EXPOSE 8080

# Set environment variable for port
ENV PORT=8080

# Run the application
CMD ["./main"]
