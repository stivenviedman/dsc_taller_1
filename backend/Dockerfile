FROM golang:1.24.6 AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# build backend API
RUN go build -o backend ./main.go

# build asyncq worker
RUN go build -o backend-worker ./cmd/worker/main.go

FROM debian:bookworm-slim

WORKDIR /app

# Install ffmpeg for video processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy binaries
COPY --from=builder /app/backend .
COPY --from=builder /app/backend-worker .
COPY --from=builder /app/.env .

# Ensure folders for storing videos exist
RUN mkdir -p /app/uploads /app/processed

EXPOSE 8080

CMD ["./backend"]
