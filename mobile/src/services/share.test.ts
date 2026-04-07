import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shareProductExpiryAlert } from './share';
import type { Product } from '../bindings/Product';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(),
}));

describe('share service', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('shareProductExpiryAlert', () => {
		it('shares product with expiry status when days left is positive', async () => {
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 3);
			const product: Product = {
				id: BigInt(1),
				barcode: '123456',
				name: 'Milk',
				image: null,
				expiration_date: tomorrow.toISOString().split('T')[0],
				created_at: new Date().toISOString(),
				was_previously_frozen: false,
			};

			await shareProductExpiryAlert(product);

			expect(invoke).toHaveBeenCalledWith('plugin:sharesheet|share', {
				text: expect.stringContaining('Milk'),
			});
			expect(invoke).toHaveBeenCalledWith('plugin:sharesheet|share', {
				text: expect.stringContaining('expires in 3 days'),
			});
		});

		it('shares product with "expires tomorrow" when one day left', async () => {
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			const product: Product = {
				id: BigInt(1),
				barcode: '123456',
				name: 'Bread',
				image: null,
				expiration_date: tomorrow.toISOString().split('T')[0],
				created_at: new Date().toISOString(),
				was_previously_frozen: false,
			};

			await shareProductExpiryAlert(product);

			expect(invoke).toHaveBeenCalledWith('plugin:sharesheet|share', {
				text: expect.stringContaining('expires tomorrow'),
			});
		});

		it('shares product with "expires today" when expiring today', async () => {
			const today = new Date();
			const product: Product = {
				id: BigInt(1),
				barcode: '123456',
				name: 'Cheese',
				image: null,
				expiration_date: today.toISOString().split('T')[0],
				created_at: new Date().toISOString(),
				was_previously_frozen: false,
			};

			await shareProductExpiryAlert(product);

			expect(invoke).toHaveBeenCalledWith('plugin:sharesheet|share', {
				text: expect.stringContaining('expires today'),
			});
		});

		it('shares product with expired status when past expiry', async () => {
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 2);
			const product: Product = {
				id: BigInt(1),
				barcode: '123456',
				name: 'Yogurt',
				image: null,
				expiration_date: yesterday.toISOString().split('T')[0],
				created_at: new Date().toISOString(),
				was_previously_frozen: false,
			};

			await shareProductExpiryAlert(product);

			expect(invoke).toHaveBeenCalledWith('plugin:sharesheet|share', {
				text: expect.stringContaining('expired 2 days ago'),
			});
		});

		it('throws when invoke fails', async () => {
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			const product: Product = {
				id: BigInt(1),
				barcode: '123456',
				name: 'Eggs',
				image: null,
				expiration_date: tomorrow.toISOString().split('T')[0],
				created_at: new Date().toISOString(),
				was_previously_frozen: false,
			};

			const error = new Error('Share failed');
			vi.mocked(invoke).mockRejectedValueOnce(error);

			await expect(shareProductExpiryAlert(product)).rejects.toThrow('Share failed');
		});

		it('includes formatted expiration date in message', async () => {
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 7);
			const product: Product = {
				id: BigInt(1),
				barcode: '123456',
				name: 'Butter',
				image: null,
				expiration_date: tomorrow.toISOString().split('T')[0],
				created_at: new Date().toISOString(),
				was_previously_frozen: false,
			};

			await shareProductExpiryAlert(product);

			expect(invoke).toHaveBeenCalledWith('plugin:sharesheet|share', {
				text: expect.stringMatching(/\d{1,2}\/\d{1,2}\/\d{4}/),
			});
		});
	});
});
