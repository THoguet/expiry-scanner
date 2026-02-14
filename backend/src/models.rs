use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

#[derive(Serialize, FromRow)]
pub struct Product {
    pub id: i64,
    pub barcode: String,
    pub expiration_date: chrono::NaiveDate,
    pub created_at: Option<DateTime<Utc>>,
    pub client_id: Uuid,
}

#[derive(Deserialize)]
pub struct CreateProduct {
    pub barcode: String,
    pub expiration_date: chrono::NaiveDate,
    pub client_id: Uuid,
}

#[derive(Deserialize)]
pub struct DeleteProduct {
    pub id: i64,
    pub client_id: Uuid,
}
