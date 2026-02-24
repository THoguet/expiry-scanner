# STAGE 1: Chef setup
FROM rust:1.93.1 AS chef
USER root
RUN cargo install cargo-chef
WORKDIR /app

# STAGE 2: Prepare a recipe
FROM chef AS planner
COPY . .
# Compute a lock-like file for our project
RUN cargo chef prepare --recipe-path recipe.json

# STAGE 3: Build dependencies
FROM chef AS builder
WORKDIR /app
COPY --from=planner /app/recipe.json recipe.json
# Build dependencies - this is the cached layer!
RUN cargo chef cook --release --recipe-path recipe.json
# Build application
COPY . .
RUN cargo build --release

# STAGE 4: Run
FROM debian:bookworm-slim AS runtime
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates libssl3 \
	&& rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/api /usr/local/bin/api

CMD ["api"]