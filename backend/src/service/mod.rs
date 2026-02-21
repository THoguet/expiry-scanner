use std::error::Error;

use sqlx::PgPool;

pub mod barcode;
pub mod product;

pub async fn db_check(pool: &PgPool) -> Result<(), Box<dyn Error>> {
    sqlx::query("SELECT 1").execute(pool).await?;
    Ok(())
}
