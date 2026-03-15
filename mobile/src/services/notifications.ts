import { cancel, isPermissionGranted, Options, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { Product } from "../bindings/Product";
import { ProductWithBarcode } from "./backend";

const trackedPendingNotificationIds = new Set<number>();

export function getTrackedPendingNotificationIds(): number[] {
	return Array.from(trackedPendingNotificationIds);
}

export async function checkPermissions(): Promise<boolean> {
	let permissionGranted = await isPermissionGranted();
	if (!permissionGranted) {
		const permission = await requestPermission();
		permissionGranted = permission === 'granted';
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
	const productsWithIds = new Map<ProductWithBarcode, number[]>(products.map((p) => [p, generateNotificationId(p[0])]));
	const productsWithIdsSet = new Set<number>(Array.from(productsWithIds.values()).flat());

	const notificationsToCancelIds = Array.from(trackedPendingNotificationIds).filter((id) => !productsWithIdsSet.has(id));
	if (notificationsToCancelIds.length > 0) {
		await cancel(notificationsToCancelIds);
	}
	notificationsToCancelIds.forEach((id) => trackedPendingNotificationIds.delete(id));

	const hasPermission = await checkPermissions();
	if (!hasPermission) {
		return;
	}

	const notificationsToCreate = products.filter((p) => productsWithIds.get(p)!.some((id) => !trackedPendingNotificationIds.has(id)));
	for (const product of notificationsToCreate) {
		const notificationOptions = createNotificationForProduct(product, productsWithIds.get(product));
		for (const notificationOption of notificationOptions) {
			sendNotification(notificationOption);
			if (notificationOption.id !== undefined) {
				trackedPendingNotificationIds.add(notificationOption.id);
			}
		}
	}
	console.log("tracked pending notification ids:", getTrackedPendingNotificationIds());
}

export async function cancelNotificationsForProduct(product: Product): Promise<void> {
	const notificationIds = generateNotificationId(product);
	await cancel(notificationIds);
	notificationIds.forEach((id) => trackedPendingNotificationIds.delete(id));
}

export async function addNewProductNotification(product: ProductWithBarcode) {
	const notificationOptions = createNotificationForProduct(product);
	for (const notificationOption of notificationOptions) {
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

		return {
			id: notificationsId[index],
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
		};
	});
}