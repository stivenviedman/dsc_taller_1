FROM golang:1.24.6 AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build -o backend .

FROM debian:bookworm-slim

WORKDIR /app

COPY --from=builder /app/backend .
COPY --from=builder /app/.env .

EXPOSE 8080

CMD ["./backend"]
