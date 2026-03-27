import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockAttachConsole = vi.fn();
const mockTauriDebug = vi.fn();
const mockTauriError = vi.fn();
const mockTauriInfo = vi.fn();
const mockTauriTrace = vi.fn();
const mockTauriWarn = vi.fn();

vi.mock("@tauri-apps/plugin-log", () => ({
	attachConsole: mockAttachConsole,
	debug: mockTauriDebug,
	error: mockTauriError,
	info: mockTauriInfo,
	trace: mockTauriTrace,
	warn: mockTauriWarn,
}));

describe("logger service", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		mockAttachConsole.mockResolvedValue(undefined);
		mockTauriDebug.mockResolvedValue(undefined);
		mockTauriError.mockResolvedValue(undefined);
		mockTauriInfo.mockResolvedValue(undefined);
		mockTauriTrace.mockResolvedValue(undefined);
		mockTauriWarn.mockResolvedValue(undefined);
	});

	afterEach(() => {
		Reflect.deleteProperty(globalThis, "window");
	});

	it("initializes with no tauri runtime and logs fallback once", async () => {
		const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => undefined);
		const { initializeLogging } = await import("./logger");

		await initializeLogging();
		await initializeLogging();

		expect(mockAttachConsole).not.toHaveBeenCalled();
		expect(debugSpy).toHaveBeenCalled();
		expect(mockTauriDebug).not.toHaveBeenCalled();
		debugSpy.mockRestore();
	});

	it("attaches console when tauri runtime is available", async () => {
		Object.defineProperty(globalThis, "window", {
			value: { __TAURI_INTERNALS__: {} },
			configurable: true,
		});
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
		const { initializeLogging } = await import("./logger");

		await initializeLogging();
		await initializeLogging();

		expect(mockAttachConsole).toHaveBeenCalledTimes(1);
		expect(mockTauriInfo).toHaveBeenCalled();
		expect(logSpy).toHaveBeenCalled();
		logSpy.mockRestore();
	});

	it("handles attachConsole failure and logs an error", async () => {
		Object.defineProperty(globalThis, "window", {
			value: { __TAURI_INTERNALS__: {} },
			configurable: true,
		});
		const attachError = new Error("attach failed");
		mockAttachConsole.mockRejectedValueOnce(attachError);
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { initializeLogging } = await import("./logger");

		await initializeLogging();

		expect(errorSpy).toHaveBeenCalledWith(attachError);
		expect(mockTauriError).toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	it("mirrors warn and error variants to console", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { logger } = await import("./logger");

		logger.warn("warn message");
		logger.warn("warn context", { context: true });
		logger.error("error no context");
		logger.error("error with context", { code: 42 });

		expect(warnSpy).toHaveBeenCalledTimes(2);
		expect(errorSpy).toHaveBeenCalledTimes(2);
		warnSpy.mockRestore();
		errorSpy.mockRestore();
	});

	it("logs trace/info with context serialization including bigint and error", async () => {
		const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => undefined);
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
		const { logger } = await import("./logger");

		logger.trace("trace with bigint", { id: 12n });
		logger.info("info with error", { nested: new Error("nested") });
		logger.info("info with string", "plain-string");

		expect(debugSpy).toHaveBeenCalled();
		expect(logSpy).toHaveBeenCalled();
		debugSpy.mockRestore();
		logSpy.mockRestore();
	});

	it("logs fallback when tauri sink rejects", async () => {
		Object.defineProperty(globalThis, "window", {
			value: { __TAURI_INTERNALS__: {} },
			configurable: true,
		});
		mockTauriDebug.mockRejectedValueOnce(new Error("tauri debug failed"));
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { logger } = await import("./logger");

		logger.debug("will fail in tauri");
		await Promise.resolve();
		await Promise.resolve();

		expect(errorSpy).toHaveBeenCalled();
		const firstArg = errorSpy.mock.calls[0]?.[0];
		expect(String(firstArg)).toContain("Failed to send log to Tauri plugin");
		errorSpy.mockRestore();
	});
});