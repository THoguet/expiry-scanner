import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "../bindings/Product";
import type { ProductWithBarcode } from "./backend";

const mockGetProductsWithBarcode = vi.fn();
const mockCreateProduct = vi.fn();
const mockDeleteProduct = vi.fn();
const mockEditProduct = vi.fn();
const mockGetProductPrefill = vi.fn();
const mockUploadProductImage = vi.fn();

const mockUpdateNotifications = vi.fn();
const mockCancelNotificationsForProduct = vi.fn();

vi.mock("/src/main.ts", () => ({ CLIENT_ID: "mock-client" }));

vi.mock("/src/services/backend.ts", () => ({
	getProductsWithBarcode: mockGetProductsWithBarcode,
	createProduct: mockCreateProduct,
	deleteProduct: mockDeleteProduct,
	editProduct: mockEditProduct,
	getProductPrefill: mockGetProductPrefill,
	uploadProductImage: mockUploadProductImage,
}));

vi.mock("/src/services/notifications.ts", () => ({
	updateNotifications: mockUpdateNotifications,
	cancelNotificationsForProduct: mockCancelNotificationsForProduct,
}));

function makeProduct(id: bigint, barcode: string): Product {
	return {
		id,
		barcode,
		name: "Product " + barcode,
		image: null,
		expiration_date: "2026-04-01",
		created_at: "2026-03-01T00:00:00Z",
		was_previously_frozen: false,
	};
}

function withBarcode(id: bigint, barcode: string): ProductWithBarcode {
	return [makeProduct(id, barcode), null] as unknown as ProductWithBarcode;
}

describe("products service", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		vi.resetModules();
		const { invalidateProductsCache } = await import("./products");
		invalidateProductsCache();
	});

	it("loads products and uses cache on repeated calls", async () => {
		const rows = [withBarcode(1n, "111")];
		mockGetProductsWithBarcode.mockResolvedValue(rows);
		const { useProducts } = await import("./products");
		const service = useProducts("client-cache");

		await service.loadProducts();
		await service.loadProducts();
		expect(mockGetProductsWithBarcode).toHaveBeenCalledTimes(1);
		expect(service.products.value).toEqual(rows);
	});

	it("forces refresh and invalidates cache per client", async () => {
		mockGetProductsWithBarcode
			.mockResolvedValueOnce([withBarcode(1n, "a")])
			.mockResolvedValueOnce([withBarcode(2n, "b")]);

		const { useProducts, invalidateProductsCache } = await import("./products");
		const service = useProducts("client-refresh");
		await service.loadProducts();
		invalidateProductsCache("client-refresh");
		await service.loadProducts();
		expect(mockGetProductsWithBarcode).toHaveBeenCalledTimes(2);
	});

	it("deduplicates concurrent in-flight loads", async () => {
		let resolveFn: ((value: ProductWithBarcode[]) => void) | undefined;
		mockGetProductsWithBarcode.mockImplementation(
			() =>
				new Promise<ProductWithBarcode[]>((resolve) => {
					resolveFn = resolve;
				}),
		);

		const { useProducts } = await import("./products");
		const service = useProducts("client-inflight");
		const p1 = service.loadProducts();
		const p2 = service.loadProducts();
		expect(mockGetProductsWithBarcode).toHaveBeenCalledTimes(1);

		if (resolveFn) resolveFn([withBarcode(9n, "999")]);
		await Promise.all([p1, p2]);
		expect(service.products.value[0][0].barcode).toBe("999");
	});

	it("handles load errors", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		mockGetProductsWithBarcode.mockRejectedValue(new Error("boom"));
		const { useProducts } = await import("./products");
		const service = useProducts("client-error");
		await service.loadProducts();
		expect(service.error.value).toBe("Failed to load products");
		expect(service.loading.value).toBe(false);
		errorSpy.mockRestore();
	});

	it("creates product and refreshes with notifications", async () => {
		const created = makeProduct(3n, "333");
		mockCreateProduct.mockResolvedValue(created);
		mockGetProductsWithBarcode.mockResolvedValue([withBarcode(3n, "333")]);
		const { addProduct } = await import("./products");

		const result = await addProduct({
			barcode: "333",
			name: "Bread",
			image: null,
			image_base64: null,
			expiration_date: "2026-04-01",
			client_id: "mock-client",
		});

		expect(result).toEqual(created);
		expect(mockUpdateNotifications).toHaveBeenCalled();
	});

	it("removes product and continues when notification cancel fails", async () => {
		const p = withBarcode(4n, "444");
		mockGetProductsWithBarcode.mockResolvedValue([p]);
		mockCancelNotificationsForProduct.mockRejectedValueOnce(new Error("warn"));
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const { useProducts, removeProduct } = await import("./products");
		await useProducts().loadProducts();

		await removeProduct({ id: 4n, client_id: "mock-client" });
		expect(mockDeleteProduct).toHaveBeenCalledWith({ id: 4n, client_id: "mock-client" });
		expect(mockUpdateNotifications).toHaveBeenCalled();
		warnSpy.mockRestore();
	});

	it("saves edited product and delegates prefill/image helpers", async () => {
		const edited = makeProduct(5n, "555");
		mockEditProduct.mockResolvedValue(edited);
		mockGetProductsWithBarcode.mockResolvedValue([withBarcode(5n, "555")]);
		mockGetProductPrefill.mockResolvedValue({ barcode: "555", name: "X", image: null, source: "none" });
		mockUploadProductImage.mockResolvedValue({ image_url: "url" });
		const { saveEditedProduct, useProducts } = await import("./products");
		const service = useProducts("client-delegate");

		const saved = await saveEditedProduct({
			id: 5n,
			barcode: "555",
			name: "Edited",
			image: null,
			expiration_date: "2026-04-01",
			client_id: "mock-client",
		});
		expect(saved).toEqual(edited);

		await service.getPrefill("555");
		await service.uploadImage("555", {} as File);
		expect(mockGetProductPrefill).toHaveBeenCalledWith("555", "client-delegate");
		expect(mockUploadProductImage).toHaveBeenCalledWith("555", "client-delegate", expect.anything());
	});
});
