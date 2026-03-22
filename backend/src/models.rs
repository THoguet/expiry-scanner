use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use ts_rs::TS;
use uuid::Uuid;

#[derive(Serialize, FromRow, TS, Debug)]
#[ts(export)]
#[allow(dead_code)]
pub struct Product {
    pub id: i64,
    pub barcode: String,
    pub name: String,
    pub image: Option<String>,
    pub expiration_date: chrono::NaiveDate,
    pub created_at: DateTime<Utc>,
    #[allow(dead_code)]
    #[serde(skip_serializing)]
    #[ts(skip)]
    pub client_id: Uuid,
}

#[derive(Deserialize, TS)]
#[ts(export)]
pub struct CreateProduct {
    pub barcode: String,
    pub name: String,
    pub image: Option<String>,
    pub image_base64: Option<String>,
    pub expiration_date: chrono::NaiveDate,
    pub client_id: Uuid,
}

#[derive(Deserialize, TS)]
#[ts(export)]
pub struct EditProduct {
    pub id: i64,
    pub barcode: String,
    pub name: String,
    pub image: Option<String>,
    pub expiration_date: chrono::NaiveDate,
    pub client_id: Uuid,
}

#[derive(Deserialize, TS)]
#[ts(export)]
pub struct DeleteProduct {
    pub id: i64,
    pub client_id: Uuid,
}

#[derive(Serialize, Deserialize, FromRow, TS, Debug)]
#[ts(export)]
#[allow(dead_code)]
pub struct UserProductInfo {
    pub id: i64,
    pub barcode: String,
    pub name: Option<String>,
    pub image: Option<String>,
    #[allow(dead_code)]
    #[serde(skip_serializing)]
    #[ts(skip)]
    pub client_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Deserialize, TS)]
#[ts(export)]
pub struct CreateUserProductInfo {
    pub barcode: String,
    pub name: Option<String>,
    pub image: Option<String>,
    pub client_id: Uuid,
}

#[derive(Serialize, TS, Debug)]
#[ts(export)]
pub struct ProductPrefill {
    pub barcode: String,
    pub name: Option<String>,
    pub image: Option<String>,
    pub source: String,
}

#[derive(Serialize, TS, Debug)]
#[ts(export)]
pub struct UploadProductImageResponse {
    pub image: String,
}

#[derive(FromRow, Debug)]
pub struct BarcodePrefill {
    pub barcode: String,
    pub name: Option<String>,
    pub image: Option<String>,
}

#[derive(Serialize, Deserialize, FromRow, TS, Debug)]
#[ts(export)]
pub struct Barcode {
    pub id: i64,
    pub code: String,
    pub url: Option<String>,
    pub creator: Option<String>,
    pub created_t: Option<i64>,
    pub created_datetime: Option<DateTime<Utc>>,
    pub last_modified_t: Option<i64>,
    pub last_modified_datetime: Option<DateTime<Utc>>,
    pub last_modified_by: Option<String>,
    pub last_updated_t: Option<i64>,
    pub last_updated_datetime: Option<DateTime<Utc>>,
    pub product_name: Option<String>,
    pub abbreviated_product_name: Option<String>,
    pub generic_name: Option<String>,
    pub quantity: Option<String>,
    pub packaging: Option<String>,
    pub brands: Option<String>,
    pub categories: Option<String>,
    pub countries: Option<String>,
    pub countries_en: Option<String>,
    pub ingredients_text: Option<String>,
    pub nutriscore_score: Option<i32>,
    pub nutriscore_grade: Option<String>,
    pub nova_group: Option<i32>,
    pub image_url: Option<String>,
    pub image_small_url: Option<String>,
    pub last_image_t: Option<i64>,
    pub last_image_datetime: Option<DateTime<Utc>>,
    pub main_category: Option<String>,
    pub main_category_en: Option<String>,
}
