import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FrozenProduct } from "../bindings/FrozenProduct";
import type { Product } from "../bindings/Product";

const mockGetFrozenProducts = vi.fn();
const mockFreezeProduct = vi.fn();
const mockUnfreezeProduct = vi.fn();

const mockLoadProducts = vi.fn();
const mockProducts = { value: [] as Product[] };
const mockInvalidateProductsCache = vi.fn();
const mockUpdateNotifications = vi.fn();

vi.mock("/src/main.ts", () => ({ CLIENT_ID: "mock-client" }));

vi.mock("/src/services/backend.ts", () => ({
	getFrozenProducts: mockGetFrozenProducts,
	freezeProduct: mockFreezeProduct,
	unfreezeProduct: mockUnfreezeProduct,
}));

vi.mock("/src/services/products.ts", () => ({
	invalidateProductsCache: mockInvalidateProductsCache,
	useProducts: () => ({
		loadProducts: mockLoadProducts,
		products: mockProducts,
	}),
}));

vi.mock("/src/services/notifications.ts", () => ({
	updateNotifications: mockUpdateNotifications,
}));

function makeFrozenProduct(id: bigint): FrozenProduct {
	return {
		id,
		barcode: "123456",
		name: "Frozen Peas",
		image: null,
		frozen_date: "2026-04-01",
		created_at: "2026-04-01T12:00:00Z",
	};
}

function makeProduct(id: bigint): Product {
	return {
		id,
		barcode: "123456",
		name: "Thawed Peas",
		image: null,
		expiration_date: "2026-04-10",
		created_at: "2026-04-01T00:00:00Z",
		was_previously_frozen: true,
	};
}

describe("freezer service", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	async function getFreezer() {
		const mod = await import("./freezer");
		return mod.useFreezer("mock-client");
	}

	it("loads frozen products successfully", async () => {
		const frozen = [makeFrozenProduct(1n)];
		mockGetFrozenProducts.mockResolvedValue(frozen);

		const freezer = await getFreezer();
		await freezer.loadFrozenProducts();

		expect(mockGetFrozenProducts).toHaveBeenCalledWith("mock-client");
		expect(freezer.frozenProducts.value).toEqual(frozen);
		expect(freezer.loading.value).toBe(false);
		expect(freezer.error.value).toBeNull();
	});

	it("sets error on load failure", async () => {
		mockGetFrozenProducts.mockRejectedValue(new Error("network failure"));

		const freezer = await getFreezer();
		await freezer.loadFrozenProducts();

		expect(freezer.error.value).toBe("Failed to load frozen products");
		expect(freezer.loading.value).toBe(false);
	});

	it("refreshFrozenProducts delegates to loadFrozenProducts", async () => {
		const frozen = [makeFrozenProduct(2n)];
		mockGetFrozenProducts.mockResolvedValue(frozen);

		const freezer = await getFreezer();
		await freezer.refreshFrozenProducts();

		expect(mockGetFrozenProducts).toHaveBeenCalledWith("mock-client");
		expect(freezer.frozenProducts.value).toEqual(frozen);
	});

	it("freezes a product and refreshes state", async () => {
		const frozenResult = [makeFrozenProduct(10n), makeFrozenProduct(11n)];
		mockFreezeProduct.mockResolvedValue(frozenResult);
		mockGetFrozenProducts.mockResolvedValue(frozenResult);
		mockLoadProducts.mockResolvedValue(undefined);

		const freezer = await getFreezer();
		const result = await freezer.freeze(99n, 3, 1);

		expect(mockFreezeProduct).toHaveBeenCalledWith({
			product_id: 99n,
			client_id: "mock-client",
			total_portions: 3,
			keep_in_fridge: 1,
		});
		expect(result).toEqual(frozenResult);
		expect(mockInvalidateProductsCache).toHaveBeenCalledWith("mock-client");
		expect(mockLoadProducts).toHaveBeenCalledWith(true);
		expect(mockUpdateNotifications).toHaveBeenCalled();
	});

	it("unfreezes a product and refreshes state", async () => {
		const product = makeProduct(50n);
		mockUnfreezeProduct.mockResolvedValue(product);
		mockGetFrozenProducts.mockResolvedValue([]);
		mockLoadProducts.mockResolvedValue(undefined);

		const freezer = await getFreezer();
		const result = await freezer.unfreeze(10n);

		expect(mockUnfreezeProduct).toHaveBeenCalledWith({
			frozen_product_id: 10n,
			client_id: "mock-client",
		});
		expect(result).toEqual(product);
		expect(mockInvalidateProductsCache).toHaveBeenCalledWith("mock-client");
		expect(mockLoadProducts).toHaveBeenCalledWith(true);
		expect(mockUpdateNotifications).toHaveBeenCalled();
	});

	it("propagates freeze error", async () => {
		mockFreezeProduct.mockRejectedValue(new Error("freeze failed"));

		const freezer = await getFreezer();
		await expect(freezer.freeze(1n, 2, 0)).rejects.toThrow("freeze failed");
	});

	it("propagates unfreeze error", async () => {
		mockUnfreezeProduct.mockRejectedValue(new Error("unfreeze failed"));

		const freezer = await getFreezer();
		await expect(freezer.unfreeze(1n)).rejects.toThrow("unfreeze failed");
	});

	it("uses default CLIENT_ID when no argument is passed", async () => {
		mockGetFrozenProducts.mockResolvedValue([]);

		const mod = await import("./freezer");
		const freezer = mod.useFreezer();
		await freezer.loadFrozenProducts();

		expect(mockGetFrozenProducts).toHaveBeenCalledWith("mock-client");
	});
});
