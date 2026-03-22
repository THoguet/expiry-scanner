<template>
	<div class="box" :style="`background-image: url('${getImageUrl()}')`" @pointerdown.stop="startTimerToDelete"
		@pointerup="openEditPanel()" @pointercancel="clearTimerToDelete">
		<div class="text-background">
			<p>{{ getName() }}</p>
			<div style="display: flex; align-items: center; gap: 0.5rem">
				<FontAwesomeIcon :icon="faCalendar" />
				<p :class="colorsByDaysLeft">{{ formatDate(pro.expiration_date) }} {{ daysLeftLabel }}d</p>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { faCalendar } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { invoke } from '@tauri-apps/api/core';
import { computed, onMounted, Ref, ref, watch } from 'vue';
import { ProductWithBarcode } from '../services/backend';
import { Product } from '../bindings/Product';
import { Barcode } from '../bindings/Barcode';
import { vibrate } from '@tauri-apps/plugin-haptics';


const props = defineProps<{
	product: ProductWithBarcode;
}>()

const emitEvent = defineEmits<{
	deleteProductRequested: [product: Product];
	editProduct: [id: bigint];
}>();

let pro: Ref<Product> = ref(props.product[0]);
let barcode: Ref<Barcode | null> = ref(props.product[1] || null);

watch(() => props.product, (newProduct) => {
	pro.value = newProduct[0];
	barcode.value = newProduct[1] || null;
}, { deep: true, immediate: true });

const colorsByDaysLeft = computed(() => {
	if (isLoadingDaysLeft.value) return 'text-gray-500';
	if (daysLeftError.value || daysLeft.value === null) return 'text-gray-500';
	if (daysLeft.value < 0) return 'text-purple-500';
	if (daysLeft.value <= 3) return 'text-red-500';
	if (daysLeft.value <= 7) return 'text-yellow-500';
	return 'text-green-500';
});

const daysLeft = ref<number | null>(null);
const isLoadingDaysLeft = ref(true);
const daysLeftError = ref(false);

const TIME_TO_DELETE_MS = 2000;

function getName(): string {
	// Use product snapshot (stored at creation time)
	if (pro.value.name) return pro.value.name;
	// Fallback to barcode data if name is missing (backward compatibility)
	if (barcode.value && barcode.value.product_name) return barcode.value.product_name;
	return "Unknown product; ID: " + pro.value.barcode;
}

function getImageUrl(): string {
	// Use product snapshot (stored at creation time)
	if (pro.value.image) return pro.value.image;
	// Fallback to barcode data if image is missing (backward compatibility)
	if (barcode.value && barcode.value.image_url) return barcode.value.image_url;
	return "/no_img.png";
}

function formatDate(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleDateString("fr-FR", {
		year: undefined,
		month: "numeric",
		day: "numeric"
	});
}

async function getLeftDays(expirationDate: string): Promise<number> {
	const days = await invoke("calculate_days_left", { expiryDate: expirationDate, format: "%Y-%m-%d" });
	return days as number;
}

const daysLeftLabel = computed(() => {
	if (isLoadingDaysLeft.value) return '...';
	if (daysLeftError.value || daysLeft.value === null) return 'N/A';
	return String(daysLeft.value);
});

async function refreshDaysLeft(): Promise<void> {
	isLoadingDaysLeft.value = true;
	daysLeftError.value = false;
	try {
		daysLeft.value = await getLeftDays(pro.value.expiration_date);
	} catch (error) {
		console.error("Error calculating days left:", error);
		daysLeft.value = null;
		daysLeftError.value = true;
	} finally {
		isLoadingDaysLeft.value = false;
	}
}

let deleteTimer: number | null = null;
let cancelVibration: (() => void) | null = null;

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

function startTimerToDelete() {
	if (cancelVibration !== null) {
		cancelVibration();
		cancelVibration = null;
	}
	cancelVibration = startVibrationSequence(TIME_TO_DELETE_MS);
	console.log("Start timer to delete product with id:", pro.value.id);
	deleteTimer = window.setTimeout(() => {
		if (cancelVibration !== null) {
			cancelVibration();
			cancelVibration = null;
		}
		emitEvent('deleteProductRequested', pro.value);
	}, TIME_TO_DELETE_MS);
}

function openEditPanel() {
	if (deleteTimer !== null) {
		clearTimeout(deleteTimer);
		deleteTimer = null;
	}
	if (cancelVibration !== null) {
		cancelVibration();
		cancelVibration = null;
	}
	emitEvent('editProduct', pro.value.id);
}

function clearTimerToDelete() {
	if (deleteTimer !== null) {
		clearTimeout(deleteTimer);
		deleteTimer = null;
	}
	if (cancelVibration !== null) {
		cancelVibration();
		cancelVibration = null;
	}
}

onMounted(refreshDaysLeft);

</script>

<style scoped>
p {
	margin: 0;
	font-size: smaller;
	color: var(--text-primary);
}

.box {
	border: 1px solid var(--surface-border);
	padding: 1rem;
	border-radius: 0.5rem;
	background-color: var(--surface-overlay);
	min-width: 50px;
	min-height: 50px;
	max-width: calc(40vw - 2rem);
	max-height: calc(40vw - 2rem);
	position: relative;
	user-select: none;
	background-size: contain;
	background-position: center;
}

.text-background {
	background: var(--surface-overlay);
	padding: 0.5rem;
	border-radius: 0.5rem;
}

.box:active {
	animation: shake 2s linear;
}

@keyframes shake {
	0% {
		transform: rotate(0deg);
	}

	18% {
		transform: rotate(4deg);
	}

	31% {
		transform: rotate(-4deg);
	}

	42% {
		transform: rotate(5deg);
	}

	51% {
		transform: rotate(-5deg);
	}

	59% {
		transform: rotate(5deg);
	}

	66% {
		transform: rotate(-5deg);
	}

	72% {
		transform: rotate(5deg);
	}

	77% {
		transform: rotate(-5deg);
	}

	81% {
		transform: rotate(5deg);
	}

	85% {
		transform: rotate(-5deg);
	}

	88% {
		transform: rotate(5deg);
	}

	91% {
		transform: rotate(-5deg);
	}

	93% {
		transform: rotate(5deg);
	}

	95% {
		transform: rotate(-5deg);
	}

	96.4% {
		transform: rotate(5deg);
	}

	97.5% {
		transform: rotate(-5deg);
	}

	98.3% {
		transform: rotate(5deg);
	}

	98.9% {
		transform: rotate(-5deg);
	}

	99.4% {
		transform: rotate(5deg);
	}

	99.7% {
		transform: rotate(-5deg);
	}

	100% {
		transform: rotate(0deg);
	}
}


.text-gray-500 {
	color: #9ca3af;
}

.text-purple-500 {
	color: #a855f7;
}

.text-red-500 {
	color: #ef4444;
}

.text-yellow-500 {
	color: #eab308;
}

.text-green-500 {
	color: #22c55e;
}
</style>