import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("/src/components/product/ProductList.vue", () => ({ default: {} }));
vi.mock("/src/components/product/AddProduct.vue", () => ({ default: {} }));
vi.mock("/src/components/stock/StockManager.vue", () => ({ default: {} }));
import { router } from "./routes";

describe("routes", () => {
	it("defines expected app routes", () => {
		const paths = router.getRoutes().map((r) => r.path).sort();
		expect(paths).toContain("/");
		expect(paths).toContain("/AddProduct");
		expect(paths).toContain("/Stock");
	});
});
