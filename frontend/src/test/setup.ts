import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, afterEach } from "vitest";
import { closeStore } from "@/lib/storage/database";
beforeEach(async () => {
  await closeStore();
  globalThis.indexedDB = new IDBFactory();
  localStorage.clear();
});
afterEach(async () => {
  await closeStore();
});
