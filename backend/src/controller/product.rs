use axum::{
    body::Bytes,
    extract::{DefaultBodyLimit, Path, Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use sqlx::PgPool;
use tracing::debug;

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
    debug!("building product router");
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
        .route("/image/{barcode}/{product_id}", post(upload_product_image))
        .route("/with-barcode", get(list_with_barcode))
        .route("/with-barcode/{product_id}", get(get_by_id_with_barcode))
        .layer(DefaultBodyLimit::max(20 * 1024 * 1024))
}

async fn list_products(
    State(pool): State<PgPool>,
    Query(ProductQuery { client_id }): Query<ProductQuery>,
) -> Result<Json<Vec<Product>>, (StatusCode, String)> {
    debug!(client_id = %client_id, "list_products called");
    service::product::list_products_with_client_id(&pool, client_id)
        .await
        .map(Json)
}

async fn new_product(
    State(pool): State<PgPool>,
    Json(new_product): Json<CreateProduct>,
) -> Result<(StatusCode, Json<Product>), (StatusCode, String)> {
    debug!(barcode = %new_product.barcode, client_id = %new_product.client_id, "new_product called");
    if new_product.name.trim().is_empty() {
        debug!("new_product rejected due to empty name");
        return Err((StatusCode::BAD_REQUEST, "Invalid name".to_string()));
    }

    service::product::create_product(&new_product, &pool)
        .await
        .map(|product| (StatusCode::CREATED, Json(product)))
        .map_err(|e| {
            debug!(error = %e, "new_product failed");
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })
}

async fn edit_product(
    State(pool): State<PgPool>,
    Json(edit_product): Json<EditProduct>,
) -> Result<Json<Product>, (StatusCode, String)> {
    debug!(product_id = edit_product.id, client_id = %edit_product.client_id, "edit_product called");
    if edit_product.name.trim().is_empty() {
        debug!("edit_product rejected due to empty name");
        return Err((StatusCode::BAD_REQUEST, "Invalid name".to_string()));
    }

    service::product::edit_product(&edit_product, &pool)
        .await
        .map(Json)
        .map_err(|e| {
            debug!(error = %e, "edit_product failed");
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })
}

async fn delete_product(
    State(pool): State<PgPool>,
    Json(delete_product): Json<DeleteProduct>,
) -> Result<StatusCode, (StatusCode, String)> {
    debug!(product_id = delete_product.id, client_id = %delete_product.client_id, "delete_product called");
    service::product::delete_product(&delete_product, &pool)
        .await
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|e| {
            debug!(error = %e, "delete_product failed");
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })
}

async fn list_with_barcode(
    State(pool): State<PgPool>,
    Query(ProductQuery { client_id }): Query<ProductQuery>,
) -> Result<Json<Vec<(Product, Option<crate::models::Barcode>)>>, (StatusCode, String)> {
    debug!(client_id = %client_id, "list_with_barcode called");
    service::product::list_product_with_barcode(&pool, client_id)
        .await
        .map(Json)
}

async fn get_by_id_with_barcode(
    State(pool): State<PgPool>,
    Path(product_id): Path<i64>,
    Query(ProductQuery { client_id }): Query<ProductQuery>,
) -> Result<Json<(Product, Option<crate::models::Barcode>)>, (StatusCode, String)> {
    debug!(product_id, client_id = %client_id, "get_by_id_with_barcode called");
    service::product::get_product_by_id_with_barcode(&pool, product_id, client_id)
        .await
        .map(Json)
}

async fn get_product_prefill(
    State(pool): State<PgPool>,
    Path(barcode): Path<String>,
    Query(ProductQuery { client_id }): Query<ProductQuery>,
) -> Result<Json<ProductPrefill>, (StatusCode, String)> {
    debug!(barcode = %barcode, client_id = %client_id, "get_product_prefill called");
    service::product::get_product_prefill(&pool, barcode, client_id)
        .await
        .map(Json)
}

async fn save_product_info(
    State(pool): State<PgPool>,
    Json(new_info): Json<CreateUserProductInfo>,
) -> Result<(StatusCode, Json<UserProductInfo>), (StatusCode, String)> {
    debug!(barcode = %new_info.barcode, client_id = %new_info.client_id, "save_product_info called");
    service::product::create_user_product_info(&new_info, &pool)
        .await
        .map(|info| (StatusCode::CREATED, Json(info)))
        .map_err(|e| {
            debug!(error = %e, "save_product_info failed");
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })
}

async fn upload_product_image(
    State(pool): State<PgPool>,
    Path((barcode, product_id)): Path<(String, i64)>,
    Query(ProductQuery { client_id }): Query<ProductQuery>,
    body: Bytes,
) -> Result<Json<UploadProductImageResponse>, (StatusCode, String)> {
    debug!(barcode = %barcode, product_id, client_id = %client_id, image_bytes = body.len(), "upload_product_image called");
    let image = service::product::save_optimized_product_image(
        &pool,
        client_id,
        barcode,
        product_id,
        body.to_vec(),
    )
    .await?;

    debug!(image_path = %image, "upload_product_image succeeded");
    Ok(Json(UploadProductImageResponse { image }))
}
