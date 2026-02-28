import { cancel, Channel, channels, createChannel, Options, pending, PendingNotification, sendNotification } from "@tauri-apps/plugin-notification";
import { Product } from "../bindings/Product";
import { ProductWithBarcode } from "./backend";

const channel: Channel = {
	id: "expiry-scanner",
	name: "Expiry Scanner",
	description: "Notifications for expiring products",
};

export async function initChannel() {
	let actualChannels = await channels();
	if (!actualChannels.some((c) => c.id === channel.id)) {
		createChannel(channel);
	}
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
	const actualNotifications: PendingNotification[] = await pending();
	console.log("Actual pending notifications:", actualNotifications);
	const actualNotificationIds = new Set(actualNotifications.map((n) => n.id));

	const productsWithIds = new Map<ProductWithBarcode, number[]>(products.map((p) => [p, generateNotificationId(p[0])]));
	const productsWithIdsSet = new Set<number>(Array.from(productsWithIds.values()).flat());


	const notificationsToCancelIds = actualNotifications.filter((n) => !productsWithIdsSet.has(n.id)).map((n) => n.id);
	cancel(notificationsToCancelIds)

	const notificationsToCreate = products.filter((p) => productsWithIds.get(p)!.some((id) => !actualNotificationIds.has(id)));
	for (const product of notificationsToCreate) {
		const notificationOptions = createNotificationForProduct(product, productsWithIds.get(product));
		for (const notificationOption of notificationOptions) {
			sendNotification(notificationOption);
		}
	}
}

export async function addNewProductNotification(product: ProductWithBarcode) {
	const notificationOptions = createNotificationForProduct(product);
	for (const notificationOption of notificationOptions) {
		sendNotification(notificationOption);
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