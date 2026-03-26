import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import type { Stock } from "../bindings/Stock";

vi.mock("vue", async () => {
	const actual = await vi.importActual<typeof import("vue")>("vue");
	return {
		...actual,
		onMounted: (cb: () => void) => cb(),
		onBeforeUnmount: (cb: () => void) => cb(),
	};
});

const mockLoadStocks = vi.fn().mockResolvedValue(undefined);
const mockAddStock = vi.fn();
const mockUpdateStock = vi.fn();
const mockRemoveStockById = vi.fn();

const mockIsTauri = vi.fn(() => false);
const mockWriteTextFile = vi.fn();
const mockTempDir = vi.fn().mockResolvedValue("/tmp");
const mockJoin = vi.fn().mockResolvedValue("/tmp/list.txt");
const mockShareFile = vi.fn();

const stocksRef = ref<Stock[]>([]);
const loadingRef = ref(false);
const errorRef = ref<string | null>(null);

vi.mock("/src/services/stocks.ts", () => ({
	useStocks: () => ({
		stocks: stocksRef,
		loading: loadingRef,
		error: errorRef,
		loadStocks: mockLoadStocks,
		addStock: mockAddStock,
		updateStock: mockUpdateStock,
		removeStockById: mockRemoveStockById,
	}),
}));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: mockIsTauri }));
vi.mock("@tauri-apps/plugin-fs", () => ({ BaseDirectory: { Temp: "Temp" }, writeTextFile: mockWriteTextFile }));
vi.mock("@tauri-apps/api/path", () => ({ tempDir: mockTempDir, join: mockJoin }));
vi.mock("tauri-plugin-share", () => ({ shareFile: mockShareFile }));

function makeStock(id: bigint, name: string, desired: number, current: number): Stock {
	return {
		id,
		name,
		desired_quantity: desired,
		current_quantity: current,
		unit: "kg",
		location: "pantry",
		created_at: "2026-03-01T00:00:00Z",
		updated_at: "2026-03-01T00:00:00Z",
	};
}

