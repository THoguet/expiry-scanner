<template>
	<div class="box" :style="`background-image: url('${barcode?.image_url}')`" @pointerdown.stop="startTimerToDelete"
		@pointerup="clearTimerToDelete" @pointercancel="clearTimerToDelete">
		<p>{{ barcode?.product_name }}</p>
		<div style="display: flex; align-items: center; gap: 0.5rem">
			<FontAwesomeIcon :icon="faCalendar" />
			<p :class="colorsByDaysLeft">{{ formatDate(pro.expiration_date) }} {{ daysLeftLabel }}d</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import { faCalendar } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { invoke } from '@tauri-apps/api/core';
import { computed, onMounted, Ref, ref, watch } from 'vue';
import { deleteProduct, ProductWithBarcode } from '../services/backend';
import { emit } from '@tauri-apps/api/event';
import { Product } from '../bindings/Product';
import { Barcode } from '../bindings/Barcode';


const props = defineProps<{
	product: ProductWithBarcode;
}>()

defineEmits<{
	(productDeleted: number): void;
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
	console.log(days);
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

function startTimerToDelete() {
	console.log("Start timer to delete product with id:", pro.value.id);
	deleteTimer = window.setTimeout(() => {
		deleteProduct({ id: pro.value.id, client_id: pro.value.client_id })
			.then(() => {
				console.log("Product deleted successfully");
				emit("productDeleted", pro.value.id);
			})
			.catch((error) => {
				console.error("Error deleting product:", error);
			});
	}, 2000);
}

function clearTimerToDelete() {
	if (deleteTimer !== null) {
		clearTimeout(deleteTimer);
		deleteTimer = null;
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
	margin: 1rem;
	border-radius: 0.5rem;
	background-color: var(--surface-overlay);
	width: 50px;
	height: 50px;
	position: relative;
	user-select: none;
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