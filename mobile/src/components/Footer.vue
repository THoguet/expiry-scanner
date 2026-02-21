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
	</div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCamera, faList } from '@fortawesome/free-solid-svg-icons';

const router = useRouter();

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
}

.footer button {
	color: var(--brand-strong);
	height: 100%;
	width: 50%;
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