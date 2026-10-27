import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocalState } from "@/lib/discover/use-local-state";

describe("confirmed browser storage", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("preserves existing saved items on hydration", () => {
    localStorage.setItem("saved", JSON.stringify(["aurora-ai"]));
    const { result } = renderHook(() => useLocalState<string[]>("saved", []));
    expect(result.current[0]).toEqual(["aurora-ai"]);
    expect(JSON.parse(localStorage.getItem("saved")!)).toEqual(["aurora-ai"]);
  });

  it("does not report a save when storage rejects it, and allows retry", () => {
    const { result } = renderHook(() => useLocalState<string[]>("saved", []));
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    act(() => {
      expect(result.current[1](["aurora-ai"])).toBe(false);
    });
    expect(result.current[0]).toEqual([]);
    write.mockRestore();
    act(() => {
      expect(result.current[1](["aurora-ai"])).toBe(true);
    });
    expect(result.current[0]).toEqual(["aurora-ai"]);
    expect(JSON.parse(localStorage.getItem("saved")!)).toEqual(["aurora-ai"]);
  });
});
