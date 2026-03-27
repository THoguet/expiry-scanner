import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	mockIsTauri,
	mockJoin,
	mockTempDir,
	mockWriteTextFile,
	mockShareFile,
} = vi.hoisted(() => ({
	mockIsTauri: vi.fn(() => false),
	mockJoin: vi.fn(async () => "/tmp/client-id.txt"),
	mockTempDir: vi.fn(async () => "/tmp"),
	mockWriteTextFile: vi.fn(async () => undefined),
	mockShareFile: vi.fn(async () => undefined),
}));

vi.mock("@tauri-apps/api/core", () => ({
	isTauri: mockIsTauri,
}));

vi.mock("@tauri-apps/api/path", () => ({
	join: mockJoin,
	tempDir: mockTempDir,
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
	BaseDirectory: { Temp: "Temp" },
	writeTextFile: mockWriteTextFile,
}));

vi.mock("tauri-plugin-share", () => ({
	shareFile: mockShareFile,
}));

describe("ClientId service", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		mockIsTauri.mockReturnValue(false);
		mockJoin.mockResolvedValue("/tmp/client-id.txt");
		mockTempDir.mockResolvedValue("/tmp");
		mockWriteTextFile.mockResolvedValue(undefined);
		mockShareFile.mockResolvedValue(undefined);
	});

	it("returns existing client id from localStorage", async () => {
		const getItem = vi.fn().mockReturnValue("existing-id");
		const setItem = vi.fn();
		Object.defineProperty(globalThis, "localStorage", {
			value: { getItem, setItem },
			configurable: true,
		});
		Object.defineProperty(globalThis, "crypto", {
			value: { randomUUID: vi.fn(() => "new-id") },
			configurable: true,
		});

		const { getClientId } = await import("./ClientId");
		expect(getClientId()).toBe("existing-id");
		expect(setItem).not.toHaveBeenCalled();
	});

	it("generates and stores a new client id when missing", async () => {
		const getItem = vi.fn().mockReturnValue(null);
		const setItem = vi.fn();
		Object.defineProperty(globalThis, "localStorage", {
			value: { getItem, setItem },
			configurable: true,
		});
		Object.defineProperty(globalThis, "crypto", {
			value: { randomUUID: vi.fn(() => "generated-id") },
			configurable: true,
		});

		const { getClientId, generateNewClientId, setClientId } = await import("./ClientId");
		expect(getClientId()).toBe("generated-id");
		expect(setItem).toHaveBeenCalledWith("clientId", "generated-id");

		expect(generateNewClientId()).toBe("generated-id");
		expect(setItem).toHaveBeenCalledWith("clientId", "generated-id");

		setClientId("manual-id");
		expect(setItem).toHaveBeenCalledWith("clientId", "manual-id");
	});

	it("shares using native share when available", async () => {
		const share = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(globalThis, "navigator", {
			value: { share, clipboard: { writeText: vi.fn() } },
			configurable: true,
		});

		const { shareClientId } = await import("./ClientId");
		await shareClientId("abc");
		expect(share).toHaveBeenCalledWith({
			title: "Expiry Scanner Client ID",
			text: "My Expiry Scanner Client ID: abc",
		});
		expect(mockShareFile).not.toHaveBeenCalled();
	});

	it("falls back to clipboard when navigator share is unavailable", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
		Object.defineProperty(globalThis, "navigator", {
			value: { clipboard: { writeText } },
			configurable: true,
		});

		const { shareClientId } = await import("./ClientId");
		await shareClientId("fallback-id");
		expect(writeText).toHaveBeenCalledWith("fallback-id");
		expect(mockShareFile).not.toHaveBeenCalled();
		expect(logSpy).toHaveBeenCalled();
		logSpy.mockRestore();
	});

	it("uses native plugin when Web Share is unavailable in tauri", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(globalThis, "navigator", {
			value: {
				userAgent: "Mozilla/5.0 (Linux; Android 14)",
				clipboard: { writeText },
			},
			configurable: true,
		});
		mockIsTauri.mockReturnValue(true);

		const { shareClientId } = await import("./ClientId");
		await shareClientId("plugin-id");

		expect(mockWriteTextFile).toHaveBeenCalled();
		expect(mockShareFile).toHaveBeenCalledWith("/tmp/client-id.txt", "text/plain");
		expect(writeText).not.toHaveBeenCalled();
	});

	it("falls back to clipboard if Web Share and plugin share both fail", async () => {
		const share = vi.fn().mockRejectedValue(new Error("web share fail"));
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(globalThis, "navigator", {
			value: {
				share,
				userAgent: "Mozilla/5.0 (Linux; Android 14)",
				clipboard: { writeText },
			},
			configurable: true,
		});
		mockIsTauri.mockReturnValue(true);
		mockShareFile.mockRejectedValueOnce(new Error("plugin share fail"));

		const { shareClientId } = await import("./ClientId");
		await shareClientId("fallback-after-failures");

		expect(share).toHaveBeenCalled();
		expect(mockShareFile).toHaveBeenCalled();
		expect(writeText).toHaveBeenCalledWith("fallback-after-failures");
	});

	it("skips plugin on tauri desktop user-agent when Web Share exists", async () => {
		const share = vi.fn().mockRejectedValue(new Error("web share fail"));
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(globalThis, "navigator", {
			value: {
				share,
				userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
				clipboard: { writeText },
			},
			configurable: true,
		});
		mockIsTauri.mockReturnValue(true);

		const { shareClientId } = await import("./ClientId");
		await shareClientId("desktop-fallback");

		expect(share).toHaveBeenCalled();
		expect(mockShareFile).not.toHaveBeenCalled();
		expect(writeText).toHaveBeenCalledWith("desktop-fallback");
	});
});
