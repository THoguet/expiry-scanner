use axum::http::StatusCode;
use sqlx::PgPool;
use tracing::debug;

use crate::{
    models::{CreateStock, DeleteStock, EditStock, Stock},
    queries,
};

pub async fn list_stock_with_client_id(
    pool: &PgPool,
    client_id: String,
) -> Result<Vec<Stock>, (StatusCode, String)> {
    debug!(client_id = %client_id, "service list_stock_with_client_id called");
    let parsed_client_id = uuid::Uuid::try_parse(&client_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid client_id".to_string()))?;

    queries::list_stock_with_client_id(pool, parsed_client_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

pub async fn create_stock(
    new_stock: &CreateStock,
    pool: &PgPool,
) -> Result<Stock, (StatusCode, String)> {
    debug!(client_id = %new_stock.client_id, name = %new_stock.name, "service create_stock called");
    if new_stock.name.trim().is_empty() {
        debug!("service create_stock rejected due to empty stock name");
        return Err((StatusCode::BAD_REQUEST, "Invalid stock name".to_string()));
    }

    if new_stock.desired_quantity < 0 || new_stock.current_quantity < 0 {
        debug!(
            desired_quantity = new_stock.desired_quantity,
            current_quantity = new_stock.current_quantity,
            "service create_stock rejected due to invalid quantities"
        );
        return Err((
            StatusCode::BAD_REQUEST,
            "desired_quantity and current_quantity must be >= 0".to_string(),
        ));
    }

    queries::insert_stock(new_stock, pool).await.map_err(|e| {
        let msg = e.to_string();
        debug!(error = %msg, "service create_stock failed");
        (StatusCode::INTERNAL_SERVER_ERROR, msg)
    })
}

pub async fn edit_stock(
    edit_stock: &EditStock,
    pool: &PgPool,
) -> Result<Stock, (StatusCode, String)> {
    debug!(stock_id = edit_stock.id, client_id = %edit_stock.client_id, name = %edit_stock.name, "service edit_stock called");
    if edit_stock.name.trim().is_empty() {
        debug!("service edit_stock rejected due to empty stock name");
        return Err((StatusCode::BAD_REQUEST, "Invalid stock name".to_string()));
    }

    if edit_stock.desired_quantity < 0 || edit_stock.current_quantity < 0 {
        debug!(
            desired_quantity = edit_stock.desired_quantity,
            current_quantity = edit_stock.current_quantity,
            "service edit_stock rejected due to invalid quantities"
        );
        return Err((
            StatusCode::BAD_REQUEST,
            "desired_quantity and current_quantity must be >= 0".to_string(),
        ));
    }

    queries::edit_stock(edit_stock, pool).await.map_err(|e| {
        debug!(error = %e, "service edit_stock failed");
        (StatusCode::NOT_FOUND, "Stock not found".to_string())
    })
}

pub async fn delete_stock(
    delete_stock: &DeleteStock,
    pool: &PgPool,
) -> Result<(), (StatusCode, String)> {
    debug!(stock_id = delete_stock.id, client_id = %delete_stock.client_id, "service delete_stock called");
    queries::delete_stock(delete_stock, pool)
        .await
        .map_err(|e| {
            debug!(error = %e, "service delete_stock failed");
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })
}

pub async fn adjust_stock_delta(
    pool: &PgPool,
    stock_id: i64,
    client_id: String,
    delta: i32,
) -> Result<Stock, (StatusCode, String)> {
    debug!(stock_id, client_id = %client_id, delta, "service adjust_stock_delta called");
    let parsed_client_id = uuid::Uuid::try_parse(&client_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid client_id".to_string()))?;

    if delta == 0 {
        debug!("service adjust_stock_delta rejected due to zero delta");
        return Err((
            StatusCode::BAD_REQUEST,
            "delta must be different from 0".to_string(),
        ));
    }

    match queries::adjust_stock_delta(pool, stock_id, parsed_client_id, delta)
        .await
        .map_err(|e| {
            debug!(error = %e, "service adjust_stock_delta failed");
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })? {
        Some(stock) => Ok(stock),
        None => Err((
            StatusCode::BAD_REQUEST,
            "Stock not found or resulting quantity would be negative".to_string(),
        )),
    }
}
