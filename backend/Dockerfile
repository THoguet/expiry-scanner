# STAGE 1: Build
FROM rust:1.93.1 AS builder

RUN apt-get update \
	&& apt-get install -y --no-install-recommends libssl-dev ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cache dependencies first (changes here invalidate less often)
COPY Cargo.toml Cargo.lock* build.rs ./
RUN mkdir -p src \
	&& printf 'fn main() {}\n' > src/main.rs \
	&& cargo build --release \
	&& rm -rf src

# Copy application code last so only this layer invalidates on code changes
COPY src ./src
COPY migrations ./migrations

RUN cargo build --release

# STAGE 2: Run
FROM debian:bookworm-slim AS runtime

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates libssl3 \
	&& rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/api /usr/local/bin/api

CMD ["api"]