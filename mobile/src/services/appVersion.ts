import { invoke, isTauri } from "@tauri-apps/api/core";

const DEV_VERSION = "0.0.0-dev";

export async function getAppVersion(): Promise<string> {
	if (!isTauri()) {
		return DEV_VERSION;
	}

	try {
		const version = await invoke<string>("app_version");
		if (typeof version === "string" && version.trim().length > 0) {
			return version.trim();
		}
	} catch (error) {
		console.error("Failed to load app version", error);
	}

	return DEV_VERSION;
}
