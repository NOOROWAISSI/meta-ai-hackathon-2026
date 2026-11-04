import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLocalState } from "@/lib/discover/use-local-state";
import { readRecord } from "@/lib/storage/database";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("confirmed transactional browser storage", () => {
  it("migrates existing saved items before hydration and preserves them in IndexedDB", async () => {
    localStorage.setItem("nextstep.saved", JSON.stringify(["aurora-ai"]));
    const { result } = renderHook(() => useLocalState<string[]>("nextstep.saved", []));
    await waitFor(() => expect(result.current[2]).toBe(true));
    expect(result.current[0]).toEqual(["aurora-ai"]);
    expect(await readRecord("nextstep.saved", [])).toEqual(["aurora-ai"]);
    expect(localStorage.getItem("nextstep.saved")).toBeNull();
  });
  it("does not report a save until the transaction succeeds, and keeps the prior value after failure", async () => {
    const { result } = renderHook(() => useLocalState<string[]>("nextstep.saved", []));
    await waitFor(() => expect(result.current[2]).toBe(true));
    const write = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
      throw new Error("quota");
    });
    await act(async () => {
      expect(await result.current[1](["aurora-ai"])).toBe(false);
    });
    expect(result.current[0]).toEqual([]);
    expect(await readRecord("nextstep.saved", [])).toEqual([]);
    write.mockRestore();
    await act(async () => {
      expect(await result.current[1](["aurora-ai"])).toBe(true);
    });
    expect(result.current[0]).toEqual(["aurora-ai"]);
  });
});
