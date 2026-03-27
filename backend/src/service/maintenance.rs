use std::error::Error;

use sqlx::PgPool;
use tracing::info;

use crate::queries;

#[derive(Debug, Clone, Copy)]
pub struct CleanupReport {
    pub refreshed_user_links: u64,
    pub deleted_stale_stock: u64,
    pub deleted_outlier_products: u64,
    pub deleted_orphan_user_product_info: u64,
}

pub async fn run_nightly_cleanup(pool: &PgPool) -> Result<CleanupReport, Box<dyn Error>> {
    let refreshed_user_links = queries::refresh_user_product_info_last_linked_at(pool).await?;
    let deleted_stale_stock = queries::delete_stale_stock(pool).await?;
    let deleted_outlier_products = queries::delete_outlier_products(pool).await?;
    let deleted_orphan_user_product_info = queries::delete_orphan_user_product_info(pool).await?;

    let report = CleanupReport {
        refreshed_user_links,
        deleted_stale_stock,
        deleted_outlier_products,
        deleted_orphan_user_product_info,
    };

    info!(
        refreshed_user_links = report.refreshed_user_links,
        deleted_stale_stock = report.deleted_stale_stock,
        deleted_outlier_products = report.deleted_outlier_products,
        deleted_orphan_user_product_info = report.deleted_orphan_user_product_info,
        "nightly cleanup completed"
    );

    Ok(report)
}
