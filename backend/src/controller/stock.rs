use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use sqlx::PgPool;
use tracing::debug;

use crate::{
    models::{AdjustStockDelta, CreateStock, DeleteStock, EditStock, Stock},
    service,
};

#[derive(Deserialize)]
struct StockQuery {
    client_id: String,
}

pub fn router() -> Router<PgPool> {
    debug!("building stock router");
    Router::new()
        .route(
            "/",
            get(list_stock)
                .post(new_stock)
                .put(update_stock)
                .delete(remove_stock),
        )
        .route("/{stock_id}/delta", post(update_stock_delta))
}

async fn list_stock(
    State(pool): State<PgPool>,
    Query(StockQuery { client_id }): Query<StockQuery>,
) -> Result<Json<Vec<Stock>>, (StatusCode, String)> {
    debug!(client_id = %client_id, "list_stock called");
    service::stock::list_stock_with_client_id(&pool, client_id)
        .await
        .map(Json)
}

async fn new_stock(
    State(pool): State<PgPool>,
    Json(new_stock): Json<CreateStock>,
) -> Result<(StatusCode, Json<Stock>), (StatusCode, String)> {
    debug!(client_id = %new_stock.client_id, name = %new_stock.name, "new_stock called");
    service::stock::create_stock(&new_stock, &pool)
        .await
        .map(|stock| (StatusCode::CREATED, Json(stock)))
        .map_err(|e| {
            debug!(error = %e.1, "new_stock failed");
            e
        })
}

async fn update_stock(
    State(pool): State<PgPool>,
    Json(edit_stock): Json<EditStock>,
) -> Result<Json<Stock>, (StatusCode, String)> {
    debug!(stock_id = edit_stock.id, client_id = %edit_stock.client_id, "update_stock called");
    service::stock::edit_stock(&edit_stock, &pool)
        .await
        .map(Json)
        .map_err(|e| {
            debug!(error = %e.1, "update_stock failed");
            e
        })
}

async fn remove_stock(
    State(pool): State<PgPool>,
    Json(delete_stock): Json<DeleteStock>,
) -> Result<StatusCode, (StatusCode, String)> {
    debug!(stock_id = delete_stock.id, client_id = %delete_stock.client_id, "remove_stock called");
    service::stock::delete_stock(&delete_stock, &pool)
        .await
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|e| {
            debug!(error = %e.1, "remove_stock failed");
            e
        })
}

async fn update_stock_delta(
    State(pool): State<PgPool>,
    Path(stock_id): Path<i64>,
    Json(adjust): Json<AdjustStockDelta>,
) -> Result<Json<Stock>, (StatusCode, String)> {
    debug!(stock_id, client_id = %adjust.client_id, delta = adjust.delta, "update_stock_delta called");
    service::stock::adjust_stock_delta(&pool, stock_id, adjust.client_id.to_string(), adjust.delta)
        .await
        .map(Json)
        .map_err(|e| {
            debug!(error = %e.1, "update_stock_delta failed");
            e
        })
}
