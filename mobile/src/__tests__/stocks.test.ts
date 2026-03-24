import { describe, it, expect, vi, beforeEach } from "vitest";
import { useStocks } from "../services/stocks";
import type { Stock } from "../bindings/Stock";

// Mock the main module to provide a stable CLIENT_ID
vi.mock("../main", () => ({ CLIENT_ID: "test-client" }));

// Mock backend functions
vi.mock("../services/backend", () => ({
	getStocks: vi.fn(),
	createStock: vi.fn(),
	editStock: vi.fn(),
	deleteStock: vi.fn(),
	adjustStockByDelta: vi.fn(),
}));

import * as backend from "../services/backend";

const stock1: Stock = {
	id: 1n,
	name: "Milk",
	desired_quantity: 3,
	current_quantity: 1,
	unit: "L",
	location: "Fridge",
	created_at: "2024-01-01T00:00:00Z",
	updated_at: "2024-01-01T00:00:00Z",
};

const stock2: Stock = {
	id: 2n,
	name: "Eggs",
	desired_quantity: 12,
	current_quantity: 6,
	unit: null,
	location: null,
	created_at: "2024-01-01T00:00:00Z",
	updated_at: "2024-01-01T00:00:00Z",
};

describe("useStocks", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("loadStocks", () => {
		it("loads stocks from the backend and stores them", async () => {
			vi.mocked(backend.getStocks).mockResolvedValue([stock1, stock2]);

			const { stocks, loading, error, loadStocks } = useStocks("test-client");
			expect(loading.value).toBe(false);

			const promise = loadStocks();
			expect(loading.value).toBe(true);

			await promise;
			expect(loading.value).toBe(false);
			expect(error.value).toBeNull();
			expect(stocks.value).toEqual([stock1, stock2]);
		});

		it("sets error when backend fails", async () => {
			vi.mocked(backend.getStocks).mockRejectedValue(new Error("Network error"));

			const { error, loadStocks } = useStocks("test-client");
			await loadStocks();

			expect(error.value).toBe("Failed to load stocks");
		});
	});

	describe("addStock", () => {
		it("creates a stock and refreshes the list", async () => {
			vi.mocked(backend.createStock).mockResolvedValue(stock1);
			vi.mocked(backend.getStocks).mockResolvedValue([stock1]);

			const { addStock } = useStocks("test-client");
			const result = await addStock({
				name: "Milk",
				desired_quantity: 3,
				current_quantity: 1,
				unit: "L",
				location: "Fridge",
			});

			expect(result).toEqual(stock1);
			expect(backend.createStock).toHaveBeenCalledWith({
				name: "Milk",
				desired_quantity: 3,
				current_quantity: 1,
				unit: "L",
				location: "Fridge",
				client_id: "test-client",
			});
		});
	});

	describe("updateStock", () => {
		it("edits a stock and refreshes the list when refresh=true", async () => {
			const updated = { ...stock1, name: "Oat Milk" };
			vi.mocked(backend.editStock).mockResolvedValue(updated);
			vi.mocked(backend.getStocks).mockResolvedValue([updated]);

			const { stocks, updateStock } = useStocks("test-client");
			const result = await updateStock(1n, {
				name: "Oat Milk",
				desired_quantity: 3,
				current_quantity: 1,
				unit: "L",
				location: "Fridge",
			});

			expect(result.name).toBe("Oat Milk");
			expect(backend.getStocks).toHaveBeenCalled();
			expect(stocks.value[0].name).toBe("Oat Milk");
		});

		it("edits a stock and upserts locally when refresh=false", async () => {
			const updated = { ...stock1, name: "Oat Milk" };
			vi.mocked(backend.editStock).mockResolvedValue(updated);
			vi.mocked(backend.getStocks).mockResolvedValue([stock1, stock2]);

			// first load stocks
			const { stocks, loadStocks, updateStock } = useStocks("test-client");
			await loadStocks();

			vi.clearAllMocks();
			vi.mocked(backend.editStock).mockResolvedValue(updated);

			await updateStock(1n, { name: "Oat Milk", desired_quantity: 3, current_quantity: 1, unit: "L", location: "Fridge" }, { refresh: false });

			expect(backend.getStocks).not.toHaveBeenCalled();
			const found = stocks.value.find((s) => s.id === 1n);
			expect(found?.name).toBe("Oat Milk");
		});
	});

	describe("removeStockById", () => {
		it("deletes a stock and refreshes the list", async () => {
			vi.mocked(backend.deleteStock).mockResolvedValue(undefined);
			vi.mocked(backend.getStocks).mockResolvedValue([stock2]);

			const { stocks, loadStocks, removeStockById } = useStocks("test-client");
			vi.mocked(backend.getStocks).mockResolvedValue([stock1, stock2]);
			await loadStocks();

			vi.mocked(backend.getStocks).mockResolvedValue([stock2]);
			await removeStockById(1n);

			expect(backend.deleteStock).toHaveBeenCalledWith({ id: 1n, client_id: "test-client" });
			expect(stocks.value).toEqual([stock2]);
		});
	});

	describe("adjustStockQuantity", () => {
		it("calls adjustStockByDelta with the correct delta and refreshes the list", async () => {
			const adjusted = { ...stock1, current_quantity: 2 };
			vi.mocked(backend.adjustStockByDelta).mockResolvedValue(adjusted);
			vi.mocked(backend.getStocks).mockResolvedValue([adjusted]);

			const { adjustStockQuantity } = useStocks("test-client");
			const result = await adjustStockQuantity(1n, 1);

			expect(result.current_quantity).toBe(2);
			expect(backend.adjustStockByDelta).toHaveBeenCalledWith(1n, {
				client_id: "test-client",
				delta: 1,
			});
			expect(backend.getStocks).toHaveBeenCalled();
		});

		it("supports negative deltas for decrement", async () => {
			const adjusted = { ...stock1, current_quantity: 0 };
			vi.mocked(backend.adjustStockByDelta).mockResolvedValue(adjusted);
			vi.mocked(backend.getStocks).mockResolvedValue([adjusted]);

			const { adjustStockQuantity } = useStocks("test-client");
			await adjustStockQuantity(1n, -1);

			expect(backend.adjustStockByDelta).toHaveBeenCalledWith(1n, {
				client_id: "test-client",
				delta: -1,
			});
		});
	});
});
