import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
		clearMocks: true,
		coverage: {
			provider: "istanbul",
			reporter: ["text", "html", "json", "lcov"],
			include: ["src/**/*.ts"],
			thresholds: {
				lines: 90,
				functions: 90,
				branches: 90,
				statements: 90,
			},
		},
	},
});
