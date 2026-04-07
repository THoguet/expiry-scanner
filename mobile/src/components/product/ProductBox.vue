<template>
	<div class="box" :style="`background-image: url('${getImageUrl()}')`" @pointerdown.stop="startTimerToDelete"
		@pointerup="openEditPanel()" @pointercancel="clearTimerToDelete">
		<span v-if="pro.was_previously_frozen" class="frozen-badge" title="Previously frozen — cannot be re-frozen">🧊</span>
		<button v-if="!pro.was_previously_frozen" class="freeze-btn" title="Freeze this product"
			@pointerdown.stop @pointerup.stop @click.stop="emitEvent('freezeRequested', pro)">
			❄️
		</button>
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
import type { ProductWithBarcode } from '../../services/backend';
import type { Product } from '../../bindings/Product';
import { useProductBox } from '../../composables/product/useProductBox';


const props = defineProps<{
	product: ProductWithBarcode;
}>()

const emitEvent = defineEmits<{
	deleteProductRequested: [product: Product];
	editProduct: [id: bigint];
	freezeRequested: [product: Product];
}>();

const {
	pro,
	colorsByDaysLeft,
	daysLeftLabel,
	getName,
	getImageUrl,
	formatDate,
	startTimerToDelete,
	openEditPanel,
	clearTimerToDelete,
} = useProductBox(
	props,
	(product) => emitEvent('deleteProductRequested', product),
	(id) => emitEvent('editProduct', id),
);

</script>

<style scoped src="./styles/product-box.css"></style>