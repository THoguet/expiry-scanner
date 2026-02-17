import type { CreateProduct } from "../bindings/CreateProduct";
import type { DeleteProduct } from "../bindings/DeleteProduct";
import type { Product } from "../bindings/Product";

const DEFAULT_BACKEND_URL = "http://192.168.1.12:3000";

function getBaseUrl(): string {
	const configuredUrl = import.meta.env.VITE_BACKEND_URL?.trim();
	if (!configuredUrl) {
		return DEFAULT_BACKEND_URL;
	}

	return configuredUrl.replace(/\/$/, "");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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
		return undefined as T;
	}

	return response.json() as Promise<T>;
}

function normalizeProduct(raw: Product): Product {
	return {
		...raw,
		id: BigInt(raw.id),
	};
}

function serializeBigInt(value: bigint): string {
	return value.toString();
}

export async function getProducts(clientId: string): Promise<Product[]> {
	const products = await request<Product[]>(`/products?client_id=${encodeURIComponent(clientId)}`);
	return products.map(normalizeProduct);
}

export async function createProduct(payload: CreateProduct): Promise<Product> {
	const created = await request<Product>("/products", {
		method: "POST",
		body: JSON.stringify(payload),
	});

	return normalizeProduct(created);
}

export async function deleteProduct(payload: DeleteProduct): Promise<void> {
	await request<void>("/products", {
		method: "DELETE",
		body: JSON.stringify({
			...payload,
			id: serializeBigInt(payload.id),
		}),
	});
}
