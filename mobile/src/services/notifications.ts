import { cancel, isPermissionGranted, Options, requestPermission, sendNotification, onAction } from "@tauri-apps/plugin-notification";
import { Product } from "../bindings/Product";
import { ProductWithBarcode } from "./backend";
import { logger } from "./logger";
import { shareProductExpiryAlert } from "./share";

const trackedPendingNotificationIds = new Set<number>();
const notificationToProductMap = new Map<number, Product>();

export function getTrackedPendingNotificationIds(): number[] {
	return Array.from(trackedPendingNotificationIds);
}

// Set up listener for notification actions (e.g., share button click)
let actionListenerInitialized = false;

function initializeActionListener() {
	if (actionListenerInitialized) return;
	actionListenerInitialized = true;

	onAction((notification: any) => {
		// When a notification action is triggered, the notification object is passed
		const notificationId = notification.id as number | undefined;

		logger.debug("Notification action triggered", {
			notificationId,
		});

		// Try to find the product associated with this notification
		if (notificationId !== undefined) {
			const product = notificationToProductMap.get(notificationId);
			if (product) {
				shareProductExpiryAlert(product).catch((error) => {
					logger.error("Failed to share product from notification", {
						productId: product.id.toString(),
						error,
					});
				});
			}
		}
	});
}

export async function checkPermissions(): Promise<boolean> {
	let permissionGranted = await isPermissionGranted();
	logger.debug("Notification permission checked", { permissionGranted });
	if (!permissionGranted) {
		const permission = await requestPermission();
		permissionGranted = permission === 'granted';
		logger.info("Notification permission requested", {
			response: permission,
			permissionGranted,
		});
	}

	// Initialize action listener once permissions are granted
	if (permissionGranted) {
		initializeActionListener();
	}

	return permissionGranted;
}

// Generate a unique notification ID for a product based on its barcode and expiry date for the three notifications: 3, 2, and 1 day before expiry
function generateNotificationId(product: Product): number[] {
	const baseString = `${product.barcode}-${product.expiration_date}`;
	const baseHash = hashString(baseString);
	return [baseHash, baseHash + 1, baseHash + 2];
}

function hashString(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash << 5) - hash + str.charCodeAt(i);
		hash |= 0; // Convert to 32bit integer
	}
	return hash;
}

export async function updateNotifications(products: ProductWithBarcode[]) {
	logger.info("Updating product notifications", {
		productsCount: products.length,
		trackedCount: trackedPendingNotificationIds.size,
	});
	const productsWithIds = new Map<ProductWithBarcode, number[]>(products.map((p) => [p, generateNotificationId(p[0])]));
	const productsWithIdsSet = new Set<number>(Array.from(productsWithIds.values()).flat());

	const notificationsToCancelIds = Array.from(trackedPendingNotificationIds).filter((id) => !productsWithIdsSet.has(id));
	if (notificationsToCancelIds.length > 0) {
		logger.debug("Cancelling stale notifications", { ids: notificationsToCancelIds });
		await cancel(notificationsToCancelIds);
	}
	notificationsToCancelIds.forEach((id) => {
		trackedPendingNotificationIds.delete(id);
		notificationToProductMap.delete(id);
	});

	const hasPermission = await checkPermissions();
	if (!hasPermission) {
		logger.warn("Skipping notifications because permission is not granted");
		return;
	}

	const notificationsToCreate = products.filter((p) => productsWithIds.get(p)!.some((id) => !trackedPendingNotificationIds.has(id)));
	for (const product of notificationsToCreate) {
		const notificationOptions = createNotificationForProduct(product, productsWithIds.get(product));
		for (const notificationOption of notificationOptions) {
			logger.trace("Scheduling notification", {
				id: notificationOption.id,
				title: notificationOption.title,
				scheduledAt: notificationOption.schedule?.at?.date,
			});
			// Store product reference for share action
			if (notificationOption.id !== undefined) {
				notificationToProductMap.set(notificationOption.id, product[0]);
			}
			sendNotification(notificationOption);
			if (notificationOption.id !== undefined) {
				trackedPendingNotificationIds.add(notificationOption.id);
			}
		}
	}
	logger.debug("Tracked pending notification IDs", {
		ids: getTrackedPendingNotificationIds(),
	});
}

export async function cancelNotificationsForProduct(product: Product): Promise<void> {
	const notificationIds = generateNotificationId(product);
	logger.info("Cancelling notifications for product", {
		productId: product.id.toString(),
		notificationIds,
	});
	await cancel(notificationIds);
	notificationIds.forEach((id) => {
		trackedPendingNotificationIds.delete(id);
		notificationToProductMap.delete(id);
	});
}

export async function addNewProductNotification(product: ProductWithBarcode) {
	logger.info("Adding notifications for new product", {
		productId: product[0].id.toString(),
		barcode: product[0].barcode,
	});
	const notificationOptions = createNotificationForProduct(product);
	for (const notificationOption of notificationOptions) {
		// Store product reference for share action
		if (notificationOption.id !== undefined) {
			notificationToProductMap.set(notificationOption.id, product[0]);
		}
		sendNotification(notificationOption);
		if (notificationOption.id !== undefined) {
			trackedPendingNotificationIds.add(notificationOption.id);
		}
	}
}

function createNotificationForProduct(product: ProductWithBarcode, notificationsId: number[] = generateNotificationId(product[0])): Options[] {
	const expiryDate = new Date(product[0].expiration_date);
	const productName = product[1]?.product_name;
	const productLabel = productName ?? `product ${product[0].barcode}`;

	const title = productName
		? `Expiry alert: ${productName}`
		: `Expiry alert: ${product[0].barcode}`;

	const reminders = [
		{ daysBeforeExpiry: 2, message: `${productLabel} expires in 2 days. Move it to the front of your meal plan.` },
		{ daysBeforeExpiry: 1, message: `Heads up: ${productLabel} expires tomorrow. Use it now to avoid waste.` },
		{ daysBeforeExpiry: 0, message: `Final reminder: ${productLabel} expires today. Use it now if possible.` },
	];

	return reminders.map((reminder, index) => {
		const notificationDate = new Date(expiryDate);
		notificationDate.setDate(expiryDate.getDate() - reminder.daysBeforeExpiry);
		notificationDate.setHours(9, 0, 0, 0);

		const notificationId = notificationsId[index];

		return {
			id: notificationId,
			title,
			body: reminder.message,
			largeBody: reminder.message,
			schedule: {
				at: {
					date: notificationDate,
					allowWhileIdle: true,
					repeating: false,
				},
				every: undefined,
				interval: undefined,
			},
			// Add share action button to notification (Android/iOS)
			actions: [
				{
					id: "share",
					title: "Share",
				},
			],
		} as Options;
	});
}