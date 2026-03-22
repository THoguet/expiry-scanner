use std::{error::Error, io::Cursor, path::PathBuf};

use axum::http::StatusCode;
use image::{codecs::jpeg::JpegEncoder, GenericImageView};
use sqlx::PgPool;
use tokio::fs;

use crate::{
    models::{
        Barcode, CreateProduct, CreateUserProductInfo, DeleteProduct, EditProduct, Product,
        ProductPrefill, UserProductInfo,
    },
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
    if new_product.name.trim().is_empty() {
        return Err("Invalid name".into());
    }

    queries::insert_product(new_product, pool).await
}

pub async fn edit_product(
    edit_product: &EditProduct,
    pool: &PgPool,
) -> Result<Product, Box<dyn Error>> {
    if edit_product.name.trim().is_empty() {
        return Err("Invalid name".into());
    }

    queries::edit_product(edit_product, pool).await
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

pub async fn get_product_prefill(
    pool: &PgPool,
    barcode: String,
    client_id: String,
) -> Result<ProductPrefill, (StatusCode, String)> {
    if barcode.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Invalid barcode".to_string()));
    }

    let parsed_client_id = uuid::Uuid::try_parse(&client_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid client_id".to_string()))?;

    if let Some(prefill) = queries::get_barcode_prefill(pool, &barcode)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    {
        return Ok(ProductPrefill {
            barcode: prefill.barcode,
            name: prefill.name,
            image: prefill.image,
            source: "barcode_database".to_string(),
        });
    }

    if let Some(prefill) =
        queries::get_user_product_info_by_client(pool, &barcode, parsed_client_id)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    {
        return Ok(ProductPrefill {
            barcode: prefill.barcode,
            name: prefill.name,
            image: prefill.image,
            source: "user_client".to_string(),
        });
    }

    if let Some(prefill) = queries::get_user_product_info_global(pool, &barcode)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    {
        return Ok(ProductPrefill {
            barcode: prefill.barcode,
            name: prefill.name,
            image: prefill.image,
            source: "user_global".to_string(),
        });
    }

    Ok(ProductPrefill {
        barcode,
        name: None,
        image: None,
        source: "none".to_string(),
    })
}

pub async fn create_user_product_info(
    new_info: &CreateUserProductInfo,
    pool: &PgPool,
) -> Result<UserProductInfo, Box<dyn Error>> {
    queries::upsert_user_product_info(new_info, pool).await
}

pub async fn save_optimized_product_image(
    client_id: String,
    barcode: String,
    image_bytes: Vec<u8>,
) -> Result<String, (StatusCode, String)> {
    let parsed_client_id = uuid::Uuid::try_parse(&client_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid client_id".to_string()))?;

    if barcode.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Invalid barcode".to_string()));
    }

    if image_bytes.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Empty image payload".to_string()));
    }

    let safe_barcode = sanitize_file_segment(&barcode);
    let base_dir = PathBuf::from("images").join(parsed_client_id.to_string());
    fs::create_dir_all(&base_dir)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let output_path = base_dir.join(format!("{}.jpg", safe_barcode));
    let optimize_input = image_bytes;

    let optimized = tokio::task::spawn_blocking(move || optimize_to_jpeg(optimize_input))
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    fs::write(&output_path, optimized)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(format!("/images/{}/{}.jpg", parsed_client_id, safe_barcode))
}

fn sanitize_file_segment(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for c in value.chars() {
        if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
            out.push(c);
        } else {
            out.push('_');
        }
    }

    if out.is_empty() {
        "unknown".to_string()
    } else {
        out
    }
}

fn optimize_to_jpeg(image_bytes: Vec<u8>) -> Result<Vec<u8>, image::ImageError> {
    let image = image::load_from_memory(&image_bytes)?;
    let (width, height) = image.dimensions();
    let max_side = width.max(height);

    let resized = if max_side > 900 {
        image.resize(900, 900, image::imageops::FilterType::Triangle)
    } else {
        image
    };

    let rgb = resized.to_rgb8();
    let mut out = Vec::new();
    let mut encoder = JpegEncoder::new_with_quality(Cursor::new(&mut out), 35);
    encoder.encode_image(&rgb)?;
    Ok(out)
}
