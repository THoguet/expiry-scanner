use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;

#[derive(Serialize, FromRow)]
pub struct Product {
    pub id: i32,
    pub barcode: String,
    pub expiration_date: chrono::NaiveDate,
    pub created_at: Option<chrono::NaiveDateTime>,
}

#[derive(Deserialize)]
pub struct CreateProduct {
    pub barcode: String,
    pub expiration_date: chrono::NaiveDate,
}
