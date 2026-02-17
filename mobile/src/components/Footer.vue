<template>
	<div class="footer">
		<button type="button" @click="router.push('/')"
			:class="router.currentRoute.value.path === '/' ? 'router-active' : ''">
			<FontAwesomeIcon :icon="faList" />
		</button>
		<button type="button" @click="router.push('/scanner')"
			:class="router.currentRoute.value.path === '/scanner' ? 'router-active' : ''">
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
	background-color: aquamarine;
	display: flex;
	justify-content: space-evenly;
	align-items: center;
	flex-direction: row;
}

.footer button {
	color: rgb(61, 126, 104);
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
	background-color: rgb(61, 126, 104);
	color: aquamarine;
}

.footer button:active {
	background-color: rgb(61, 126, 104);
	color: aquamarine;
}

svg {
	width: 50%;
	height: 50%;
}
</style>