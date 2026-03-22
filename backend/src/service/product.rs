use std::{error::Error, io::Cursor, path::PathBuf};

use axum::http::StatusCode;
use base64::{engine::general_purpose::STANDARD, Engine};
use image::{codecs::jpeg::JpegEncoder, GenericImageView};
use sqlx::PgPool;
use tokio::fs;
use tracing::debug;

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
    debug!(client_id = %client_id, "service list_products_with_client_id called");
    let parsed_client_id = uuid::Uuid::try_parse(&client_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid client_id".to_string()))?;

    queries::list_products_with_client_id(pool, parsed_client_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

pub async fn create_product(
    new_product: &CreateProduct,
    pool: &PgPool,
    request_base_url: &str,
) -> Result<Product, Box<dyn Error>> {
    debug!(barcode = %new_product.barcode, client_id = %new_product.client_id, "service create_product called");
    if new_product.name.trim().is_empty() {
        debug!("service create_product rejected due to empty name");
        return Err("Invalid name".into());
    }

    let mut product = queries::insert_product(new_product, pool).await?;

    if let Some(image_base64) = new_product.image_base64.as_deref() {
        if !image_base64.trim().is_empty() {
            let decoded = decode_base64_image_payload(image_base64)
                .map_err(|e| -> Box<dyn Error> { e.into() })?;

            let image_path = save_optimized_product_image(
                pool,
                new_product.client_id.to_string(),
                new_product.barcode.clone(),
                product.id,
                request_base_url,
                decoded,
            )
            .await
            .map_err(|(_, msg)| -> Box<dyn Error> { msg.into() })?;

            product = queries::set_product_image(
                pool,
                product.id,
                new_product.client_id,
                Some(image_path),
            )
            .await?;
        }
    }

    let barcode_exists = queries::barcode_exists_in_database(pool, &new_product.barcode).await?;
    if !barcode_exists {
        let user_info = CreateUserProductInfo {
            barcode: new_product.barcode.clone(),
            name: Some(new_product.name.clone()),
            image: product.image.clone(),
            client_id: new_product.client_id,
        };

        queries::upsert_user_product_info(&user_info, pool).await?;
    }

    Ok(product)
}

pub async fn edit_product(
    edit_product: &EditProduct,
    pool: &PgPool,
) -> Result<Product, Box<dyn Error>> {
    debug!(product_id = edit_product.id, client_id = %edit_product.client_id, "service edit_product called");
    if edit_product.name.trim().is_empty() {
        debug!("service edit_product rejected due to empty name");
        return Err("Invalid name".into());
    }

    queries::edit_product(edit_product, pool).await
}

pub async fn delete_product(product: &DeleteProduct, pool: &PgPool) -> Result<(), Box<dyn Error>> {
    debug!(product_id = product.id, client_id = %product.client_id, "service delete_product called");
    queries::delete_product(product, pool).await
}

pub async fn list_product_with_barcode(
    pool: &PgPool,
    client_id: String,
) -> Result<Vec<(Product, Option<Barcode>)>, (StatusCode, String)> {
    debug!(client_id = %client_id, "service list_product_with_barcode called");
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
    debug!(product_id, client_id = %client_id, "service get_product_by_id_with_barcode called");
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
    debug!(barcode = %barcode, client_id = %client_id, "service get_product_prefill called");
    if barcode.trim().is_empty() {
        debug!("service get_product_prefill rejected due to empty barcode");
        return Err((StatusCode::BAD_REQUEST, "Invalid barcode".to_string()));
    }

    let parsed_client_id = uuid::Uuid::try_parse(&client_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid client_id".to_string()))?;

    if let Some(prefill) = queries::get_barcode_prefill(pool, &barcode)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    {
        debug!("prefill found from barcode_database");
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
        debug!("prefill found from user_client");
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
        debug!("prefill found from user_global");
        return Ok(ProductPrefill {
            barcode: prefill.barcode,
            name: prefill.name,
            image: prefill.image,
            source: "user_global".to_string(),
        });
    }

    debug!("prefill not found in any source");
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
    debug!(barcode = %new_info.barcode, client_id = %new_info.client_id, "service create_user_product_info called");
    queries::upsert_user_product_info(new_info, pool).await
}

pub async fn save_optimized_product_image(
    pool: &PgPool,
    client_id: String,
    barcode: String,
    product_id: i64,
    request_base_url: &str,
    image_bytes: Vec<u8>,
) -> Result<String, (StatusCode, String)> {
    debug!(client_id = %client_id, barcode = %barcode, product_id, image_bytes = image_bytes.len(), "service save_optimized_product_image called");
    let parsed_client_id = uuid::Uuid::try_parse(&client_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid client_id".to_string()))?;

    if barcode.trim().is_empty() {
        debug!("save_optimized_product_image rejected due to empty barcode");
        return Err((StatusCode::BAD_REQUEST, "Invalid barcode".to_string()));
    }

    if image_bytes.is_empty() {
        debug!("save_optimized_product_image rejected due to empty payload");
        return Err((StatusCode::BAD_REQUEST, "Empty image payload".to_string()));
    }

    let (product, _) = queries::get_product_by_id_with_barcode(pool, product_id, parsed_client_id)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "Product not found".to_string()))?;

    if product.barcode != barcode {
        debug!(expected_barcode = %product.barcode, requested_barcode = %barcode, product_id, "save_optimized_product_image rejected due to barcode mismatch");
        return Err((
            StatusCode::BAD_REQUEST,
            "Barcode does not match product".to_string(),
        ));
    }

    let safe_barcode = sanitize_file_segment(&barcode);
    let base_dir = PathBuf::from("product_image").join(&safe_barcode);
    fs::create_dir_all(&base_dir)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let output_path = base_dir.join(format!("{}.jpg", product_id));
    let optimize_input = image_bytes;

    let optimized = tokio::task::spawn_blocking(move || optimize_to_jpeg(optimize_input))
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    fs::write(&output_path, optimized)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    debug!(output_path = %output_path.display(), "optimized product image saved");
    let relative_path = format!("/product_image/{}/{}.jpg", safe_barcode, product_id);
    let normalized_base = request_base_url.trim_end_matches('/');
    if normalized_base.is_empty() {
        Ok(relative_path)
    } else {
        Ok(format!("{}{}", normalized_base, relative_path))
    }
}

fn sanitize_file_segment(value: &str) -> String {
    debug!("sanitizing file segment");
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
    debug!(input_bytes = image_bytes.len(), "optimizing image to JPEG");
    let image = image::load_from_memory(&image_bytes)?;
    let (width, height) = image.dimensions();
    let max_side = width.max(height);
    debug!(width, height, max_side, "loaded image dimensions");

    let resized = if max_side > 900 {
        image.resize(900, 900, image::imageops::FilterType::Triangle)
    } else {
        image
    };

    let rgb = resized.to_rgb8();
    let mut out = Vec::new();
    let mut encoder = JpegEncoder::new_with_quality(Cursor::new(&mut out), 35);
    encoder.encode_image(&rgb)?;
    debug!(output_bytes = out.len(), "image optimization complete");
    Ok(out)
}

fn decode_base64_image_payload(payload: &str) -> Result<Vec<u8>, String> {
    let trimmed = payload.trim();
    let encoded = if let Some((_, data)) = trimmed.split_once(",") {
        data
    } else {
        trimmed
    };

    STANDARD
        .decode(encoded)
        .map_err(|_| "Invalid image_base64 payload".to_string())
}
