import { createMemoryHistory, createRouter } from 'vue-router'
import { logger } from './services/logger'

import ProductList from './components/product/ProductList.vue'
import AddProduct from './components/product/AddProduct.vue'
import StockManager from './components/stock/StockManager.vue'

const routes = [
	{ path: '/', component: ProductList },
	{ path: '/AddProduct', component: AddProduct },
	{ path: '/Stock', component: StockManager },
]

export const router = createRouter({
	history: createMemoryHistory(),
	routes,
})

router.beforeEach((to, from, next) => {
	logger.debug('Navigating route', {
		from: from.fullPath,
		to: to.fullPath,
	})
	next()
})