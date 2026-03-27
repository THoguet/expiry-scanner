import { invoke } from "@tauri-apps/api/core";
import { vibrate } from "@tauri-apps/plugin-haptics";
import { computed, onMounted, ref, watch } from "vue";
import type { Barcode } from "../../bindings/Barcode";
import type { Product } from "../../bindings/Product";
import type { ProductWithBarcode } from "../../services/backend";
import { logger } from "../../services/logger";

const TIME_TO_DELETE_MS = 1400;
const VIBRATION_START_DELAY_MS = 280;

export function useProductBox(
	props: { product: ProductWithBarcode },
	onDeleteRequested: (product: Product) => void,
	onEditRequested: (id: bigint) => void,
) {
	const pro = ref<Product>(props.product[0]);
	const barcode = ref<Barcode | null>(props.product[1] ?? null);

	watch(
		() => props.product,
		(newProduct) => {
			pro.value = newProduct[0];
			barcode.value = newProduct[1] || null;
		},
		{ deep: true, immediate: true },
	);

	const daysLeft = ref<number | null>(null);
	const isLoadingDaysLeft = ref(true);
	const daysLeftError = ref(false);

	const colorsByDaysLeft = computed(() => {
		if (isLoadingDaysLeft.value) return "text-gray-500";
		if (daysLeftError.value || daysLeft.value === null) return "text-gray-500";
		if (daysLeft.value < 0) return "text-purple-500";
		if (daysLeft.value <= 3) return "text-red-500";
		if (daysLeft.value <= 7) return "text-yellow-500";
		return "text-green-500";
	});

	const daysLeftLabel = computed(() => {
		if (isLoadingDaysLeft.value) return "...";
		if (daysLeftError.value || daysLeft.value === null) return "N/A";
		return String(daysLeft.value);
	});

	let deleteTimer: number | null = null;
	let vibrationStartTimer: number | null = null;
	let cancelVibration: (() => void) | null = null;
	let deleteTriggered = false;

	function getName(): string {
		if (pro.value.name) return pro.value.name;
		if (barcode.value && barcode.value.product_name) return barcode.value.product_name;
		return "Unknown product; ID: " + pro.value.barcode;
	}

	function getImageUrl(): string {
		if (pro.value.image) return pro.value.image;
		if (barcode.value && barcode.value.image_url) return barcode.value.image_url;
		return "/no_img.png";
	}

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString("fr-FR", {
			year: undefined,
			month: "numeric",
			day: "numeric",
		});
	}

	async function getLeftDays(expirationDate: string): Promise<number> {
		const days = await invoke("calculate_days_left", { expiryDate: expirationDate, format: "%Y-%m-%d" });
		return days as number;
	}

	async function refreshDaysLeft(): Promise<void> {
		isLoadingDaysLeft.value = true;
		daysLeftError.value = false;
		try {
			logger.trace("Calculating days left", {
				productId: pro.value.id.toString(),
				expirationDate: pro.value.expiration_date,
			});
			daysLeft.value = await getLeftDays(pro.value.expiration_date);
		} catch (error) {
			logger.error("Error calculating days left", {
				productId: pro.value.id.toString(),
				error,
			});
			daysLeft.value = null;
			daysLeftError.value = true;
		} finally {
			isLoadingDaysLeft.value = false;
		}
	}

	function startVibrationSequence(durationMs: number, pulseCount: number = 10): () => void {
		const startInterval = 100;
		const endInterval = 10;
		const timeoutIds: number[] = [];
		const intervals: number[] = [];
		let totalInterval = 0;

		for (let i = 0; i < pulseCount; i++) {
			const t = pulseCount === 1 ? 1 : i / (pulseCount - 1);
			const eased = t * t;
			const interval = startInterval * Math.pow(endInterval / startInterval, eased);
			intervals.push(interval);
			totalInterval += interval;
		}

		let elapsed = 0;

		for (let i = 0; i < intervals.length; i++) {
			const interval = intervals[i];
			const delay = totalInterval === 0 ? 0 : Math.round((elapsed / totalInterval) * durationMs);
			const vibrationTimes = Math.max(8, Math.round((interval / totalInterval) * durationMs * 0.7));

			const timeoutId = window.setTimeout(() => {
				vibrate(vibrationTimes);
			}, delay);

			timeoutIds.push(timeoutId);
			elapsed += interval;
		}

		return () => {
			for (const timeoutId of timeoutIds) {
				clearTimeout(timeoutId);
			}
		};
	}

	function startTimerToDelete(): void {
		deleteTriggered = false;

		if (vibrationStartTimer !== null) {
			clearTimeout(vibrationStartTimer);
			vibrationStartTimer = null;
		}

		if (cancelVibration !== null) {
			cancelVibration();
			cancelVibration = null;
		}

		vibrationStartTimer = window.setTimeout(() => {
			vibrationStartTimer = null;
			if (deleteTriggered) return;

			const vibrationDuration = Math.max(200, TIME_TO_DELETE_MS - VIBRATION_START_DELAY_MS);
			cancelVibration = startVibrationSequence(vibrationDuration);
		}, VIBRATION_START_DELAY_MS);

		deleteTimer = window.setTimeout(() => {
			deleteTriggered = true;

			if (vibrationStartTimer !== null) {
				clearTimeout(vibrationStartTimer);
				vibrationStartTimer = null;
			}

			deleteTimer = null;

			if (cancelVibration !== null) {
				cancelVibration();
				cancelVibration = null;
			}

			onDeleteRequested(pro.value);
		}, TIME_TO_DELETE_MS);
	}

	function openEditPanel(): void {
		if (deleteTriggered) {
			deleteTriggered = false;
			return;
		}

		if (deleteTimer !== null) {
			clearTimeout(deleteTimer);
			deleteTimer = null;
		}
		if (vibrationStartTimer !== null) {
			clearTimeout(vibrationStartTimer);
			vibrationStartTimer = null;
		}
		if (cancelVibration !== null) {
			cancelVibration();
			cancelVibration = null;
		}
		onEditRequested(pro.value.id);
	}

	function clearTimerToDelete(): void {
		if (deleteTimer !== null) {
			clearTimeout(deleteTimer);
			deleteTimer = null;
		}
		if (vibrationStartTimer !== null) {
			clearTimeout(vibrationStartTimer);
			vibrationStartTimer = null;
		}
		if (cancelVibration !== null) {
			cancelVibration();
			cancelVibration = null;
		}
	}

	onMounted(() => {
		void refreshDaysLeft();
	});

	return {
		pro,
		colorsByDaysLeft,
		daysLeftLabel,
		getName,
		getImageUrl,
		formatDate,
		startTimerToDelete,
		openEditPanel,
		clearTimerToDelete,
	};
}
