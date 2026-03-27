import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	mockIsTauri,
	mockShareText,
} = vi.hoisted(() => ({
	mockIsTauri: vi.fn(() => false),
	mockShareText: vi.fn(async () => undefined),
}));

vi.mock("@tauri-apps/api/core", () => ({
	isTauri: mockIsTauri,
}));

vi.mock("@buildyourwebapp/tauri-plugin-sharesheet", () => ({
	shareText: mockShareText,
}));

describe("ClientId service", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		mockIsTauri.mockReturnValue(false);
		mockShareText.mockResolvedValue(undefined);
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
		expect(logSpy).toHaveBeenCalled();
		logSpy.mockRestore();
	});

	it("uses sharesheet plugin when Web Share is unavailable in tauri", async () => {
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

		expect(mockShareText).toHaveBeenCalledWith("My Expiry Scanner Client ID: plugin-id");
		expect(writeText).not.toHaveBeenCalled();
	});

	it("falls back to clipboard if sharesheet and Web Share both fail", async () => {
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
		mockShareText.mockRejectedValueOnce(new Error("sharesheet fail"));

		const { shareClientId } = await import("./ClientId");
		await shareClientId("fallback-after-failures");

		expect(mockShareText).toHaveBeenCalled();
		expect(share).toHaveBeenCalled();
		expect(writeText).toHaveBeenCalledWith("fallback-after-failures");
	});

	it("falls back to legacy copy command when clipboard API write is denied", async () => {
		const share = vi.fn().mockRejectedValue(new Error("web share fail"));
		const writeText = vi.fn().mockRejectedValue(new Error("Write permission denied."));
		const execCommand = vi.fn().mockReturnValue(true);
		const textArea = {
			value: "",
			setAttribute: vi.fn(),
			style: {},
			focus: vi.fn(),
			select: vi.fn(),
		};
		Object.defineProperty(globalThis, "document", {
			value: {
				createElement: vi.fn(() => textArea),
				body: {
					appendChild: vi.fn(),
					removeChild: vi.fn(),
				},
				execCommand,
			},
			configurable: true,
		});
		Object.defineProperty(globalThis, "navigator", {
			value: {
				share,
				userAgent: "Mozilla/5.0 (Linux; Android 14)",
				clipboard: { writeText },
			},
			configurable: true,
		});
		mockIsTauri.mockReturnValue(true);
		mockShareText.mockRejectedValueOnce(new Error("sharesheet fail"));

		const { shareClientId } = await import("./ClientId");
		await shareClientId("legacy-copy-id");

		expect(writeText).toHaveBeenCalledWith("legacy-copy-id");
		expect(execCommand).toHaveBeenCalledWith("copy");
	});

	it("throws when share and clipboard fallbacks all fail", async () => {
		const share = vi.fn().mockRejectedValue(new Error("web share fail"));
		const writeText = vi.fn().mockRejectedValue(new Error("Write permission denied."));
		const execCommand = vi.fn().mockReturnValue(false);
		const textArea = {
			value: "",
			setAttribute: vi.fn(),
			style: {},
			focus: vi.fn(),
			select: vi.fn(),
		};
		Object.defineProperty(globalThis, "document", {
			value: {
				createElement: vi.fn(() => textArea),
				body: {
					appendChild: vi.fn(),
					removeChild: vi.fn(),
				},
				execCommand,
			},
			configurable: true,
		});
		Object.defineProperty(globalThis, "navigator", {
			value: {
				share,
				userAgent: "Mozilla/5.0 (Linux; Android 14)",
				clipboard: { writeText },
			},
			configurable: true,
		});
		mockIsTauri.mockReturnValue(true);
		mockShareText.mockRejectedValueOnce(new Error("sharesheet fail"));

		const { shareClientId } = await import("./ClientId");
		await expect(shareClientId("no-fallback-id")).rejects.toThrow(
			"Unable to share or copy client ID on this device",
		);
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
		expect(writeText).toHaveBeenCalledWith("desktop-fallback");
	});
});
