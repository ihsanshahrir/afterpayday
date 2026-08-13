import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify("0.0.0-test"),
  },
  resolve: {
    alias: {
      "virtual:pwa-register/react": new URL("./test/stubs/pwa-register.js", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.js"],
    include: ["**/*.test.{js,jsx}"],
  },
});
