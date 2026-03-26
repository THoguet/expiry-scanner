import { beforeEach, describe, expect, it, vi } from "vitest";

describe("ClientId service", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
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
});
