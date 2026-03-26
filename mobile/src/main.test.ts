import { describe, expect, it, vi } from "vitest";

const mockUse = vi.fn().mockReturnThis();
const mockMount = vi.fn();
const mockCreateApp = vi.fn(() => ({ use: mockUse, mount: mockMount }));

vi.mock("vue", () => ({
	createApp: mockCreateApp,
}));

vi.mock("/src/App.vue", () => ({ default: { name: "AppStub" } }));
vi.mock("/src/routes.ts", () => ({ router: { name: "router" } }));
vi.mock("/src/services/ClientId.ts", () => ({ getClientId: () => "cid-123" }));

describe("main bootstrap", () => {
	it("creates app, installs router, mounts, and exports client id", async () => {
		const mod = await import("./main");
		expect(mod.CLIENT_ID).toBe("cid-123");
		expect(mockCreateApp).toHaveBeenCalled();
		expect(mockUse).toHaveBeenCalled();
		expect(mockMount).toHaveBeenCalledWith("#app");
	});
});
