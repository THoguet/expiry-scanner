import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
		clearMocks: true,
		coverage: {
			provider: "istanbul",
			reporter: ["text", "html"],
			include: ["src/**/*.ts"],
			thresholds: {
				lines: 85,
				functions: 85,
				branches: 85,
				statements: 85,
			},
		},
	},
});
