<template>
	<div class="footer">
		<button type="button" @click="router.push('/')"
			:class="router.currentRoute.value.path === '/' ? 'router-active' : ''">
			<FontAwesomeIcon :icon="faList" />
		</button>
		<button type="button" @click="router.push('/AddProduct')"
			:class="router.currentRoute.value.path === '/AddProduct' ? 'router-active' : ''">
			<FontAwesomeIcon :icon="faCamera" />
		</button>
		<button type="button" @click="router.push('/Freezer')"
			:class="router.currentRoute.value.path === '/Freezer' ? 'router-active' : ''" title="Freezer">
			<FontAwesomeIcon :icon="faSnowflake" />
		</button>
		<button type="button" @click="router.push('/Stock')"
			:class="router.currentRoute.value.path === '/Stock' ? 'router-active' : ''" title="Stock manager">
			<FontAwesomeIcon :icon="faBoxesStacked" />
		</button>
		<button type="button" @click="openClientIdModal" title="Settings">
			<FontAwesomeIcon :icon="faCog" />
		</button>
	</div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faBoxesStacked, faCamera, faList, faCog, faSnowflake } from '@fortawesome/free-solid-svg-icons';

const router = useRouter();

const emit = defineEmits<{ openClientIdModal: [] }>();

function openClientIdModal() {
	emit('openClientIdModal');
}

</script>

<style scoped>
.footer {
	width: 100vw;
	height: 7.5vh;
	background-color: var(--surface-strong);
	border-top: 1px solid var(--surface-border);
	display: flex;
	justify-content: space-evenly;
	align-items: center;
	flex-direction: row;
	position: fixed;
	bottom: 0;
	z-index: 100;
}

.footer button {
	color: var(--brand-strong);
	height: 100%;
	width: 20%;
	display: flex;
	justify-content: center;
	align-items: center;
	background: transparent;
	border: none;
	transition: all 0.25s ease-in-out;
}

button.router-active {
	background-color: var(--brand);
	color: var(--surface);
}

.footer button:active {
	background-color: var(--brand);
	color: var(--surface);
}

svg {
	width: 50%;
	height: 50%;
}
</style>