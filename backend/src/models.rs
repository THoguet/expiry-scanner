use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use ts_rs::TS;
use uuid::Uuid;

#[derive(Serialize, FromRow, TS)]
#[ts(export)]
pub struct Product {
    pub id: i64,
    pub barcode: String,
    pub expiration_date: chrono::NaiveDate,
    pub created_at: DateTime<Utc>,
    pub client_id: Uuid,
}

#[derive(Deserialize, TS)]
#[ts(export)]
pub struct CreateProduct {
    pub barcode: String,
    pub expiration_date: chrono::NaiveDate,
    pub client_id: Uuid,
}

#[derive(Deserialize, TS)]
#[ts(export)]
pub struct DeleteProduct {
    pub id: i64,
    pub client_id: Uuid,
}
