use std::error::Error;

use sqlx::types::Json;
use sqlx::PgPool;

use crate::models::{
    Barcode, BarcodePrefill, CreateProduct, CreateUserProductInfo, DeleteProduct, EditProduct,
    Product, UserProductInfo,
};

#[derive(sqlx::FromRow)]
struct ProductWithOptionalBarcodeRow {
    #[sqlx(flatten)]
    product: Product,
    barcode_payload: Option<Json<Barcode>>,
}

impl ProductWithOptionalBarcodeRow {
    fn into_tuple(self) -> (Product, Option<Barcode>) {
        (self.product, self.barcode_payload.map(|barcode| barcode.0))
    }
}

pub async fn insert_product(
    new_product: &CreateProduct,
    pool: &PgPool,
) -> Result<Product, Box<dyn Error>> {
    let query =
        "insert into products (barcode, name, image, expiration_date, client_id) values ($1, $2, $3, $4, $5) returning *";

    let product = sqlx::query_as::<_, Product>(query)
        .bind(&new_product.barcode)
        .bind(&new_product.name)
        .bind(&new_product.image)
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
    let query = "select p.*, to_jsonb(b) as barcode_payload from products p left join barcode_database b on p.barcode = b.code where p.client_id=$1 order by p.expiration_date asc";

    let rows = sqlx::query_as::<_, ProductWithOptionalBarcodeRow>(query)
        .bind(&client_id)
        .fetch_all(pool)
        .await?;

    let products_with_barcodes = rows.into_iter().map(|row| row.into_tuple()).collect();

    Ok(products_with_barcodes)
}

pub async fn get_product_by_id_with_barcode(
    pool: &PgPool,
    product_id: i64,
    client_id: uuid::Uuid,
) -> Result<(Product, Option<crate::models::Barcode>), Box<dyn Error>> {
    let query = "select p.*, to_jsonb(b) as barcode_payload from products p left join barcode_database b on p.barcode = b.code where p.id=$1 and p.client_id=$2";

    let row = sqlx::query_as::<_, ProductWithOptionalBarcodeRow>(query)
        .bind(&product_id)
        .bind(&client_id)
        .fetch_one(pool)
        .await?;

    Ok(row.into_tuple())
}

pub async fn get_barcode_prefill(
    pool: &PgPool,
    barcode: &str,
) -> Result<Option<BarcodePrefill>, Box<dyn Error>> {
    let query = "select code as barcode, product_name as name, coalesce(image_url, image_small_url) as image from barcode_database where code=$1 limit 1";

    let prefill = sqlx::query_as::<_, BarcodePrefill>(query)
        .bind(barcode)
        .fetch_optional(pool)
        .await?;

    Ok(prefill)
}

pub async fn get_user_product_info_by_client(
    pool: &PgPool,
    barcode: &str,
    client_id: uuid::Uuid,
) -> Result<Option<UserProductInfo>, Box<dyn Error>> {
    let query = "select * from user_product_info where barcode=$1 and client_id=$2 order by updated_at desc limit 1";

    let info = sqlx::query_as::<_, UserProductInfo>(query)
        .bind(barcode)
        .bind(client_id)
        .fetch_optional(pool)
        .await?;

    Ok(info)
}

pub async fn get_user_product_info_global(
    pool: &PgPool,
    barcode: &str,
) -> Result<Option<UserProductInfo>, Box<dyn Error>> {
    let query = "select * from user_product_info where barcode=$1 order by updated_at desc limit 1";

    let info = sqlx::query_as::<_, UserProductInfo>(query)
        .bind(barcode)
        .fetch_optional(pool)
        .await?;

    Ok(info)
}

pub async fn upsert_user_product_info(
    new_info: &CreateUserProductInfo,
    pool: &PgPool,
) -> Result<UserProductInfo, Box<dyn Error>> {
    let query = "insert into user_product_info (barcode, name, image, client_id) values ($1, $2, $3, $4) on conflict (barcode, client_id) do update set name=excluded.name, image=excluded.image, updated_at=now() returning *";

    let info = sqlx::query_as::<_, UserProductInfo>(query)
        .bind(&new_info.barcode)
        .bind(&new_info.name)
        .bind(&new_info.image)
        .bind(&new_info.client_id)
        .fetch_one(pool)
        .await?;

    Ok(info)
}

pub async fn edit_product(
    edit_product: &EditProduct,
    pool: &PgPool,
) -> Result<Product, Box<dyn Error>> {
    let query = "update products set expiration_date=$1, barcode=$2, name=$3, image=$4 where id=$5 and client_id=$6 returning *";

    let product = sqlx::query_as::<_, Product>(query)
        .bind(&edit_product.expiration_date)
        .bind(&edit_product.barcode)
        .bind(&edit_product.name)
        .bind(&edit_product.image)
        .bind(&edit_product.id)
        .bind(&edit_product.client_id)
        .fetch_one(pool)
        .await?;

    Ok(product)
}
