import { invoke } from '@tauri-apps/api/core';
import type { Product } from '../bindings/Product';

/**
 * Share a product expiry alert via the native share sheet
 * @param product The product to share
 * @returns Promise that resolves when share sheet is closed
 */
export async function shareProductExpiryAlert(product: Product): Promise<void> {
	const expirationDate = new Date(product.expiration_date);
	const today = new Date();
	const daysLeft = Math.ceil(
		(expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
	);

	// Format days left message
	let daysMessage = '';
	if (daysLeft < 0) {
		daysMessage = `expired ${Math.abs(daysLeft)} days ago`;
	} else if (daysLeft === 0) {
		daysMessage = 'expires today';
	} else if (daysLeft === 1) {
		daysMessage = 'expires tomorrow';
	} else {
		daysMessage = `expires in ${daysLeft} days`;
	}

	// Create share message
	const shareMessage = `Expiry Alert: ${product.name} ${daysMessage} (${expirationDate.toLocaleDateString()})`;

	try {
		await invoke('plugin:sharesheet|share', {
			text: shareMessage,
		});
	} catch (error) {
		console.error('Failed to share product:', error);
		throw error;
	}
}
