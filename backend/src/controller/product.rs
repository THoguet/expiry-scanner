use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use sqlx::PgPool;

use crate::{
    models::{CreateProduct, DeleteProduct, EditProduct, Product},
    service,
};

#[derive(Deserialize)]
struct ProductQuery {
    client_id: String,
}

pub fn router() -> Router<PgPool> {
    Router::new()
        .route(
            "/",
            get(list_products)
                .post(new_product)
                .delete(delete_product)
                .put(edit_product),
        )
        .route("/with-barcode", get(list_with_barcode))
        .route("/with-barcode/{product_id}", get(get_by_id_with_barcode))
}

async fn list_products(
    State(pool): State<PgPool>,
    Query(ProductQuery { client_id }): Query<ProductQuery>,
) -> Result<Json<Vec<Product>>, (StatusCode, String)> {
    service::product::list_products_with_client_id(&pool, client_id)
        .await
        .map(Json)
}

async fn new_product(
    State(pool): State<PgPool>,
    Json(new_product): Json<CreateProduct>,
) -> Result<(StatusCode, Json<Product>), (StatusCode, String)> {
    service::product::create_product(&new_product, &pool)
        .await
        .map(|product| (StatusCode::CREATED, Json(product)))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn edit_product(
    State(pool): State<PgPool>,
    Json(edit_product): Json<EditProduct>,
) -> Result<Json<Product>, (StatusCode, String)> {
    service::product::edit_product(&edit_product, &pool)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn delete_product(
    State(pool): State<PgPool>,
    Json(delete_product): Json<DeleteProduct>,
) -> Result<StatusCode, (StatusCode, String)> {
    service::product::delete_product(&delete_product, &pool)
        .await
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn list_with_barcode(
    State(pool): State<PgPool>,
    Query(ProductQuery { client_id }): Query<ProductQuery>,
) -> Result<Json<Vec<(Product, Option<crate::models::Barcode>)>>, (StatusCode, String)> {
    service::product::list_product_with_barcode(&pool, client_id)
        .await
        .map(Json)
}

async fn get_by_id_with_barcode(
    State(pool): State<PgPool>,
    Path(product_id): Path<i64>,
    Query(ProductQuery { client_id }): Query<ProductQuery>,
) -> Result<Json<(Product, Option<crate::models::Barcode>)>, (StatusCode, String)> {
    service::product::get_product_by_id_with_barcode(&pool, product_id, client_id)
        .await
        .map(Json)
}
