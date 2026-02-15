<template>
	<div class="footer">
		<RouterLink :to="ProductList">
			<FontAwesomeIcon :icon="faList" />
		</RouterLink>
		<RouterLink :to="Scanner">
			<FontAwesomeIcon :icon="faCamera" />
		</RouterLink>
	</div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCamera, faList } from '@fortawesome/free-solid-svg-icons';
import ProductList from './ProductList.vue';
import Scanner from './Scanner.vue';

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

.footer a {
	color: rgb(61, 126, 104);
	height: 100%;
	width: 35%;
	display: flex;
	justify-content: center;
	align-items: center;
}

svg {
	width: 50%;
	height: 50%;
}
</style>