describe("useStockManager", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		Object.defineProperty(globalThis, "window", {
			value: globalThis,
			configurable: true,
		});
		stocksRef.value = [makeStock(1n, "Rice", 5, 1), makeStock(2n, "Tea", 1, 1)];
		Object.defineProperty(globalThis, "navigator", {
			value: { userAgent: "Mozilla", clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } },
			configurable: true,
		});
		Object.defineProperty(window, "navigator", {
			value: navigator,
			configurable: true,
		});
	});

	it("creates stock with validation and success reset", async () => {
		mockAddStock.mockResolvedValueOnce(makeStock(3n, "Beans", 4, 1));
		const { useStockManager } = await import("./useStockManager");
		const mgr = useStockManager();

		mgr.newStock.value.name = "";
		await mgr.createNewStock();
		expect(mgr.errorMessage.value).toBe("Name is required");

		mgr.newStock.value = { name: "Beans", desired_quantity: 4, current_quantity: 1, unit: "can", location: "shelf" };
		await mgr.createNewStock();
		expect(mockAddStock).toHaveBeenCalled();
		expect(mgr.statusMessage.value).toContain("added");
		expect(mgr.newStock.value.name).toBe("");

		mockAddStock.mockRejectedValueOnce(new Error("create fail"));
		mgr.newStock.value = { name: "Fail", desired_quantity: 1, current_quantity: 0, unit: "", location: "" };
		await mgr.createNewStock();
		expect(mgr.errorMessage.value).toContain("failed to add");
	});

	it("saves, increments and decrements stock", async () => {
		mockUpdateStock.mockResolvedValue(makeStock(1n, "Rice", 5, 2));
		const { useStockManager } = await import("./useStockManager");
		const mgr = useStockManager();
		const stock = stocksRef.value[0];

		stock.name = "";
		await mgr.save(stock);
		expect(mgr.errorMessage.value).toBe("Name is required");

		stock.name = "Rice";
		await mgr.save(stock);
		expect(mockUpdateStock).toHaveBeenCalled();
		expect(mgr.statusMessage.value).toContain("saved");

		await mgr.increment(stock);
		await mgr.decrement(stock);
		vi.runAllTimers();
		expect(mockUpdateStock).toHaveBeenCalled();

		mockUpdateStock.mockRejectedValueOnce(new Error("queued fail"));
		await mgr.increment(stock);
		vi.runAllTimers();
		expect(mockUpdateStock).toHaveBeenCalled();

		mockUpdateStock.mockRejectedValueOnce(new Error("save fail"));
		await mgr.save(stock);
		expect(mgr.errorMessage.value).toContain("failed to save stock line");
	});

	it("removes stock and handles delete errors", async () => {
		mockRemoveStockById.mockResolvedValueOnce(undefined);
		const { useStockManager } = await import("./useStockManager");
		const mgr = useStockManager();
		await mgr.remove(1n);
		expect(mockRemoveStockById).toHaveBeenCalledWith(1n);
		expect(mgr.statusMessage.value).toContain("deleted");

		mockRemoveStockById.mockRejectedValueOnce(new Error("delete fail"));
		await mgr.remove(2n);
		expect(mgr.errorMessage.value).toContain("failed to delete");
	});

	it("filters and labels stock states", async () => {
		const { useStockManager } = await import("./useStockManager");
		const mgr = useStockManager();
		mgr.searchQuery.value = "tea";
		expect(mgr.filteredStocks.value.length).toBe(1);
		expect(mgr.getStockStateClass(makeStock(10n, "A", 8, 1))).toBe("critical");
		expect(mgr.getStockStateClass(makeStock(10n, "A", 3, 2))).toBe("warning");
		expect(mgr.getStockStateClass(makeStock(10n, "A", 1, 1))).toBe("ok");
		expect(mgr.getStockStateLabel(makeStock(10n, "A", 1, 1))).toBe("Stocked");
		expect(mgr.getStockStateLabel(makeStock(10n, "A", 5, 1))).toContain("Missing");
		expect(mgr.quantitySummary(makeStock(10n, "A", 2, 1))).toContain("1/2");
		expect(mgr.quantitySummary({ ...makeStock(10n, "A", 2, 1), unit: null, location: null })).toBe("1/2");
		mgr.searchQuery.value = "";
		expect(mgr.filteredStocks.value.length).toBeGreaterThan(0);
	});

	it("toggles line detail and save state reflection", async () => {
		const { useStockManager } = await import("./useStockManager");
		const mgr = useStockManager();
		expect(mgr.isLineDetailed(1n)).toBe(false);
		mgr.toggleLineView(1n);
		expect(mgr.isLineDetailed(1n)).toBe(true);
		expect(mgr.getLineSaveState(1n)).toBe("idle");
	});

	it("shares grocery list through clipboard, navigator share and native mobile", async () => {
		const { useStockManager } = await import("./useStockManager");
		const mgr = useStockManager();
		const writeText = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>);

		await mgr.shareGroceryList();
		expect(writeText).toHaveBeenCalled();

		Object.defineProperty(globalThis, "navigator", {
			value: { userAgent: "Mozilla", share: vi.fn().mockResolvedValue(undefined), clipboard: { writeText: vi.fn() } },
			configurable: true,
		});
		Object.defineProperty(window, "navigator", {
			value: navigator,
			configurable: true,
		});
		await mgr.shareGroceryList();
		expect((navigator.share as ReturnType<typeof vi.fn>)).toHaveBeenCalled();

		mockIsTauri.mockReturnValueOnce(true);
		Object.defineProperty(globalThis, "navigator", {
			value: { userAgent: "android", clipboard: { writeText: vi.fn() } },
			configurable: true,
		});
		Object.defineProperty(window, "navigator", {
			value: navigator,
			configurable: true,
		});
		mockWriteTextFile.mockResolvedValueOnce(undefined);
		mockShareFile.mockResolvedValueOnce(undefined);
		await mgr.shareGroceryList();
		expect(mockWriteTextFile).toHaveBeenCalled();
		expect(mockShareFile).toHaveBeenCalled();

		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		mockIsTauri.mockReturnValueOnce(true);
		Object.defineProperty(globalThis, "navigator", {
			value: { userAgent: "ipad", share: vi.fn().mockResolvedValue(undefined), clipboard: { writeText: vi.fn() } },
			configurable: true,
		});
		Object.defineProperty(window, "navigator", {
			value: navigator,
			configurable: true,
		});
		mockWriteTextFile.mockResolvedValueOnce(undefined);
		mockShareFile.mockRejectedValueOnce(new Error("native share fail"));
		await mgr.shareGroceryList();
		expect(warnSpy).toHaveBeenCalled();
		warnSpy.mockRestore();

		const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		Object.defineProperty(globalThis, "navigator", {
			value: { userAgent: "Mozilla", share: vi.fn().mockRejectedValue(new Error("share fail")), clipboard: { writeText: vi.fn() } },
			configurable: true,
		});
		Object.defineProperty(window, "navigator", {
			value: navigator,
			configurable: true,
		});
		await mgr.shareGroceryList();
		expect(errSpy).toHaveBeenCalled();
		errSpy.mockRestore();
	});
});
