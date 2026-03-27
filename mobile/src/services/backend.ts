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
import { logger } from "./logger";

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
	const baseUrl = getBaseUrl();
	const url = `${baseUrl}${path}`;
	const method = init?.method ?? "GET";
	const startedAt = Date.now();

	logger.trace("Backend request started", {
		method,
		path,
		url,
	});

	try {
		const response = await fetch(url, {
			headers: {
				"Content-Type": "application/json",
				...(init?.headers ?? {}),
			},
			...init,
		});

		if (!response.ok) {
			const body = await response.text();
			const durationMs = Date.now() - startedAt;
			logger.error("Backend request failed", {
				method,
				path,
				status: response.status,
				durationMs,
				body,
			});
			throw new Error(`Backend request failed (${response.status}): ${body}`);
		}

		if (response.status === 204) {
			logger.debug("Backend request completed with no content", {
				method,
				path,
				durationMs: Date.now() - startedAt,
			});
			return undefined;
		}

		const payload = (await response.json()) as T;
		logger.trace("Backend request succeeded", {
			method,
			path,
			status: response.status,
			durationMs: Date.now() - startedAt,
		});
		return payload;
	} catch (error) {
		logger.error("Backend request raised an exception", {
			method,
			path,
			durationMs: Date.now() - startedAt,
			error,
		});
		throw error;
	}
}


export async function getProducts(clientId: string): Promise<Product[]> {
	logger.debug("Loading products", { clientId });
	const products = await request<Product[]>(`/products?client_id=${encodeURIComponent(clientId)}`);
	if (!products) return [];
	return products;
}

export async function createProduct(payload: CreateProduct): Promise<Product> {
	logger.info("Creating product", {
		barcode: payload.barcode,
		clientId: payload.client_id,
	});
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
	logger.info("Deleting product", {
		productId: payload.id.toString(),
		clientId: payload.client_id,
	});
	await request<void>("/products", {
		method: "DELETE",
		body: stringifyPayload(payload),
	});
}

export async function editProduct(payload: EditProduct): Promise<Product> {
	logger.info("Editing product", {
		productId: payload.id.toString(),
		barcode: payload.barcode,
		clientId: payload.client_id,
	});
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
	logger.debug("Loading products with barcode", { clientId });
	const products = await request<ProductWithBarcode[]>(`/products/with-barcode?client_id=${encodeURIComponent(clientId)}`);
	if (!products) return [];
	return products;
}

export async function getProductPrefill(
	barcode: string,
	clientId: string,
): Promise<ProductPrefill> {
	logger.debug("Loading product prefill", { barcode, clientId });
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
	logger.info("Uploading product image", {
		barcode,
		clientId,
		sizeBytes: imageFile.size,
	});
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
		logger.error("Image upload failed", {
			barcode,
			clientId,
			status: response.status,
			body,
		});
		throw new Error(`Image upload failed (${response.status}): ${body}`);
	}

	const result = (await response.json()) as UploadProductImageResponse;
	logger.debug("Image upload succeeded", {
		barcode,
		clientId,
		imageUrl: result.image,
	});
	return result;
}

export async function getStocks(clientId: string): Promise<Stock[]> {
	logger.debug("Loading stocks", { clientId });
	const stocks = await request<Stock[]>(`/stock?client_id=${encodeURIComponent(clientId)}`);
	if (!stocks) return [];
	return stocks;
}

export async function createStock(payload: CreateStock): Promise<Stock> {
	logger.info("Creating stock", {
		name: payload.name,
		clientId: payload.client_id,
	});
	const created = await request<Stock>("/stock", {
		method: "POST",
		body: stringifyPayload(payload),
	});

	if (!created) {
		throw new Error("Failed to create stock");
	}

	return created;
}

export async function editStock(payload: EditStock): Promise<Stock | undefined> {
	logger.info("Editing stock", {
		stockId: payload.id.toString(),
		name: payload.name,
		clientId: payload.client_id,
	});
	const updated = await request<Stock>("/stock", {
		method: "PUT",
		body: stringifyPayload(payload),
	});

	return updated;
}

export async function deleteStock(payload: DeleteStock): Promise<void> {
	logger.info("Deleting stock", {
		stockId: payload.id.toString(),
		clientId: payload.client_id,
	});
	await request<void>("/stock", {
		method: "DELETE",
		body: stringifyPayload(payload),
	});
}

export async function adjustStockByDelta(stockId: Stock["id"], payload: AdjustStockDelta): Promise<Stock> {
	logger.debug("Adjusting stock by delta", {
		stockId: stockId.toString(),
		delta: payload.delta,
		clientId: payload.client_id,
	});
	const updated = await request<Stock>(`/stock/${encodeURIComponent(stockId.toString())}/delta`, {
		method: "POST",
		body: stringifyPayload(payload),
	});

	if (!updated) {
		throw new Error("Failed to adjust stock");
	}

	return updated;
}