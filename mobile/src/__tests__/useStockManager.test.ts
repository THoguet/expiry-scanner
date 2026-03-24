import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Stock } from "../bindings/Stock";

// Mock Tauri APIs (not available in jsdom)
vi.mock("@tauri-apps/api/core", () => ({ isTauri: vi.fn().mockReturnValue(false) }));
vi.mock("@tauri-apps/api/path", () => ({ join: vi.fn(), tempDir: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ writeTextFile: vi.fn(), BaseDirectory: { Temp: "Temp" } }));
vi.mock("tauri-plugin-share", () => ({ shareFile: vi.fn() }));
vi.mock("../main", () => ({ CLIENT_ID: "test-client" }));

// Mock the stocks service so we control all backend interactions
const mockLoadStocks = vi.fn();
const mockAddStock = vi.fn();
const mockUpdateStock = vi.fn();
const mockRemoveStockById = vi.fn();
const mockAdjustStockQuantity = vi.fn();

import { ref } from "vue";

// Shared reactive stocks ref controlled per-test
let stocksRef = ref<Stock[]>([]);

vi.mock("../services/stocks", () => ({
	useStocks: vi.fn(() => ({
		stocks: stocksRef,
		loading: ref(false),
		error: ref<string | null>(null),
		loadStocks: mockLoadStocks,
		addStock: mockAddStock,
		updateStock: mockUpdateStock,
		removeStockById: mockRemoveStockById,
		adjustStockQuantity: mockAdjustStockQuantity,
	})),
}));

import { useStockManager } from "../composables/useStockManager";

const makeStock = (overrides: Partial<Stock> = {}): Stock => ({
	id: 1n,
	name: "Milk",
	desired_quantity: 3,
	current_quantity: 1,
	unit: "L",
	location: "Fridge",
	created_at: "2024-01-01T00:00:00Z",
	updated_at: "2024-01-01T00:00:00Z",
	...overrides,
});

