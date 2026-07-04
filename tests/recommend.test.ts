import { describe, expect, test } from "bun:test";
import { loadAdvisorData, recommendAdcs } from "../src/index";

describe("Wild Rift ADC advisor", () => {
  test("loads six valid V1 core ADC dossiers", () => {
    const data = loadAdvisorData();

    expect(data.dossiers.map((dossier) => dossier.id).sort()).toEqual([
      "jinx",
      "kaisa",
      "lucian",
      "sivir",
      "tristana",
      "zeri",
    ]);

    for (const dossier of data.dossiers) {
      expect(dossier.pickProfile.identity.length).toBeGreaterThan(12);
      expect(dossier.pickProfile.blindPickSafety).toBeGreaterThanOrEqual(1);
      expect(dossier.pickProfile.blindPickSafety).toBeLessThanOrEqual(5);
      expect(dossier.patch.reviewedPatch.length).toBeGreaterThan(0);
      expect(dossier.playerFit.rosterNotes.length).toBeGreaterThan(0);
    }
  });

  test("loads dossiers from YAML files", () => {
    const data = loadAdvisorData();

    expect(data.dossiers.every((dossier) => dossier.patch.reviewedPatch === "manual-v1")).toBe(true);
  });

  test("supports first-pick drafts with little information", () => {
    const data = loadAdvisorData();
    const result = recommendAdcs(data, {
      playerPickOrder: 1,
      allies: [],
      enemies: [],
      unavailableChampionIds: [],
    });

    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations[0].championId).toBe("zeri");
    expect(result.recommendations[0].scoreBreakdown.blindPickSafety).toBeGreaterThan(0);
    expect(result.recommendations[0].reasons.join(" ")).toContain("first-pick");
    expect(result.recommendations[0].executionPlan.lanePlan.length).toBeGreaterThan(20);
    expect(result.recommendations[0].executionPlan.teamfightPlan.length).toBeGreaterThan(20);
    expect(result.recommendations[0].warnings.length).toBeGreaterThan(0);
  });

  test("raises Lucian when an engage support creates lane pressure", () => {
    const data = loadAdvisorData();
    const result = recommendAdcs(data, {
      playerPickOrder: 3,
      allies: [{ champion: "Leona", role: "support", tags: ["engage", "lockdown"] }],
      enemies: [{ champion: "Jinx", role: "dragon", tags: ["scaling", "immobile"] }],
      unavailableChampionIds: [],
    });

    expect(result.recommendations[0].championId).toBe("lucian");
    expect(result.recommendations[0].scoreBreakdown.supportSynergy).toBeGreaterThan(0);
    expect(result.recommendations[0].reasons.join(" ")).toContain("engage support");
  });

  test("penalizes fragile picks into heavy lockdown and favors safer mobility", () => {
    const data = loadAdvisorData();
    const result = recommendAdcs(data, {
      playerPickOrder: 4,
      allies: [{ champion: "Lulu", role: "support", tags: ["enchanter", "peel"] }],
      enemies: [
        { champion: "Vi", role: "jungle", tags: ["lockdown", "dive"] },
        { champion: "Nautilus", role: "support", tags: ["lockdown", "engage"] },
        { champion: "Yasuo", role: "mid", tags: ["dive", "assassin"] },
      ],
      unavailableChampionIds: [],
    });

    expect(result.recommendations[0].championId).toBe("zeri");
    const jinx = result.candidates.find((candidate) => candidate.championId === "jinx");
    expect(jinx?.scoreBreakdown.enemyThreats).toBeLessThan(0);
    expect(jinx?.warnings.join(" ")).toContain("lockdown");
  });

  test("excludes unavailable champions from ranking", () => {
    const data = loadAdvisorData();
    const result = recommendAdcs(data, {
      playerPickOrder: 1,
      allies: [],
      enemies: [],
      unavailableChampionIds: ["zeri", "tristana"],
    });

    expect(result.recommendations.map((pick) => pick.championId)).not.toContain("zeri");
    expect(result.recommendations.map((pick) => pick.championId)).not.toContain("tristana");
    expect(result.recommendations[0].championId).toBe("kaisa");
  });
});
