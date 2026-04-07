use axum::{extract::State, routing::get, Router};
use sqlx::PgPool;
use tracing::debug;

use crate::service;

pub mod barcode;
pub mod freezer;
pub mod product;
pub mod stock;

pub fn router(pool: PgPool) -> Router {
    debug!("building root router");
    Router::new()
        .route("/health", get(health_check))
        .route("/db_check", get(db_check))
        .nest("/products", product::router())
        .nest("/stock", stock::router())
        .nest("/barcodes", barcode::router())
        .nest("/freezer", freezer::router())
        .with_state(pool)
}

async fn health_check() -> &'static str {
    debug!("health_check called");
    "OK"
}

async fn db_check(State(pool): State<PgPool>) -> &'static str {
    debug!("db_check called");
    match service::db_check(&pool).await {
        Ok(_) => {
            debug!("db_check successful");
            "DB OK"
        }
        Err(err) => {
            debug!(error = %err, "db_check failed");
            "DB FAIL"
        }
    }
}
