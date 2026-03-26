import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductWithBarcode } from "./backend";

const mockCancel = vi.fn().mockResolvedValue(undefined);
const mockIsPermissionGranted = vi.fn();
const mockRequestPermission = vi.fn();
const mockSendNotification = vi.fn();

vi.mock("@tauri-apps/plugin-notification", () => ({
	cancel: mockCancel,
	isPermissionGranted: mockIsPermissionGranted,
	requestPermission: mockRequestPermission,
	sendNotification: mockSendNotification,
}));

function productWithBarcode(id: bigint, barcode: string): ProductWithBarcode {
	return [
		{
			id,
			barcode,
			name: "Item " + barcode,
			image: null,
			expiration_date: "2026-04-10",
			created_at: "2026-03-01T00:00:00Z",
		},
		{ code: barcode, product_name: "Item " + barcode, image_url: null },
	] as unknown as ProductWithBarcode;
}

function productWithNullName(id: bigint, barcode: string): ProductWithBarcode {
	return [
		{
			id,
			barcode,
			name: "",
			image: null,
			expiration_date: "2026-04-10",
			created_at: "2026-03-01T00:00:00Z",
		},
		{ code: barcode, product_name: null, image_url: null },
	] as unknown as ProductWithBarcode;
}

describe("notifications service", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		vi.resetModules();
		const mod = await import("./notifications");
		const tracked = mod.getTrackedPendingNotificationIds();
		if (tracked.length > 0) {
			await mockCancel(tracked);
		}
	});

	it("handles permission checks with fallback request", async () => {
		mockIsPermissionGranted.mockResolvedValueOnce(false);
		mockRequestPermission.mockResolvedValueOnce("granted");
		const { checkPermissions } = await import("./notifications");
		expect(await checkPermissions()).toBe(true);

		mockIsPermissionGranted.mockResolvedValueOnce(false);
		mockRequestPermission.mockResolvedValueOnce("denied");
		expect(await checkPermissions()).toBe(false);
	});

	it("creates notifications for products and tracks ids", async () => {
		mockIsPermissionGranted.mockResolvedValue(true);
		const { updateNotifications, getTrackedPendingNotificationIds } = await import("./notifications");
		await updateNotifications([productWithBarcode(1n, "111")]);
		expect(mockSendNotification).toHaveBeenCalledTimes(3);
		expect(getTrackedPendingNotificationIds().length).toBe(3);
	});

	it("returns early when permission is denied", async () => {
		mockIsPermissionGranted.mockResolvedValue(false);
		mockRequestPermission.mockResolvedValue("denied");
		const { updateNotifications } = await import("./notifications");
		await updateNotifications([productWithBarcode(1n, "111")]);
		expect(mockSendNotification).not.toHaveBeenCalled();
	});

	it("cancels obsolete notifications and removes tracked ids", async () => {
		mockIsPermissionGranted.mockResolvedValue(true);
		const { updateNotifications, getTrackedPendingNotificationIds } = await import("./notifications");
		await updateNotifications([productWithBarcode(1n, "111")]);
		expect(getTrackedPendingNotificationIds().length).toBe(3);

		await updateNotifications([]);
		expect(mockCancel).toHaveBeenCalled();
		expect(getTrackedPendingNotificationIds().length).toBe(0);
	});

	it("can cancel notifications for a single product", async () => {
		mockIsPermissionGranted.mockResolvedValue(true);
		const { updateNotifications, cancelNotificationsForProduct, getTrackedPendingNotificationIds } = await import("./notifications");
		const p = productWithBarcode(1n, "999")[0];
		await updateNotifications([productWithBarcode(1n, "999")]);
		expect(getTrackedPendingNotificationIds().length).toBe(3);

		await cancelNotificationsForProduct(p);
		expect(mockCancel).toHaveBeenCalled();
		expect(getTrackedPendingNotificationIds().length).toBe(0);
	});

	it("adds notifications for one new product", async () => {
		const { addNewProductNotification } = await import("./notifications");
		await addNewProductNotification(productWithBarcode(1n, "333"));
		expect(mockSendNotification).toHaveBeenCalledTimes(3);
	});

	it("uses barcode fallback when product name is unavailable", async () => {
		const { addNewProductNotification } = await import("./notifications");
		await addNewProductNotification(productWithNullName(2n, "777"));
		const first = mockSendNotification.mock.calls[0][0];
		expect(first.title).toContain("777");
		expect(first.body).toContain("product 777");
	});
});
