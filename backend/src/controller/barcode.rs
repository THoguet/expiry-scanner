use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use sqlx::PgPool;

use crate::{models::Barcode, service};

pub fn router() -> Router<PgPool> {
    Router::new()
        .route("/{barcode}", get(get_barcode))
        .route("/", get(list_barcodes))
}

#[derive(Deserialize)]
pub struct Pagination {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

async fn get_barcode(
    State(pool): State<PgPool>,
    Path(barcode): Path<String>,
) -> Result<Json<Barcode>, (StatusCode, String)> {
    let barcode = service::barcode::get_barcode(&barcode, &pool)
        .await
        .map_err(|e| {
            if let Some(sqlx_err) = e.downcast_ref::<sqlx::Error>() {
                if matches!(sqlx_err, sqlx::Error::RowNotFound) {
                    (StatusCode::NOT_FOUND, "Barcode not found".to_string())
                } else {
                    (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
                }
            } else {
                (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
            }
        })?;
    Ok(Json(barcode))
}

async fn list_barcodes(
    State(pool): State<PgPool>,
    Query(pagination): Query<Pagination>,
) -> Result<Json<Vec<Barcode>>, (StatusCode, String)> {
    let barcodes = service::barcode::list_barcodes(&pool, pagination)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(barcodes))
}
