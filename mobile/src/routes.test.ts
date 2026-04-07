import { describe, expect, it } from "vitest";
import { vi } from "vitest";

const { loggerDebug } = vi.hoisted(() => ({
	loggerDebug: vi.fn(),
}));

vi.mock("/src/components/product/ProductList.vue", () => ({ default: {} }));
vi.mock("/src/components/product/AddProduct.vue", () => ({ default: {} }));
vi.mock("/src/components/stock/StockManager.vue", () => ({ default: {} }));
vi.mock("/src/components/product/FreezerList.vue", () => ({ default: {} }));
vi.mock("/src/services/logger.ts", () => ({
	logger: {
		debug: loggerDebug,
	},
}));
import { router } from "./routes";

describe("routes", () => {
	it("defines expected app routes", () => {
		const paths = router.getRoutes().map((r) => r.path).sort();
		expect(paths).toContain("/");
		expect(paths).toContain("/AddProduct");
		expect(paths).toContain("/Stock");
	});

	it("logs navigation through route guard", async () => {
		loggerDebug.mockClear();

		await router.push("/");
		await router.push("/Stock");

		expect(loggerDebug).toHaveBeenCalledWith(
			"Navigating route",
			expect.objectContaining({
				from: expect.any(String),
				to: "/Stock",
			}),
		);
	});
});
