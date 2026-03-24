import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	getStocks,
	createStock,
	editStock,
	deleteStock,
	adjustStockByDelta,
} from "../services/backend";
import type { Stock } from "../bindings/Stock";

const mockStock: Stock = {
	id: 1n,
	name: "Milk",
	desired_quantity: 3,
	current_quantity: 1,
	unit: "L",
	location: "Fridge",
	created_at: "2024-01-01T00:00:00Z",
	updated_at: "2024-01-01T00:00:00Z",
};

function mockFetch(response: unknown, status = 200) {
	globalThis.fetch = vi.fn().mockResolvedValue({
		ok: status >= 200 && status < 300,
		status,
		json: async () => response,
		text: async () => JSON.stringify(response),
	});
}

describe("backend – stock endpoints", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	describe("getStocks", () => {
		it("returns stocks from the backend", async () => {
			mockFetch([mockStock]);
			const result = await getStocks("client-1");
			expect(result).toEqual([mockStock]);
			expect(fetch).toHaveBeenCalledWith(
				expect.stringContaining("/stock?client_id=client-1"),
				expect.any(Object),
			);
		});

		it("returns an empty array when the response is empty", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 204,
				json: async () => undefined,
				text: async () => "",
			});
			const result = await getStocks("client-1");
			expect(result).toEqual([]);
		});

		it("throws when the backend returns an error", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				text: async () => "Internal Server Error",
			});
			await expect(getStocks("client-1")).rejects.toThrow("Backend request failed (500)");
		});
	});

	describe("createStock", () => {
		it("sends POST /stock with the payload and returns the created stock", async () => {
			mockFetch(mockStock);
			const payload = {
				client_id: "client-1",
				name: "Milk",
				desired_quantity: 3,
				current_quantity: 1,
				unit: "L" as string | null,
				location: "Fridge" as string | null,
			};
			const result = await createStock(payload);
			expect(result).toEqual(mockStock);
			expect(fetch).toHaveBeenCalledWith(
				expect.stringContaining("/stock"),
				expect.objectContaining({ method: "POST" }),
			);
		});

		it("throws when the backend returns a non-ok response", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 400,
				text: async () => "Bad Request",
			});
			await expect(
				createStock({ client_id: "c", name: "X", desired_quantity: 1, current_quantity: 0, unit: null, location: null }),
			).rejects.toThrow("Backend request failed (400)");
		});
	});

	describe("editStock", () => {
		it("sends PUT /stock with the payload and returns the updated stock", async () => {
			const updated = { ...mockStock, name: "Oat Milk" };
			mockFetch(updated);
			const result = await editStock({
				id: 1n,
				client_id: "client-1",
				name: "Oat Milk",
				desired_quantity: 3,
				current_quantity: 1,
				unit: "L",
				location: "Fridge",
			});
			expect(result.name).toBe("Oat Milk");
			expect(fetch).toHaveBeenCalledWith(
				expect.stringContaining("/stock"),
				expect.objectContaining({ method: "PUT" }),
			);
		});
	});

	describe("deleteStock", () => {
		it("sends DELETE /stock with the payload", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 204,
				json: async () => undefined,
				text: async () => "",
			});
			await deleteStock({ id: 1n, client_id: "client-1" });
			expect(fetch).toHaveBeenCalledWith(
				expect.stringContaining("/stock"),
				expect.objectContaining({ method: "DELETE" }),
			);
		});
	});

	describe("adjustStockByDelta", () => {
		it("sends POST /stock/:id/delta and returns the updated stock", async () => {
			const updated = { ...mockStock, current_quantity: 2 };
			mockFetch(updated);
			const result = await adjustStockByDelta(1n, { client_id: "client-1", delta: 1 });
			expect(result.current_quantity).toBe(2);
			expect(fetch).toHaveBeenCalledWith(
				expect.stringContaining("/stock/1/delta"),
				expect.objectContaining({ method: "POST" }),
			);
		});

		it("throws when the backend returns a non-ok response", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 404,
				text: async () => "Not Found",
			});
			await expect(adjustStockByDelta(99n, { client_id: "c", delta: 1 })).rejects.toThrow(
				"Backend request failed (404)",
			);
		});
	});
});
