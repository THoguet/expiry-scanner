import type { CreateProduct } from "../bindings/CreateProduct";
import type { DeleteProduct } from "../bindings/DeleteProduct";
import type { Product } from "../bindings/Product";
import type { Barcode } from "../bindings/Barcode";
import { EditProduct } from "../bindings/EditProduct";
import type { ProductPrefill } from "../bindings/ProductPrefill";
import type { UploadProductImageResponse } from "../bindings/UploadProductImageResponse";
import type { Stock } from "../bindings/Stock";
import type { CreateStock } from "../bindings/CreateStock";
import type { EditStock } from "../bindings/EditStock";
import type { DeleteStock } from "../bindings/DeleteStock";
import type { AdjustStockDelta } from "../bindings/AdjustStockDelta";

const DEFAULT_BACKEND_URL = "https://expiry.nessar.fr";

function getBaseUrl(): string {
	const configuredUrl = import.meta.env.VITE_BACKEND_URL?.trim();
	if (!configuredUrl) {
		return DEFAULT_BACKEND_URL;
	}

	return configuredUrl.replace(/\/$/, "");
}

function stringifyPayload(payload: unknown): string {
	return JSON.stringify(payload, (_key, value) => {
		if (typeof value !== "bigint") return value;

		const asNumber = Number(value);
		if (!Number.isSafeInteger(asNumber)) {
			throw new Error("BigInt payload contains an unsafe integer value");
		}

		return asNumber;
	});
}

async function request<T>(path: string, init?: RequestInit): Promise<T | undefined> {
	const response = await fetch(`${getBaseUrl()}${path}`, {
		headers: {
			"Content-Type": "application/json",
			...(init?.headers ?? {}),
		},
		...init,
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Backend request failed (${response.status}): ${body}`);
	}

	if (response.status === 204) {
		return undefined;
	}

	return response.json() as Promise<T>;
}


export async function getProducts(clientId: string): Promise<Product[]> {
	const products = await request<Product[]>(`/products?client_id=${encodeURIComponent(clientId)}`);
	if (!products) return [];
	return products;
}

export async function createProduct(payload: CreateProduct): Promise<Product> {
	const created = await request<Product>("/products", {
		method: "POST",
		body: stringifyPayload(payload),
	});

	if (!created) {
		throw new Error("Failed to create product");
	}

	return created;
}

export async function deleteProduct(payload: DeleteProduct): Promise<void> {
	await request<void>("/products", {
		method: "DELETE",
		body: stringifyPayload(payload),
	});
}

export async function editProduct(payload: EditProduct): Promise<Product> {
	const updated = await request<Product>("/products", {
		method: "PUT",
		body: stringifyPayload(payload),
	});

	if (!updated) {
		throw new Error("Failed to edit product");
	}

	return updated;
}

export type ProductWithBarcode = [Product, Barcode | null];

export async function getProductsWithBarcode(clientId: string): Promise<ProductWithBarcode[]> {
	const products = await request<ProductWithBarcode[]>(`/products/with-barcode?client_id=${encodeURIComponent(clientId)}`);
	if (!products) return [];
	return products;
}

export async function getProductPrefill(
	barcode: string,
	clientId: string,
): Promise<ProductPrefill> {
	const prefill = await request<ProductPrefill>(
		`/products/prefill/${encodeURIComponent(barcode)}?client_id=${encodeURIComponent(clientId)}`,
	);

	if (!prefill) {
		throw new Error("Failed to get product prefill");
	}

	return prefill;
}

export async function uploadProductImage(
	barcode: string,
	clientId: string,
	imageFile: File,
): Promise<UploadProductImageResponse> {
	const formData = new FormData();
	formData.append("image", imageFile);

	const baseUrl = import.meta.env.VITE_BACKEND_URL?.trim() || "https://expiry.nessar.fr";
	const response = await fetch(
		`${baseUrl.replace(/\/$/, "")}/products/image/${encodeURIComponent(barcode)}?client_id=${encodeURIComponent(clientId)}`,
		{
			method: "POST",
			body: formData,
		},
	);

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Image upload failed (${response.status}): ${body}`);
	}

	const result = (await response.json()) as UploadProductImageResponse;
	return result;
}

export async function getStocks(clientId: string): Promise<Stock[]> {
	const stocks = await request<Stock[]>(`/stock?client_id=${encodeURIComponent(clientId)}`);
	if (!stocks) return [];
	return stocks;
}

export async function createStock(payload: CreateStock): Promise<Stock> {
	const created = await request<Stock>("/stock", {
		method: "POST",
		body: stringifyPayload(payload),
	});

	if (!created) {
		throw new Error("Failed to create stock");
	}

	return created;
}

export async function editStock(payload: EditStock): Promise<Stock> {
	const updated = await request<Stock>("/stock", {
		method: "PUT",
		body: stringifyPayload(payload),
	});

	if (!updated) {
		throw new Error("Failed to edit stock");
	}

	return updated;
}

export async function deleteStock(payload: DeleteStock): Promise<void> {
	await request<void>("/stock", {
		method: "DELETE",
		body: stringifyPayload(payload),
	});
}

export async function adjustStockByDelta(stockId: Stock["id"], payload: AdjustStockDelta): Promise<Stock> {
	const updated = await request<Stock>(`/stock/${encodeURIComponent(stockId.toString())}/delta`, {
		method: "POST",
		body: stringifyPayload(payload),
	});

	if (!updated) {
		throw new Error("Failed to adjust stock");
	}

	return updated;
}