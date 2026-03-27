import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockIsTauri = vi.fn();
const mockInvoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
	isTauri: mockIsTauri,
	invoke: mockInvoke,
}));

describe("appVersion service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
		vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns 0.0.0-dev when not running in Tauri", async () => {
		mockIsTauri.mockReturnValue(false);
		const { getAppVersion } = await import("./appVersion");

		await expect(getAppVersion()).resolves.toBe("0.0.0-dev");
		expect(mockInvoke).not.toHaveBeenCalled();
	});

	it("returns the Tauri app version when available", async () => {
		mockIsTauri.mockReturnValue(true);
		mockInvoke.mockResolvedValue("1.2.3");
		const { getAppVersion } = await import("./appVersion");

		await expect(getAppVersion()).resolves.toBe("1.2.3");
		expect(mockInvoke).toHaveBeenCalledWith("app_version");
	});

	it("falls back to 0.0.0-dev on invoke errors", async () => {
		mockIsTauri.mockReturnValue(true);
		mockInvoke.mockRejectedValue(new Error("boom"));
		const { getAppVersion } = await import("./appVersion");

		await expect(getAppVersion()).resolves.toBe("0.0.0-dev");
	});

	it("falls back to 0.0.0-dev on empty values", async () => {
		mockIsTauri.mockReturnValue(true);
		mockInvoke.mockResolvedValue("   ");
		const { getAppVersion } = await import("./appVersion");

		await expect(getAppVersion()).resolves.toBe("0.0.0-dev");
	});
});
