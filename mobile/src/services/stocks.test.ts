import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Stock } from "../bindings/Stock";

const mockGetStocks = vi.fn();
const mockCreateStock = vi.fn();
const mockDeleteStock = vi.fn();
const mockEditStock = vi.fn();
const mockAdjustStockByDelta = vi.fn();

vi.mock("/src/main.ts", () => ({
	CLIENT_ID: "mock-client-id",
}));

vi.mock("/src/services/backend.ts", () => ({
	getStocks: mockGetStocks,
	createStock: mockCreateStock,
	deleteStock: mockDeleteStock,
	editStock: mockEditStock,
	adjustStockByDelta: mockAdjustStockByDelta,
}));

function makeStock(id: bigint, name: string): Stock {
	return {
		id,
		name,
		desired_quantity: 5,
		current_quantity: 2,
		unit: "kg",
		location: "pantry",
		created_at: "2026-03-25T10:00:00Z",
		updated_at: "2026-03-26T10:00:00Z",
	};
}

describe("useStocks", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	it("loads stocks successfully and clears errors", async () => {
		const list = [makeStock(1n, "Rice")];
		mockGetStocks.mockResolvedValueOnce(list);

		const { useStocks } = await import("./stocks");
		const { loadStocks, stocks, loading, error } = useStocks("client-load");

		error.value = "temporary";
		await loadStocks();

		expect(mockGetStocks).toHaveBeenCalledWith("client-load");
		expect(stocks.value).toEqual(list);
		expect(loading.value).toBe(false);
		expect(error.value).toBeNull();
	});

	it("sets error when loading stocks fails", async () => {
		const backendFailure = new Error("network down");
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		mockGetStocks.mockRejectedValueOnce(backendFailure);

		const { useStocks } = await import("./stocks");
		const { loadStocks, error, loading } = useStocks("client-fail");

		await loadStocks();

		expect(mockGetStocks).toHaveBeenCalledWith("client-fail");
		expect(error.value).toBe("Failed to load stocks");
		expect(loading.value).toBe(false);
		expect(errorSpy).toHaveBeenCalledWith(backendFailure);
		errorSpy.mockRestore();
	});

	it("refreshes via loadStocks", async () => {
		mockGetStocks.mockResolvedValueOnce([]);

		const { useStocks } = await import("./stocks");
		const { refreshStocks } = useStocks("client-refresh");

		await refreshStocks();

		expect(mockGetStocks).toHaveBeenCalledWith("client-refresh");
	});

	it("adds stock and refreshes list", async () => {
		const created = makeStock(10n, "Beans");
		const refreshed = [created, makeStock(11n, "Pasta")];
		mockCreateStock.mockResolvedValueOnce(created);
		mockGetStocks.mockResolvedValueOnce(refreshed);

		const { useStocks } = await import("./stocks");
		const { addStock, stocks } = useStocks("client-add");

		const result = await addStock({
			name: "Beans",
			desired_quantity: 4,
			current_quantity: 1,
			unit: "can",
			location: "cupboard",
		});

		expect(mockCreateStock).toHaveBeenCalledWith({
			name: "Beans",
			desired_quantity: 4,
			current_quantity: 1,
			unit: "can",
			location: "cupboard",
			client_id: "client-add",
		});
		expect(mockGetStocks).toHaveBeenCalledWith("client-add");
		expect(result).toEqual(created);
		expect(stocks.value).toEqual(refreshed);
	});

	it("refreshes and returns updated stock when backend edit returns empty body", async () => {
		const updatedStock = makeStock(1n, "Rice");

		mockEditStock.mockResolvedValueOnce(undefined);
		mockGetStocks.mockResolvedValueOnce([updatedStock]);

		const { useStocks } = await import("./stocks");
		const { updateStock, stocks } = useStocks("client-a");

		const result = await updateStock(1n, {
			name: "Rice",
			desired_quantity: 5,
			current_quantity: 2,
			unit: "kg",
			location: "pantry",
		});

		expect(mockEditStock).toHaveBeenCalledWith({
			id: 1n,
			name: "Rice",
			desired_quantity: 5,
			current_quantity: 2,
			unit: "kg",
			location: "pantry",
			client_id: "client-a",
		});
		expect(mockGetStocks).toHaveBeenCalledWith("client-a");
		expect(result).toEqual(updatedStock);
		expect(stocks.value).toEqual([updatedStock]);
	});

	it("returns backend updated stock if refresh does not include the stock id", async () => {
		const updatedStock = makeStock(3n, "Coffee");
		mockEditStock.mockResolvedValueOnce(updatedStock);
		mockGetStocks.mockResolvedValueOnce([]);

		const { useStocks } = await import("./stocks");
		const { updateStock } = useStocks("client-refresh-miss");

		const result = await updateStock(3n, {
			name: "Coffee",
			desired_quantity: 5,
			current_quantity: 2,
			unit: "kg",
			location: "pantry",
		});

		expect(result).toEqual(updatedStock);
	});

	it("throws when refresh returns no stock and backend response is empty", async () => {
		mockEditStock.mockResolvedValueOnce(undefined);
		mockGetStocks.mockResolvedValueOnce([]);

		const { useStocks } = await import("./stocks");
		const { updateStock } = useStocks("client-refresh-error");

		await expect(
			updateStock(4n, {
				name: "Salt",
				desired_quantity: 1,
				current_quantity: 0,
				unit: null,
				location: null,
			}),
		).rejects.toThrow("Failed to update stock");
	});

	it("upserts local state without refresh when backend returns updated stock", async () => {
		const updatedStock = makeStock(2n, "Milk");

		mockEditStock.mockResolvedValueOnce(updatedStock);

		const { useStocks } = await import("./stocks");
		const { updateStock, stocks } = useStocks("client-b");

		const result = await updateStock(
			2n,
			{
				name: "Milk",
				desired_quantity: 3,
				current_quantity: 1,
				unit: "bottle",
				location: "fridge",
			},
			{ refresh: false },
		);

		expect(mockGetStocks).not.toHaveBeenCalled();
		expect(result).toEqual(updatedStock);
		expect(stocks.value).toEqual([updatedStock]);
	});

	it("replaces an existing local stock entry when backend returns same id", async () => {
		const existing = makeStock(12n, "Old name");
		const updated = {
			...existing,
			name: "New name",
			current_quantity: 4,
		};

		mockGetStocks.mockResolvedValueOnce([existing]);
		mockEditStock.mockResolvedValueOnce(updated);

		const { useStocks } = await import("./stocks");
		const { loadStocks, updateStock, stocks } = useStocks("client-replace");
		await loadStocks();

		const result = await updateStock(
			12n,
			{
				name: "New name",
				desired_quantity: 5,
				current_quantity: 4,
				unit: "kg",
				location: "pantry",
			},
			{ refresh: false },
		);

		expect(result).toEqual(updated);
		expect(stocks.value).toEqual([updated]);
	});

	it("returns existing local stock when backend update body is empty and refresh is disabled", async () => {
		const existing = makeStock(5n, "Oil");
		mockGetStocks.mockResolvedValueOnce([existing]);
		mockEditStock.mockResolvedValueOnce(undefined);

		const { useStocks } = await import("./stocks");
		const { loadStocks, updateStock } = useStocks("client-existing-local");
		await loadStocks();

		const result = await updateStock(
			5n,
			{
				name: "Oil",
				desired_quantity: 5,
				current_quantity: 2,
				unit: "kg",
				location: "pantry",
			},
			{ refresh: false },
		);

		expect(result).toEqual(existing);
	});

	it("returns backend stock when backend id differs and refresh is disabled", async () => {
		const backendStock = makeStock(99n, "Unexpected-id");
		mockEditStock.mockResolvedValueOnce(backendStock);

		const { useStocks } = await import("./stocks");
		const { updateStock } = useStocks("client-id-mismatch");

		const result = await updateStock(
			6n,
			{
				name: "Sugar",
				desired_quantity: 2,
				current_quantity: 1,
				unit: "kg",
				location: "shelf",
			},
			{ refresh: false },
		);

		expect(result).toEqual(backendStock);
	});

	it("throws when refresh is disabled and neither local nor backend stock exists", async () => {
		mockEditStock.mockResolvedValueOnce(undefined);

		const { useStocks } = await import("./stocks");
		const { updateStock } = useStocks("client-no-local");

		await expect(
			updateStock(
				7n,
				{
					name: "Flour",
					desired_quantity: 1,
					current_quantity: 0,
					unit: null,
					location: null,
				},
				{ refresh: false },
			),
		).rejects.toThrow("Failed to update stock");
	});

	it("removes stock by id and refreshes", async () => {
		mockDeleteStock.mockResolvedValueOnce(undefined);
		mockGetStocks.mockResolvedValueOnce([]);

		const { useStocks } = await import("./stocks");
		const { removeStockById } = useStocks("client-remove");

		await removeStockById(8n);

		expect(mockDeleteStock).toHaveBeenCalledWith({
			id: 8n,
			client_id: "client-remove",
		});
		expect(mockGetStocks).toHaveBeenCalledWith("client-remove");
	});

	it("adjusts quantity and refreshes", async () => {
		const adjusted = makeStock(9n, "Tea");
		mockAdjustStockByDelta.mockResolvedValueOnce(adjusted);
		mockGetStocks.mockResolvedValueOnce([adjusted]);

		const { useStocks } = await import("./stocks");
		const { adjustStockQuantity } = useStocks("client-adjust");

		const result = await adjustStockQuantity(9n, -1);

		expect(mockAdjustStockByDelta).toHaveBeenCalledWith(9n, {
			client_id: "client-adjust",
			delta: -1,
		});
		expect(mockGetStocks).toHaveBeenCalledWith("client-adjust");
		expect(result).toEqual(adjusted);
	});

	it("uses default client id from main module when client id is not provided", async () => {
		mockGetStocks.mockResolvedValueOnce([]);

		const { useStocks } = await import("./stocks");
		const { loadStocks } = useStocks();

		await loadStocks();

		expect(mockGetStocks).toHaveBeenCalledWith("mock-client-id");
	});
});
