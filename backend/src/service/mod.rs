use std::error::Error;

use sqlx::PgPool;
use tracing::debug;

pub mod barcode;
pub mod freezer;
pub mod maintenance;
pub mod product;
pub mod stock;

pub async fn db_check(pool: &PgPool) -> Result<(), Box<dyn Error>> {
    debug!("service db_check started");
    sqlx::query("SELECT 1").execute(pool).await?;
    debug!("service db_check completed");
    Ok(())
}
