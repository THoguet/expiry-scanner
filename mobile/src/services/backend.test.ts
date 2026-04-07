import { beforeEach, describe, expect, it, vi } from "vitest";

describe("backend service", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		Object.defineProperty(globalThis, "fetch", {
			value: vi.fn(),
			configurable: true,
		});
	});

	it("fetches products and stock with encoded client id", async () => {
		(globalThis.fetch as unknown as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: 1 }], text: async () => "" })
			.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: 2 }], text: async () => "" });
		const backend = await import("./backend");
		await backend.getProducts("a b");
		await backend.getStocks("a b");

		expect(globalThis.fetch).toHaveBeenNthCalledWith(
			1,
			expect.stringContaining("/products?client_id=a%20b"),
			expect.any(Object),
		);
		expect(globalThis.fetch).toHaveBeenNthCalledWith(
			2,
			expect.stringContaining("/stock?client_id=a%20b"),
			expect.any(Object),
		);
	});

	it("creates, edits and deletes product/stock with proper methods", async () => {
		(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ id: 1 }),
			text: async () => "",
		});

		const backend = await import("./backend");
		await backend.createProduct({ barcode: "1", name: "n", image: null, image_base64: null, expiration_date: "2026-04-01", client_id: "c" });
		await backend.editProduct({ id: 1n, barcode: "1", name: "n", image: null, expiration_date: "2026-04-01", client_id: "c" });
		await backend.deleteProduct({ id: 1n, client_id: "c" });
		await backend.createStock({ name: "s", desired_quantity: 1, current_quantity: 0, unit: null, location: null, client_id: "c" });
		await backend.editStock({ id: 1n, name: "s", desired_quantity: 1, current_quantity: 0, unit: null, location: null, client_id: "c" });
		await backend.deleteStock({ id: 1n, client_id: "c" });
		await backend.adjustStockByDelta(1n, { client_id: "c", delta: 1 });

		const calls = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
		expect(calls.some(([, init]) => (init as RequestInit).method === "POST")).toBe(true);
		expect(calls.some(([, init]) => (init as RequestInit).method === "PUT")).toBe(true);
		expect(calls.some(([, init]) => (init as RequestInit).method === "DELETE")).toBe(true);
	});

	it("handles 204 and non-ok errors", async () => {
		(globalThis.fetch as unknown as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce({ ok: true, status: 204, text: async () => "" })
			.mockResolvedValueOnce({ ok: false, status: 500, text: async () => "bad" });
		const backend = await import("./backend");
		await expect(backend.deleteProduct({ id: 7n, client_id: "c" })).resolves.toBeUndefined();
		await expect(backend.getProducts("c")).rejects.toThrow("Backend request failed (500): bad");
	});

	it("throws for unsafe bigint serialization", async () => {
		(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ id: 1 }),
			text: async () => "",
		});
		const backend = await import("./backend");
		await expect(
			backend.createProduct({
				barcode: "1",
				name: "n",
				image: null,
				image_base64: null,
				expiration_date: "2026-04-01",
				client_id: "c",
				id: 9007199254740993n,
			} as unknown as Parameters<typeof backend.createProduct>[0]),
		).rejects.toThrow("BigInt payload contains an unsafe integer value");
	});

	it("uploads product image through multipart endpoint", async () => {
		(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ image_url: "x" }),
			text: async () => "",
		});
		const backend = await import("./backend");
		const result = await backend.uploadProductImage("ean", "client", {} as File);
		expect(result).toEqual({ image_url: "x" });
		expect(globalThis.fetch).toHaveBeenCalledWith(
			expect.stringContaining("/products/image/ean?client_id=client"),
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("covers empty result guards and env base URL branch", async () => {
		(globalThis.fetch as unknown as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce({ ok: true, status: 200, json: async () => undefined, text: async () => "" })
			.mockResolvedValueOnce({ ok: true, status: 200, json: async () => undefined, text: async () => "" })
			.mockResolvedValueOnce({ ok: true, status: 200, json: async () => undefined, text: async () => "" })
			.mockResolvedValueOnce({ ok: true, status: 200, json: async () => undefined, text: async () => "" })
			.mockResolvedValueOnce({ ok: true, status: 200, json: async () => undefined, text: async () => "" });

		const env = import.meta.env as Record<string, unknown>;
		env.VITE_BACKEND_URL = "https://example.test/";

		const backend = await import("./backend");
		expect(await backend.getProducts("a")).toEqual([]);
		await expect(backend.createProduct({ barcode: "1", name: "n", image: null, image_base64: null, expiration_date: "2026-04-01", client_id: "c" })).rejects.toThrow("Failed to create product");
		await expect(backend.editProduct({ id: 1n, barcode: "1", name: "n", image: null, expiration_date: "2026-04-01", client_id: "c" })).rejects.toThrow("Failed to edit product");
		expect(await backend.getProductsWithBarcode("a")).toEqual([]);
		await expect(backend.getProductPrefill("ean", "c")).rejects.toThrow("Failed to get product prefill");

		expect(globalThis.fetch).toHaveBeenCalledWith(
			expect.stringContaining("https://example.test/products"),
			expect.any(Object),
		);
	});

	it("covers stock empty/update guards and upload error branch", async () => {
		(globalThis.fetch as unknown as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce({ ok: true, status: 200, json: async () => undefined, text: async () => "" })
			.mockResolvedValueOnce({ ok: true, status: 200, json: async () => undefined, text: async () => "" })
			.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}), text: async () => "bad image" })
			.mockResolvedValueOnce({ ok: true, status: 200, json: async () => undefined, text: async () => "" });
		const backend = await import("./backend");

		expect(await backend.getStocks("c")).toEqual([]);
		await expect(backend.createStock({ name: "x", desired_quantity: 1, current_quantity: 0, unit: null, location: null, client_id: "c" })).rejects.toThrow("Failed to create stock");
		await expect(backend.uploadProductImage("ean", "c", {} as File)).rejects.toThrow("Image upload failed (400): bad image");
		await expect(backend.adjustStockByDelta(1n, { client_id: "c", delta: 1 })).rejects.toThrow("Failed to adjust stock");
	});

	it("fetches frozen products and returns empty on undefined", async () => {
		(globalThis.fetch as unknown as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: 1 }], text: async () => "" })
			.mockResolvedValueOnce({ ok: true, status: 200, json: async () => undefined, text: async () => "" });
		const backend = await import("./backend");

		const result = await backend.getFrozenProducts("c");
		expect(result).toEqual([{ id: 1 }]);
		expect(globalThis.fetch).toHaveBeenCalledWith(
			expect.stringContaining("/freezer?client_id=c"),
			expect.any(Object),
		);

		const empty = await backend.getFrozenProducts("c");
		expect(empty).toEqual([]);
	});

	it("freezes a product and throws on empty response", async () => {
		(globalThis.fetch as unknown as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: 10 }], text: async () => "" })
			.mockResolvedValueOnce({ ok: true, status: 200, json: async () => undefined, text: async () => "" });
		const backend = await import("./backend");

		const frozen = await backend.freezeProduct({ product_id: 1n, client_id: "c", total_portions: 2, keep_in_fridge: 0 });
		expect(frozen).toEqual([{ id: 10 }]);
		expect(globalThis.fetch).toHaveBeenCalledWith(
			expect.stringContaining("/freezer/freeze"),
			expect.objectContaining({ method: "POST" }),
		);

		await expect(backend.freezeProduct({ product_id: 1n, client_id: "c", total_portions: 2, keep_in_fridge: 0 })).rejects.toThrow("Failed to freeze product");
	});

	it("unfreezes a product and throws on empty response", async () => {
		(globalThis.fetch as unknown as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 50 }), text: async () => "" })
			.mockResolvedValueOnce({ ok: true, status: 200, json: async () => undefined, text: async () => "" });
		const backend = await import("./backend");

		const product = await backend.unfreezeProduct({ frozen_product_id: 10n, client_id: "c" });
		expect(product).toEqual({ id: 50 });
		expect(globalThis.fetch).toHaveBeenCalledWith(
			expect.stringContaining("/freezer/unfreeze"),
			expect.objectContaining({ method: "POST" }),
		);

		await expect(backend.unfreezeProduct({ frozen_product_id: 10n, client_id: "c" })).rejects.toThrow("Failed to unfreeze product");
	});
});
