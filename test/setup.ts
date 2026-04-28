import { configure } from "@testing-library/react";

// Wrap every render in `<React.StrictMode>` so the hook test suite
// double-invokes component bodies and runs effects mount → unmount →
// mount in dev. This is the most reliable automated way to surface
// cleanup leaks, write-during-render anti-patterns, and stale-closure
// bugs in custom hooks. Individual tests can opt out by passing
// `reactStrictMode: false` to `render` / `renderHook`.
configure({
  reactStrictMode: true
});
