import {
	attachConsole,
	debug as tauriDebug,
	error as tauriError,
	info as tauriInfo,
	trace as tauriTrace,
	warn as tauriWarn,
} from "@tauri-apps/plugin-log";

type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

type LoggerContext = unknown;

let consoleAttached = false;

function hasTauriRuntime(): boolean {
	if (typeof window === "undefined") {
		return false;
	}

	return "__TAURI_INTERNALS__" in (window as object);
}

function serializeContext(context: LoggerContext): string {
	if (context === undefined || context === null) {
		return "";
	}

	if (context instanceof Error) {
		return JSON.stringify({
			name: context.name,
			message: context.message,
			stack: context.stack,
		});
	}

	if (typeof context === "string") {
		return context;
	}

	try {
		return JSON.stringify(context, (_key, value) => {
			if (value instanceof Error) {
				return {
					name: value.name,
					message: value.message,
					stack: value.stack,
				};
			}

			if (typeof value === "bigint") {
				return value.toString();
			}

			return value;
		});
	} catch {
		return String(context);
	}
}

function formatMessage(level: LogLevel, message: string, context?: LoggerContext): string {
	const now = new Date().toISOString();
	const renderedContext = context === undefined ? "" : ` | ${serializeContext(context)}`;
	return `[${now}] [${level.toUpperCase()}] ${message}${renderedContext}`;
}

function logToConsole(level: LogLevel, message: string, context?: LoggerContext): void {
	switch (level) {
		case "trace":
			console.debug(message);
			break;
		case "debug":
			console.debug(message);
			break;
		case "info":
			console.log(message);
			break;
		case "warn":
			if (context === undefined) {
				console.warn(message);
				break;
			}
			console.warn(message, context);
			break;
		case "error":
			if (context instanceof Error) {
				console.error(context);
				break;
			}

			if (context === undefined) {
				console.error(message);
				break;
			}

			console.error(message, context);
			break;
	}
}

async function logToTauri(level: LogLevel, message: string): Promise<void> {
	switch (level) {
		case "trace":
			await tauriTrace(message);
			break;
		case "debug":
			await tauriDebug(message);
			break;
		case "info":
			await tauriInfo(message);
			break;
		case "warn":
			await tauriWarn(message);
			break;
		case "error":
			await tauriError(message);
			break;
	}
}

function write(level: LogLevel, message: string, context?: LoggerContext): void {
	const rendered = formatMessage(level, message, context);
	logToConsole(level, rendered, context);

	if (!hasTauriRuntime()) {
		return;
	}

	void logToTauri(level, rendered).catch((logError) => {
		const fallback = formatMessage("error", "Failed to send log to Tauri plugin", {
			originalLevel: level,
			originalMessage: message,
			logError,
		});
		console.error(fallback);
	});
}

export async function initializeLogging(): Promise<void> {
	if (consoleAttached) {
		return;
	}

	if (!hasTauriRuntime()) {
		consoleAttached = true;
		write("debug", "Tauri runtime unavailable, plugin logging disabled");
		return;
	}

	try {
		await attachConsole();
		consoleAttached = true;
		write("info", "Attached webview console to Tauri log stream");
	} catch (error) {
		write("error", "Failed to attach webview console to Tauri log stream", error);
	}
}

export const logger = {
	trace(message: string, context?: LoggerContext): void {
		write("trace", message, context);
	},
	debug(message: string, context?: LoggerContext): void {
		write("debug", message, context);
	},
	info(message: string, context?: LoggerContext): void {
		write("info", message, context);
	},
	warn(message: string, context?: LoggerContext): void {
		write("warn", message, context);
	},
	error(message: string, context?: LoggerContext): void {
		write("error", message, context);
	},
};
