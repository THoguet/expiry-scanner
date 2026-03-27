import { isTauri } from "@tauri-apps/api/core";
import { join, tempDir } from "@tauri-apps/api/path";
import { BaseDirectory, writeTextFile } from "@tauri-apps/plugin-fs";
import { shareFile } from "tauri-plugin-share";
import { logger } from "./logger";

export function getClientId(): string {
	let clientId = localStorage.getItem("clientId");
	if (!clientId) {
		clientId = crypto.randomUUID();
		localStorage.setItem("clientId", clientId);
		logger.info("Generated new client ID", { clientId });
	}
	logger.debug("Resolved client ID", { clientId });
	return clientId;
}

export function setClientId(clientId: string): void {
	localStorage.setItem("clientId", clientId);
	logger.info("Client ID updated", { clientId });
}

export function generateNewClientId(): string {
	const newClientId = crypto.randomUUID();
	localStorage.setItem("clientId", newClientId);
	logger.info("Generated replacement client ID", { clientId: newClientId });
	return newClientId;
}

function shouldAttemptNativeSharePlugin(): boolean {
	if (!isTauri()) return false;
	const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent.toLowerCase();
	const looksMobileUserAgent = userAgent.includes("android") || userAgent.includes("iphone") || userAgent.includes("ipad");
	const hasWebShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
	return looksMobileUserAgent || !hasWebShare;
}

async function shareClientIdWithPlugin(clientId: string): Promise<void> {
	const text = `My Expiry Scanner Client ID: ${clientId}`;
	const fileName = `client-id-${Date.now()}.txt`;

	await writeTextFile(fileName, text, {
		baseDir: BaseDirectory.Temp,
	});

	const tempPath = await join(await tempDir(), fileName);
	await shareFile(tempPath, "text/plain");
}

export async function shareClientId(clientId: string): Promise<void> {
	if (navigator.share) {
		try {
			logger.debug("Sharing client ID through Web Share API", { clientId });
			await navigator.share({
				title: "Expiry Scanner Client ID",
				text: `My Expiry Scanner Client ID: ${clientId}`,
			});
			return;
		} catch (shareError) {
			logger.warn("Web Share API failed for client ID, trying native plugin", {
				clientId,
				error: shareError,
			});
		}
	}

	if (shouldAttemptNativeSharePlugin()) {
		try {
			logger.debug("Sharing client ID through native share plugin", { clientId });
			await shareClientIdWithPlugin(clientId);
			return;
		} catch (pluginShareError) {
			logger.warn("Native share plugin failed for client ID, falling back to clipboard", {
				clientId,
				error: pluginShareError,
			});
		}
	}

	await navigator.clipboard.writeText(clientId);
	logger.info("Client ID copied to clipboard", { clientId });
}