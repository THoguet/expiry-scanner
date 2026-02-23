use std::error::Error;

use axum::http::StatusCode;
use sqlx::PgPool;

use crate::{
    models::{Barcode, CreateProduct, DeleteProduct, Product},
    queries,
};

pub async fn list_products_with_client_id(
    pool: &PgPool,
    client_id: String,
) -> Result<Vec<Product>, (StatusCode, String)> {
    let parsed_client_id = uuid::Uuid::try_parse(&client_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid client_id".to_string()))?;

    queries::list_products_with_client_id(pool, parsed_client_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

pub async fn create_product(
    new_product: &CreateProduct,
    pool: &PgPool,
) -> Result<Product, Box<dyn Error>> {
    queries::insert_product(new_product, pool).await
}

pub async fn delete_product(product: &DeleteProduct, pool: &PgPool) -> Result<(), Box<dyn Error>> {
    queries::delete_product(product, pool).await
}

pub async fn list_product_with_barcode(
    pool: &PgPool,
    client_id: String,
) -> Result<Vec<(Product, Option<Barcode>)>, (StatusCode, String)> {
    let parsed_client_id = uuid::Uuid::try_parse(&client_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid client_id".to_string()))?;

    queries::list_join_product_barcode_barcode_code(pool, parsed_client_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

pub async fn get_product_by_id_with_barcode(
    pool: &PgPool,
    product_id: i64,
    client_id: String,
) -> Result<(Product, Option<Barcode>), (StatusCode, String)> {
    let parsed_client_id = uuid::Uuid::try_parse(&client_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid client_id".to_string()))?;

    queries::get_product_by_id_with_barcode(pool, product_id, parsed_client_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}
