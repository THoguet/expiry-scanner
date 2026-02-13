# STAGE 1: Build
FROM rust:1.93.1 as builder

WORKDIR /app
COPY . .

# This builds the binary in release mode (optimized for speed)
# It will be located at /app/target/release/api
RUN cargo build --release

# STAGE 2: Run
FROM debian:bullseye-slim

# Install OpenSSL (needed for Linux networking)
RUN apt-get update && apt-get install -y libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy the binary from the builder stage
COPY --from=builder /app/target/release/api /usr/local/bin/api

# Set the startup command
CMD ["api"]