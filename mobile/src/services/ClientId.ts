import { isTauri } from "@tauri-apps/api/core";
import { shareText } from "@buildyourwebapp/tauri-plugin-sharesheet";
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

async function shareClientIdWithNativePlugin(clientId: string): Promise<boolean> {
	if (!shouldAttemptNativeSharePlugin()) {
		return false;
	}

	try {
		logger.debug("Sharing client ID through native sharesheet plugin", { clientId });
		await shareText(`My Expiry Scanner Client ID: ${clientId}`);
		return true;
	} catch (pluginShareError) {
		logger.warn("Native sharesheet plugin failed for client ID", {
			clientId,
			error: pluginShareError,
		});
		return false;
	}
}

async function copyClientIdToClipboard(clientId: string): Promise<boolean> {
	if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(clientId);
			return true;
		} catch (clipboardError) {
			logger.warn("Clipboard API write failed for client ID, trying legacy copy", {
				clientId,
				error: clipboardError,
			});
		}
	}

	if (typeof document === "undefined") {
		return false;
	}

	const textArea = document.createElement("textarea");
	textArea.value = clientId;
	textArea.setAttribute("readonly", "");
	textArea.style.position = "fixed";
	textArea.style.opacity = "0";
	textArea.style.pointerEvents = "none";
	document.body.appendChild(textArea);
	textArea.focus();
	textArea.select();

	try {
		return document.execCommand("copy");
	} catch (legacyCopyError) {
		logger.warn("Legacy copy command failed for client ID", {
			clientId,
			error: legacyCopyError,
		});
		return false;
	} finally {
		document.body.removeChild(textArea);
	}
}

export async function shareClientId(clientId: string): Promise<void> {
	if (await shareClientIdWithNativePlugin(clientId)) {
		return;
	}

	if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
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

	if (await copyClientIdToClipboard(clientId)) {
		logger.info("Client ID copied to clipboard", { clientId });
		return;
	}

	throw new Error("Unable to share or copy client ID on this device");
}