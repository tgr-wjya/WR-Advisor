import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  integrations: [react()],
  srcDir: "./src",
  publicDir: "./public",
  outDir: "./dist"
});
