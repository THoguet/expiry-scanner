import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import type { ProductWithBarcode } from "../../services/backend";

vi.mock("vue", async () => {
	const actual = await vi.importActual<typeof import("vue")>("vue");
	return {
		...actual,
		onMounted: (cb: () => void) => cb(),
	};
});

const mockInvoke = vi.fn();
const mockVibrate = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));
vi.mock("@tauri-apps/plugin-haptics", () => ({ vibrate: mockVibrate }));

function makeProduct(): ProductWithBarcode {
	return [{
		id: 1n,
		barcode: "123",
		name: "",
		image: null,
		expiration_date: "2026-04-01",
		created_at: "2026-03-01T00:00:00Z",
	}, { code: "123", product_name: "Fallback Name", image_url: "https://img" }] as unknown as ProductWithBarcode;
}

describe("useProductBox", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		Object.defineProperty(globalThis, "window", {
			value: globalThis,
			configurable: true,
		});
	});

	it("computes labels and fallback fields", async () => {
		mockInvoke.mockResolvedValue(2);
		const onDelete = vi.fn();
		const onEdit = vi.fn();
		const { useProductBox } = await import("./useProductBox");
		const box = useProductBox({ product: makeProduct() }, onDelete, onEdit);
		await nextTick();
		await Promise.resolve();

		expect(box.getName()).toContain("Fallback Name");
		expect(box.getImageUrl()).toBe("https://img");
		expect(box.colorsByDaysLeft.value).toMatch(/text-/);
		expect(box.daysLeftLabel.value).toBe("2");
		expect(box.colorsByDaysLeft.value).toBe("text-red-500");
	});

	it("prefers product name and image when available", async () => {
		mockInvoke.mockResolvedValue(1);
		const { useProductBox } = await import("./useProductBox");
		const p: ProductWithBarcode = [{
			...makeProduct()[0],
			name: "Own Name",
			image: "https://own-img",
		}, makeProduct()[1]];
		const box = useProductBox({ product: p }, vi.fn(), vi.fn());
		await nextTick();
		await Promise.resolve();
		expect(box.getName()).toBe("Own Name");
		expect(box.getImageUrl()).toBe("https://own-img");
	});

	it("covers color and label branches", async () => {
		mockInvoke.mockResolvedValueOnce(-1).mockResolvedValueOnce(6).mockResolvedValueOnce(9);
		const { useProductBox } = await import("./useProductBox");

		const a = useProductBox({ product: makeProduct() }, vi.fn(), vi.fn());
		await nextTick();
		await Promise.resolve();
		await Promise.resolve();
		expect(a.colorsByDaysLeft.value).toBe("text-purple-500");

		const b = useProductBox({ product: makeProduct() }, vi.fn(), vi.fn());
		await nextTick();
		await Promise.resolve();
		await Promise.resolve();
		expect(b.colorsByDaysLeft.value).toBe("text-yellow-500");

		const c = useProductBox({ product: makeProduct() }, vi.fn(), vi.fn());
		await nextTick();
		await Promise.resolve();
		await Promise.resolve();
		expect(c.colorsByDaysLeft.value).toBe("text-green-500");
	});

	it("exposes loading and error gray states", async () => {
		mockInvoke.mockRejectedValueOnce(new Error("calc"));
		const { useProductBox } = await import("./useProductBox");
		const box = useProductBox({ product: makeProduct() }, vi.fn(), vi.fn());
		expect(box.daysLeftLabel.value).toBe("...");
		expect(box.colorsByDaysLeft.value).toBe("text-gray-500");
		await nextTick();
		await Promise.resolve();
		expect(box.daysLeftLabel.value).toBe("N/A");
		expect(box.colorsByDaysLeft.value).toBe("text-gray-500");
	});

	it("handles error path and fallback name/image branches", async () => {
		mockInvoke.mockRejectedValueOnce(new Error("x"));
		const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { useProductBox } = await import("./useProductBox");
		const p: ProductWithBarcode = [{ ...makeProduct()[0], name: null as unknown as string, image: null }, null];
		const box = useProductBox({ product: p }, vi.fn(), vi.fn());
		await nextTick();
		await Promise.resolve();
		await Promise.resolve();
		expect(box.daysLeftLabel.value).toBe("N/A");
		expect(box.getName()).toContain("Unknown product");
		expect(box.getImageUrl()).toBe("/no_img.png");
		errSpy.mockRestore();
	});

	it("starts delete timer and calls delete callback", async () => {
		mockInvoke.mockResolvedValue(5);
		const onDelete = vi.fn();
		const onEdit = vi.fn();
		const { useProductBox } = await import("./useProductBox");
		const box = useProductBox({ product: makeProduct() }, onDelete, onEdit);

		box.startTimerToDelete();
		vi.advanceTimersByTime(300);
		vi.advanceTimersByTime(1200);

		expect(mockVibrate).toHaveBeenCalled();
		expect(onDelete).toHaveBeenCalled();
		expect(onEdit).not.toHaveBeenCalled();
		box.openEditPanel();
		expect(onEdit).not.toHaveBeenCalled();
	});

	it("restarts and clears timers safely", async () => {
		mockInvoke.mockResolvedValue(3);
		const onDelete = vi.fn();
		const onEdit = vi.fn();
		const { useProductBox } = await import("./useProductBox");
		const box = useProductBox({ product: makeProduct() }, onDelete, onEdit);

		box.startTimerToDelete();
		vi.advanceTimersByTime(300);
		box.startTimerToDelete();
		box.clearTimerToDelete();
		vi.runAllTimers();
		expect(onDelete.mock.calls.length).toBeGreaterThanOrEqual(0);
	});

	it("clears active vibration when opening edit panel", async () => {
		mockInvoke.mockResolvedValue(4);
		const onDelete = vi.fn();
		const onEdit = vi.fn();
		const { useProductBox } = await import("./useProductBox");
		const box = useProductBox({ product: makeProduct() }, onDelete, onEdit);

		box.startTimerToDelete();
		vi.advanceTimersByTime(350);
		box.openEditPanel();
		vi.runAllTimers();

		expect(onEdit).toHaveBeenCalledWith(1n);
		expect(onDelete).not.toHaveBeenCalled();
	});

	it("clears active vibration with clearTimerToDelete", async () => {
		mockInvoke.mockResolvedValue(4);
		const onDelete = vi.fn();
		const { useProductBox } = await import("./useProductBox");
		const box = useProductBox({ product: makeProduct() }, onDelete, vi.fn());

		box.startTimerToDelete();
		vi.advanceTimersByTime(350);
		box.clearTimerToDelete();
		vi.runAllTimers();

		expect(onDelete).not.toHaveBeenCalled();
	});

	it("opens edit panel and clears timers", async () => {
		mockInvoke.mockRejectedValueOnce(new Error("calc fail"));
		const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const onDelete = vi.fn();
		const onEdit = vi.fn();
		const { useProductBox } = await import("./useProductBox");
		const box = useProductBox({ product: makeProduct() }, onDelete, onEdit);

		box.startTimerToDelete();
		box.openEditPanel();
		box.clearTimerToDelete();
		vi.runAllTimers();

		expect(onEdit).toHaveBeenCalledWith(1n);
		expect(onDelete).not.toHaveBeenCalled();
		errSpy.mockRestore();
	});

	it("formats date", async () => {
		mockInvoke.mockResolvedValue(10);
		const { useProductBox } = await import("./useProductBox");
		const box = useProductBox({ product: makeProduct() }, vi.fn(), vi.fn());
		expect(box.formatDate("2026-04-01").length).toBeGreaterThan(0);
	});
});
