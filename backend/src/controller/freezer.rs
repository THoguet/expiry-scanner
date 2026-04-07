use axum::{
    extract::{Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use sqlx::PgPool;
use tracing::debug;

use crate::{
    models::{FreezeProduct, FrozenProduct, Product, UnfreezeProduct},
    service,
};

#[derive(Deserialize)]
struct FreezerQuery {
    client_id: String,
}

pub fn router() -> Router<PgPool> {
    debug!("building freezer router");
    Router::new()
        .route("/", get(list_frozen))
        .route("/freeze", post(freeze))
        .route("/unfreeze", post(unfreeze))
}

async fn list_frozen(
    State(pool): State<PgPool>,
    Query(FreezerQuery { client_id }): Query<FreezerQuery>,
) -> Result<Json<Vec<FrozenProduct>>, (StatusCode, String)> {
    debug!(client_id = %client_id, "list_frozen called");
    service::freezer::list_frozen_products(&pool, client_id)
        .await
        .map(Json)
}

async fn freeze(
    State(pool): State<PgPool>,
    Json(payload): Json<FreezeProduct>,
) -> Result<(StatusCode, Json<Vec<FrozenProduct>>), (StatusCode, String)> {
    debug!(product_id = payload.product_id, client_id = %payload.client_id, "freeze called");
    service::freezer::freeze_product(&payload, &pool)
        .await
        .map(|frozen| (StatusCode::CREATED, Json(frozen)))
}

async fn unfreeze(
    State(pool): State<PgPool>,
    Json(payload): Json<UnfreezeProduct>,
) -> Result<Json<Product>, (StatusCode, String)> {
    debug!(frozen_product_id = payload.frozen_product_id, client_id = %payload.client_id, "unfreeze called");
    service::freezer::unfreeze_product(&payload, &pool)
        .await
        .map(Json)
}
