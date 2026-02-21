use axum::{extract::State, routing::get, Router};
use sqlx::PgPool;

use crate::service;

pub mod barcode;
pub mod product;

pub fn router(pool: PgPool) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/db_check", get(db_check))
        .nest("/products", product::router())
        .nest("/barcodes", barcode::router())
        .with_state(pool)
}

async fn health_check() -> &'static str {
    "OK"
}

async fn db_check(State(pool): State<PgPool>) -> &'static str {
    match service::db_check(&pool).await {
        Ok(_) => "DB OK",
        Err(_) => "DB FAIL",
    }
}