describe("useStockManager", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		stocksRef = ref<Stock[]>([]);
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("increment", () => {
		it("calls adjustStockQuantity with delta +1", async () => {
			const stock = makeStock();
			const updated = makeStock({ current_quantity: 2 });
			mockAdjustStockQuantity.mockResolvedValue(updated);

			const { increment } = useStockManager();
			await increment(stock);

			expect(mockAdjustStockQuantity).toHaveBeenCalledWith(1n, 1);
		});

		it("sets save state to 'saving' then 'saved' on success", async () => {
			const stock = makeStock();
			mockAdjustStockQuantity.mockResolvedValue(makeStock({ current_quantity: 2 }));

			const { increment, getLineSaveState } = useStockManager();

			const promise = increment(stock);
			expect(getLineSaveState(stock.id)).toBe("saving");

			await promise;
			expect(getLineSaveState(stock.id)).toBe("saved");
		});

		it("sets save state to 'error' and sets errorMessage on failure", async () => {
			const stock = makeStock();
			mockAdjustStockQuantity.mockRejectedValue(new Error("Network error"));

			const { increment, getLineSaveState, errorMessage } = useStockManager();
			await increment(stock);

			expect(getLineSaveState(stock.id)).toBe("error");
			expect(errorMessage.value).toContain("increase stock");
		});

		it("does NOT call updateStock", async () => {
			const stock = makeStock();
			mockAdjustStockQuantity.mockResolvedValue(makeStock({ current_quantity: 2 }));

			const { increment } = useStockManager();
			await increment(stock);

			expect(mockUpdateStock).not.toHaveBeenCalled();
		});
	});

	describe("decrement", () => {
		it("calls adjustStockQuantity with delta -1", async () => {
			const stock = makeStock();
			const updated = makeStock({ current_quantity: 0 });
			mockAdjustStockQuantity.mockResolvedValue(updated);

			const { decrement } = useStockManager();
			await decrement(stock);

			expect(mockAdjustStockQuantity).toHaveBeenCalledWith(1n, -1);
		});

		it("sets save state to 'saving' then 'saved' on success", async () => {
			const stock = makeStock();
			mockAdjustStockQuantity.mockResolvedValue(makeStock({ current_quantity: 0 }));

			const { decrement, getLineSaveState } = useStockManager();

			const promise = decrement(stock);
			expect(getLineSaveState(stock.id)).toBe("saving");

			await promise;
			expect(getLineSaveState(stock.id)).toBe("saved");
		});

		it("sets save state to 'error' and sets errorMessage on failure", async () => {
			const stock = makeStock();
			mockAdjustStockQuantity.mockRejectedValue(new Error("Network error"));

			const { decrement, getLineSaveState, errorMessage } = useStockManager();
			await decrement(stock);

			expect(getLineSaveState(stock.id)).toBe("error");
			expect(errorMessage.value).toContain("decrease stock");
		});

		it("does NOT call updateStock", async () => {
			const stock = makeStock();
			mockAdjustStockQuantity.mockResolvedValue(makeStock({ current_quantity: 0 }));

			const { decrement } = useStockManager();
			await decrement(stock);

			expect(mockUpdateStock).not.toHaveBeenCalled();
		});
	});

	describe("save", () => {
		it("calls updateStock with normalized values", async () => {
			const stock = makeStock({ name: "  Milk  ", unit: " L ", location: "" });
			mockUpdateStock.mockResolvedValue(makeStock());

			const { save } = useStockManager();
			await save(stock);

			expect(mockUpdateStock).toHaveBeenCalledWith(
				1n,
				expect.objectContaining({
					name: "Milk",
					unit: "L",
					location: null,
				}),
				{ refresh: false },
			);
		});

		it("sets 'saved' state and statusMessage on success", async () => {
			const stock = makeStock();
			mockUpdateStock.mockResolvedValue(makeStock());

			const { save, getLineSaveState, statusMessage } = useStockManager();
			await save(stock);

			expect(getLineSaveState(stock.id)).toBe("saved");
			expect(statusMessage.value).toContain("saved");
		});

		it("sets 'error' state and errorMessage when name is empty", async () => {
			const stock = makeStock({ name: "   " });

			const { save, getLineSaveState, errorMessage } = useStockManager();
			await save(stock);

			expect(getLineSaveState(stock.id)).toBe("error");
			expect(errorMessage.value).toContain("required");
			expect(mockUpdateStock).not.toHaveBeenCalled();
		});

		it("sets 'error' state and errorMessage on backend failure", async () => {
			const stock = makeStock();
			mockUpdateStock.mockRejectedValue(new Error("Server error"));

			const { save, getLineSaveState, errorMessage } = useStockManager();
			await save(stock);

			expect(getLineSaveState(stock.id)).toBe("error");
			expect(errorMessage.value).toContain("save stock line");
		});
	});

	describe("createNewStock", () => {
		it("calls addStock with normalized values and resets the form", async () => {
			const newStockData = makeStock({ id: 3n, name: "Butter" });
			mockAddStock.mockResolvedValue(newStockData);
			mockLoadStocks.mockResolvedValue(undefined);

			const { createNewStock, newStock, statusMessage } = useStockManager();
			newStock.value = {
				name: " Butter ",
				desired_quantity: 2,
				current_quantity: 0,
				unit: "pack",
				location: "",
			};

			await createNewStock();

			expect(mockAddStock).toHaveBeenCalledWith(
				expect.objectContaining({ name: "Butter", unit: "pack", location: null }),
			);
			expect(newStock.value.name).toBe("");
			expect(statusMessage.value).toContain("added");
		});

		it("sets errorMessage when name is empty", async () => {
			const { createNewStock, newStock, errorMessage } = useStockManager();
			newStock.value.name = "   ";

			await createNewStock();

			expect(mockAddStock).not.toHaveBeenCalled();
			expect(errorMessage.value).toContain("required");
		});

		it("sets errorMessage on backend failure", async () => {
			mockAddStock.mockRejectedValue(new Error("Server error"));

			const { createNewStock, newStock, errorMessage } = useStockManager();
			newStock.value.name = "Butter";

			await createNewStock();

			expect(errorMessage.value).toContain("add stock line");
		});
	});

	describe("remove", () => {
		it("calls removeStockById and sets statusMessage on success", async () => {
			mockRemoveStockById.mockResolvedValue(undefined);

			const { remove, statusMessage } = useStockManager();
			await remove(1n);

			expect(mockRemoveStockById).toHaveBeenCalledWith(1n);
			expect(statusMessage.value).toContain("deleted");
		});

		it("sets errorMessage on failure", async () => {
			mockRemoveStockById.mockRejectedValue(new Error("Server error"));

			const { remove, errorMessage } = useStockManager();
			await remove(1n);

			expect(errorMessage.value).toContain("delete stock line");
		});
	});

	describe("quantitySummary", () => {
		it("formats quantity with unit", () => {
			const stock = makeStock({ current_quantity: 1, desired_quantity: 3, unit: "L", location: null });
			const { quantitySummary } = useStockManager();
			expect(quantitySummary(stock)).toBe("1/3 L");
		});

		it("formats quantity without unit", () => {
			const stock = makeStock({ current_quantity: 2, desired_quantity: 5, unit: null, location: null });
			const { quantitySummary } = useStockManager();
			expect(quantitySummary(stock)).toBe("2/5");
		});

		it("includes location when present", () => {
			const stock = makeStock({ current_quantity: 1, desired_quantity: 3, unit: "L", location: "Fridge" });
			const { quantitySummary } = useStockManager();
			expect(quantitySummary(stock)).toBe("1/3 L in Fridge");
		});
	});

	describe("getStockStateClass", () => {
		it("returns 'ok' when stock is fully stocked", () => {
			const stock = makeStock({ current_quantity: 3, desired_quantity: 3 });
			const { getStockStateClass } = useStockManager();
			expect(getStockStateClass(stock)).toBe("ok");
		});

		it("returns 'warning' when 1-2 units are missing", () => {
			const stock = makeStock({ current_quantity: 1, desired_quantity: 3 });
			const { getStockStateClass } = useStockManager();
			expect(getStockStateClass(stock)).toBe("warning");
		});

		it("returns 'critical' when 3 or more units are missing", () => {
			const stock = makeStock({ current_quantity: 0, desired_quantity: 3 });
			const { getStockStateClass } = useStockManager();
			expect(getStockStateClass(stock)).toBe("critical");
		});
	});

	describe("getStockStateLabel", () => {
		it("returns 'Stocked' when fully stocked", () => {
			const stock = makeStock({ current_quantity: 3, desired_quantity: 3 });
			const { getStockStateLabel } = useStockManager();
			expect(getStockStateLabel(stock)).toBe("Stocked");
		});

		it("returns 'Missing N unit' with unit", () => {
			const stock = makeStock({ current_quantity: 1, desired_quantity: 3, unit: "L" });
			const { getStockStateLabel } = useStockManager();
			expect(getStockStateLabel(stock)).toBe("Missing 2 L");
		});

		it("returns 'Missing N' without unit", () => {
			const stock = makeStock({ current_quantity: 1, desired_quantity: 3, unit: null });
			const { getStockStateLabel } = useStockManager();
			expect(getStockStateLabel(stock)).toBe("Missing 2");
		});
	});

	describe("toggleLineView / isLineDetailed", () => {
		it("toggles the detailed view for a stock", () => {
			const { toggleLineView, isLineDetailed } = useStockManager();
			expect(isLineDetailed(1n)).toBe(false);
			toggleLineView(1n);
			expect(isLineDetailed(1n)).toBe(true);
			toggleLineView(1n);
			expect(isLineDetailed(1n)).toBe(false);
		});
	});
});
