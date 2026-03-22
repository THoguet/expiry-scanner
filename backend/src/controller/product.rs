use axum::{
    body::Bytes,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use sqlx::PgPool;

use crate::{
    models::{
        CreateProduct, CreateUserProductInfo, DeleteProduct, EditProduct, Product, ProductPrefill,
        UploadProductImageResponse, UserProductInfo,
    },
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
        .route("/prefill/{barcode}", get(get_product_prefill))
        .route("/info", post(save_product_info))
        .route("/image/{barcode}", post(upload_product_image))
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
    if new_product.name.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Invalid name".to_string()));
    }

    service::product::create_product(&new_product, &pool)
        .await
        .map(|product| (StatusCode::CREATED, Json(product)))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn edit_product(
    State(pool): State<PgPool>,
    Json(edit_product): Json<EditProduct>,
) -> Result<Json<Product>, (StatusCode, String)> {
    if edit_product.name.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Invalid name".to_string()));
    }

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

async fn get_product_prefill(
    State(pool): State<PgPool>,
    Path(barcode): Path<String>,
    Query(ProductQuery { client_id }): Query<ProductQuery>,
) -> Result<Json<ProductPrefill>, (StatusCode, String)> {
    service::product::get_product_prefill(&pool, barcode, client_id)
        .await
        .map(Json)
}

async fn save_product_info(
    State(pool): State<PgPool>,
    Json(new_info): Json<CreateUserProductInfo>,
) -> Result<(StatusCode, Json<UserProductInfo>), (StatusCode, String)> {
    service::product::create_user_product_info(&new_info, &pool)
        .await
        .map(|info| (StatusCode::CREATED, Json(info)))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn upload_product_image(
    Path(barcode): Path<String>,
    Query(ProductQuery { client_id }): Query<ProductQuery>,
    body: Bytes,
) -> Result<Json<UploadProductImageResponse>, (StatusCode, String)> {
    let image =
        service::product::save_optimized_product_image(client_id, barcode, body.to_vec()).await?;

    Ok(Json(UploadProductImageResponse { image }))
}
