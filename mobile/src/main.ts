import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./routes";
import { getClientId } from "./services/ClientId";
import { initializeLogging, logger } from "./services/logger";

export const CLIENT_ID = getClientId();

void initializeLogging();
logger.info("Application bootstrap started", { clientId: CLIENT_ID });

createApp(App).use(router).mount("#app");

logger.info("Application mounted");
