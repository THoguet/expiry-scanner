use std::error::Error;

use sqlx::PgPool;

use crate::models::{CreateProduct, DeleteProduct, Product};

pub async fn insert_product(
    new_product: &CreateProduct,
    pool: &PgPool,
) -> Result<Product, Box<dyn Error>> {
    let query = "insert into products (barcode, expiration_date, client_id) values ($1, $2, $3) returning *";

    let product = sqlx::query_as::<_, Product>(query)
        .bind(&new_product.barcode)
        .bind(&new_product.expiration_date)
        .bind(&new_product.client_id)
        .fetch_one(pool)
        .await?;

    Ok(product)
}

pub async fn delete_product(
    delete_product: &DeleteProduct,
    pool: &PgPool,
) -> Result<(), Box<dyn Error>> {
    let query = "delete from products where id=$1 and client_id=$2";

    sqlx::query(query)
        .bind(&delete_product.id)
        .bind(&delete_product.client_id)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn list_products_with_client_id(
    pool: &PgPool,
    client_id: uuid::Uuid,
) -> Result<Vec<Product>, Box<dyn Error>> {
    let query = "select * from products where client_id=$1 order by expiration_date asc";

    let products = sqlx::query_as::<_, Product>(query)
        .bind(&client_id)
        .fetch_all(pool)
        .await?;

    Ok(products)
}

pub async fn list_join_product_barcode_barcode_code(
    pool: &PgPool,
    client_id: uuid::Uuid,
) -> Result<Vec<(Product, Option<crate::models::Barcode>)>, Box<dyn Error>> {
    let query = "select p.*, b.* from products p left join barcode_database b on p.barcode = b.code where p.client_id=$1 order by p.expiration_date asc";

    let rows = sqlx::query(query).bind(&client_id).fetch_all(pool).await?;

    let products_with_barcodes = rows
        .into_iter()
        .map(|row| {
            let product = sqlx::FromRow::from_row(&row).ok();
            let barcode = sqlx::FromRow::from_row(&row).ok();
            (product.unwrap(), barcode)
        })
        .collect();

    Ok(products_with_barcodes)
}

pub async fn get_product_by_id_with_barcode(
    pool: &PgPool,
    product_id: i64,
    client_id: uuid::Uuid,
) -> Result<(Product, Option<crate::models::Barcode>), Box<dyn Error>> {
    let query = "select p.*, b.* from products p left join barcode_database b on p.barcode = b.code where p.id=$1 and p.client_id=$2";

    let row = sqlx::query(query)
        .bind(&product_id)
        .bind(&client_id)
        .fetch_one(pool)
        .await?;

    let product = sqlx::FromRow::from_row(&row).ok();
    let barcode = sqlx::FromRow::from_row(&row).ok();

    Ok((product.unwrap(), barcode))
}
