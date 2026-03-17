import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const getPagesBasePath = (): string => {
  const repositorySlug = process.env.GITHUB_REPOSITORY;

  if (repositorySlug === undefined) {
    return "/";
  }

  const [, repositoryName] = repositorySlug.split("/");

  if (repositoryName === undefined || repositoryName.length === 0) {
    return "/";
  }

  return `/${repositoryName}/`;
};

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? getPagesBasePath() : "/",
  plugins: [react()],
  root: __dirname,
  resolve: {
    alias: {
      "react-realtime-hooks": resolve(__dirname, "../src/index.ts")
    }
  },
  server: {
    open: true,
    port: 4173
  }
});
