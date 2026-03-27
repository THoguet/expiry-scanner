import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("toast service", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.resetModules();
		Object.defineProperty(globalThis, "window", {
			value: globalThis,
			configurable: true,
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("shows toast and auto-dismisses with default duration", async () => {
		const { useToast } = await import("./toast");
		const toast = useToast();

		expect(toast.toasts.value).toEqual([]);

		const id = toast.show("Saved", "success");
		expect(id).toBe(1);
		expect(toast.toasts.value).toEqual([
			{ id: 1, message: "Saved", kind: "success" },
		]);

		vi.advanceTimersByTime(2499);
		expect(toast.toasts.value).toHaveLength(1);

		vi.advanceTimersByTime(1);
		expect(toast.toasts.value).toEqual([]);
	});

	it("supports success/error shortcuts, manual dismiss, and custom duration", async () => {
		const { useToast } = await import("./toast");
		const toast = useToast();

		const successId = toast.success("Done", 100);
		const errorId = toast.error("Failed", 300);

		expect(successId).toBe(1);
		expect(errorId).toBe(2);
		expect(toast.toasts.value).toEqual([
			{ id: 1, message: "Done", kind: "success" },
			{ id: 2, message: "Failed", kind: "error" },
		]);

		toast.dismiss(successId);
		expect(toast.toasts.value).toEqual([
			{ id: 2, message: "Failed", kind: "error" },
		]);

		vi.advanceTimersByTime(299);
		expect(toast.toasts.value).toHaveLength(1);

		vi.advanceTimersByTime(1);
		expect(toast.toasts.value).toEqual([]);
	});
});
