import { expect, it } from "vitest";
import { loadFullDemo, restoreBeforeDemo, SCENARIO_KEY } from "@/lib/demo/scenario";
import { DEFAULT_PROFILE } from "@/lib/discover/demo-data";
import { exportStore, readRecord, updateRecord } from "@/lib/storage/database";
import { preparationRepository } from "@/lib/preparation/repository";

it("loads a coherent full demo once and atomically restores the exact previous records", async () => {
  await updateRecord("nextstep.profile", DEFAULT_PROFILE, () => ({
    ...DEFAULT_PROFILE,
    displayName: "Original student",
    weeklyHours: 0,
  }));
  const before = await exportStore();
  await loadFullDemo();
  const profile = await readRecord("nextstep.profile", DEFAULT_PROFILE);
  expect(profile.displayName).toBe("Alex Morgan (Demo)");
  expect(profile.projects).toHaveLength(2);
  expect(profile.weeklyHours).toBe(6);
  const plans = await preparationRepository.list();
  expect(plans).toHaveLength(3);
  expect(
    plans
      .find((bundle) => bundle.opportunity.id === "aurora-ai")!
      .plan!.tasks.map((task) => task.status),
  ).toEqual(["done", "in_progress", "not_started", "not_started"]);
  expect(
    plans.find((bundle) => bundle.opportunity.id === "ledger-fintech")!.plan!.feasibility,
  ).toBe("no_remaining_gap");
  expect(
    plans.every((bundle) =>
      bundle.plan!.goals.every((goal) => bundle.profile.goals.some((fact) => fact.id === goal.id)),
    ),
  ).toBe(true);
  expect(
    plans.every((bundle) => bundle.plan!.tasks.every((task) => task.resourceIds.length === 0)),
  ).toBe(true);
  expect(await readRecord("nextstep.saved", [])).toHaveLength(3);
  await loadFullDemo();
  await restoreBeforeDemo();
  expect(await exportStore()).toEqual(before);
  expect(await readRecord(SCENARIO_KEY, null)).toBeNull();
});
