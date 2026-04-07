use axum::http::StatusCode;
use chrono::{NaiveTime, Utc};
use sqlx::PgPool;
use tracing::debug;

use crate::{
    models::{FreezeProduct, FrozenProduct, Product, UnfreezeProduct},
    queries,
};

pub async fn list_frozen_products(
    pool: &PgPool,
    client_id: String,
) -> Result<Vec<FrozenProduct>, (StatusCode, String)> {
    debug!(client_id = %client_id, "service list_frozen_products called");
    let parsed_client_id = uuid::Uuid::try_parse(&client_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid client_id".to_string()))?;

    queries::list_frozen_products(pool, parsed_client_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

pub async fn freeze_product(
    payload: &FreezeProduct,
    pool: &PgPool,
) -> Result<Vec<FrozenProduct>, (StatusCode, String)> {
    debug!(product_id = payload.product_id, client_id = %payload.client_id, "service freeze_product called");

    if payload.total_portions < 1 {
        return Err((
            StatusCode::BAD_REQUEST,
            "total_portions must be at least 1".to_string(),
        ));
    }

    if payload.keep_in_fridge < 0 || payload.keep_in_fridge >= payload.total_portions {
        return Err((
            StatusCode::BAD_REQUEST,
            "keep_in_fridge must be >= 0 and < total_portions".to_string(),
        ));
    }

    let product = queries::get_product_by_id(pool, payload.product_id, payload.client_id)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "Product not found".to_string()))?;

    if product.was_previously_frozen {
        return Err((
            StatusCode::BAD_REQUEST,
            "This product was previously frozen and cannot be re-frozen".to_string(),
        ));
    }

    let portions_to_freeze = payload.total_portions - payload.keep_in_fridge;
    let today = Utc::now().date_naive();

    let mut frozen_products = Vec::with_capacity(portions_to_freeze as usize);
    for _ in 0..portions_to_freeze {
        let frozen = queries::insert_frozen_product(
            pool,
            &product.barcode,
            &product.name,
            product.image.as_deref(),
            today,
            payload.client_id,
        )
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        frozen_products.push(frozen);
    }

    if payload.keep_in_fridge == 0 {
        let delete = crate::models::DeleteProduct {
            id: payload.product_id,
            client_id: payload.client_id,
        };
        queries::delete_product(&delete, pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    debug!(
        frozen_count = frozen_products.len(),
        kept_in_fridge = payload.keep_in_fridge,
        "service freeze_product completed"
    );

    Ok(frozen_products)
}

pub async fn unfreeze_product(
    payload: &UnfreezeProduct,
    pool: &PgPool,
) -> Result<Product, (StatusCode, String)> {
    debug!(frozen_product_id = payload.frozen_product_id, client_id = %payload.client_id, "service unfreeze_product called");

    let frozen =
        queries::get_frozen_product_by_id(pool, payload.frozen_product_id, payload.client_id)
            .await
            .map_err(|_| {
                (
                    StatusCode::NOT_FOUND,
                    "Frozen product not found".to_string(),
                )
            })?;

    let expiry_date = calculate_unfreeze_expiry();

    let product = queries::insert_product_unfrozen(
        pool,
        &frozen.barcode,
        &frozen.name,
        frozen.image.as_deref(),
        expiry_date,
        payload.client_id,
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    queries::delete_frozen_product(pool, payload.frozen_product_id, payload.client_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    debug!(
        new_product_id = product.id,
        expiry_date = %expiry_date,
        "service unfreeze_product completed"
    );

    Ok(product)
}

fn calculate_unfreeze_expiry() -> chrono::NaiveDate {
    let now = Utc::now().naive_utc();
    let plus_48h = now + chrono::Duration::hours(48);
    let base_date = plus_48h.date();
    let midnight = NaiveTime::from_hms_opt(0, 0, 0).unwrap();

    if plus_48h.time() == midnight {
        base_date
    } else {
        base_date.succ_opt().unwrap_or(base_date)
    }
}
