import { afterEach, describe, expect, it, vi } from "vitest";
import { savedAnalysis, savedResults, savedService, type SavedSnapshot } from "@/lib/saved/service";
import { DEFAULT_PROFILE, DEMO_HACKATHONS } from "@/lib/discover/demo-data";
import { readRecord, transaction, updateRecord } from "@/lib/storage/database";
import { loadFullDemo } from "@/lib/demo/scenario";
import { preparationRepository } from "@/lib/preparation/repository";
import { requestPersonalAnalysis } from "@/lib/details/api";
import { buildEventDetails } from "@/lib/details/records";

afterEach(() => vi.restoreAllMocks());
const snapshot: SavedSnapshot = {
  ids: DEMO_HACKATHONS.map((event) => event.id),
  catalog: DEMO_HACKATHONS,
  profile: DEFAULT_PROFILE,
  plannedIds: [],
  savedAt: {},
};

describe("saved opportunities", () => {
  it("searches only saved titles/organizers, filters formats, and puts unknown deadlines last", () => {
    expect(
      savedResults(snapshot, "northlight", "all", "deadline").map((event) => event.id),
    ).toEqual(["aurora-ai"]);
    expect(savedResults(snapshot, "", "online", "deadline").map((event) => event.id)).toEqual([
      "aurora-ai",
      "ledger-fintech",
    ]);
    expect(savedResults(snapshot, "", "all", "deadline").at(-1)!.id).toBe("orbit-games");
    expect(savedResults(snapshot, "missing", "all", "deadline")).toEqual([]);
    expect(savedResults({ ...snapshot, ids: [] }, "", "all", "recent")).toEqual([]);
  });
  it("orders recorded saves by timestamp and keeps legacy save times unknown", async () => {
    localStorage.setItem("nextstep.saved", JSON.stringify(["aurora-ai", "orbit-games"]));
    await updateRecord<string[]>("nextstep.saved", [], (ids) => [...ids, "ledger-fintech"]);
    const data = await savedService.load();
    expect(data.savedAt["aurora-ai"]).toBeUndefined();
    expect(data.savedAt["orbit-games"]).toBeUndefined();
    expect(data.savedAt["ledger-fintech"]).toBeTruthy();
    expect(savedResults(data, "", "all", "recent").map((event) => event.id)).toEqual([
      "ledger-fintech",
      "orbit-games",
      "aurora-ai",
    ]);
  });
  it("confirms removal and idempotent undo while preserving accepted preparation and save order", async () => {
    await loadFullDemo();
    const before = await preparationRepository.load("aurora-ai");
    const receipt = await savedService.remove("aurora-ai");
    expect(await readRecord("nextstep.saved", [])).not.toContain("aurora-ai");
    expect((await preparationRepository.load("aurora-ai")).plan).toEqual(before.plan);
    await savedService.undo(receipt);
    await savedService.undo(receipt);
    expect(await readRecord("nextstep.saved", [])).toEqual([
      "aurora-ai",
      "tidewater-climate",
      "ledger-fintech",
    ]);
    expect((await preparationRepository.list()).length).toBe(3);
  });
  it("keeps confirmed bookmarks on write failure, and rolls back metadata and bookmarks together", async () => {
    await updateRecord("nextstep.saved", [], () => ["aurora-ai"]);
    const write = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
      throw new Error("Storage quota");
    });
    await expect(savedService.remove("aurora-ai")).rejects.toThrow();
    expect(await readRecord("nextstep.saved", [])).toEqual(["aurora-ai"]);
    write.mockRestore();
    const receipt = await savedService.remove("aurora-ai");
    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      value,
      key,
    ) {
      if (key === "nextstep.savedAt") throw new Error("metadata failure");
      return originalPut.call(this, value, key);
    });
    await expect(savedService.undo(receipt)).rejects.toThrow();
    expect(await readRecord("nextstep.saved", [])).toEqual([]);
  });
  it("undo preserves newer bookmarks written by another screen", async () => {
    await updateRecord("nextstep.saved", [], () => ["aurora-ai"]);
    const receipt = await savedService.remove("aurora-ai");
    await updateRecord<string[]>("nextstep.saved", [], (ids) => [...ids, "orbit-games"]);
    await savedService.undo(receipt);
    expect(await readRecord("nextstep.saved", [])).toEqual(["aurora-ai", "orbit-games"]);
    expect(
      await transaction<string[]>("readonly", (store, finish) => {
        const request = store.getAllKeys();
        request.onsuccess = () =>
          finish(request.result.filter((key) => String(key).startsWith("plan:")).map(String));
      }),
    ).toEqual([]);
  });
  it("uses existing analysis only and suppresses stale or unsupported personalized explanations", async () => {
    const event = DEMO_HACKATHONS[0]!;
    const profile = { ...DEFAULT_PROFILE, interests: ["AI"], skills: ["Python"] };
    expect(savedAnalysis(event, profile, null)).toBeNull();
    const analysis = await requestPersonalAnalysis(buildEventDetails(event.id)!, profile);
    expect(savedAnalysis(event, profile, analysis)?.reason).toContain("AI");
    expect(savedAnalysis(event, profile, analysis)?.status).toContain("unknown");
    expect(savedAnalysis(event, { ...profile, interests: [], skills: [] }, analysis)).toMatchObject(
      { outdated: true, reason: undefined },
    );
  });
});
