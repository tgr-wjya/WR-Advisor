import { describe, expect, test } from "bun:test";
import { composeCoachText, loadAdvisorData, recommendAdcs } from "../src/index";

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
      allies: [{ champion: "leona", role: "support" }],
      enemies: [{ champion: "jinx", role: "dragon" }],
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
      allies: [{ champion: "lulu", role: "support" }],
      enemies: [
        { champion: "vi", role: "jungle" },
        { champion: "nautilus", role: "support" },
        { champion: "yasuo", role: "mid" },
      ],
      unavailableChampionIds: [],
    });

    expect(result.recommendations[0].championId).toBe("zeri");
    const jinx = result.candidates.find((candidate) => candidate.championId === "jinx");
    expect(jinx?.scoreBreakdown.enemyThreats).toBeLessThan(0);
    expect(jinx?.warnings.join(" ")).toContain("lockdown");
  });

  test("uses approved champion profiles and ignores unapproved candidate profiles", () => {
    const data = loadAdvisorData();

    expect(data.championProfiles.find((profile) => profile.id === "leona")?.status).toBe("approved");
    expect(data.championProfiles.find((profile) => profile.id === "yasuo")?.status).toBe("candidate");

    const approvedThreats = recommendAdcs(data, {
      playerPickOrder: 4,
      allies: [],
      enemies: [
        { champion: "vi", role: "jungle" },
        { champion: "nautilus", role: "support" },
      ],
      unavailableChampionIds: [],
    });
    const withCandidateYasuo = recommendAdcs(data, {
      playerPickOrder: 4,
      allies: [],
      enemies: [
        { champion: "vi", role: "jungle" },
        { champion: "nautilus", role: "support" },
        { champion: "yasuo", role: "mid" },
      ],
      unavailableChampionIds: [],
    });

    expect(withCandidateYasuo.candidates.find((pick) => pick.championId === "jinx")?.scoreBreakdown.enemyThreats).toBe(
      approvedThreats.candidates.find((pick) => pick.championId === "jinx")?.scoreBreakdown.enemyThreats,
    );
  });

  test("Lulu support raises Zeri and Jinx through peel without adding engage pressure", () => {
    const data = loadAdvisorData();
    const result = recommendAdcs(data, {
      playerPickOrder: 3,
      allies: [{ champion: "lulu", role: "support" }],
      enemies: [],
      unavailableChampionIds: [],
    });

    const zeri = result.candidates.find((candidate) => candidate.championId === "zeri");
    const jinx = result.candidates.find((candidate) => candidate.championId === "jinx");
    const lucian = result.candidates.find((candidate) => candidate.championId === "lucian");

    expect(zeri?.scoreBreakdown.supportSynergy).toBeGreaterThan(0);
    expect(jinx?.scoreBreakdown.supportSynergy).toBeGreaterThan(zeri?.scoreBreakdown.supportSynergy ?? 0);
    expect(lucian?.scoreBreakdown.supportSynergy).toBeGreaterThan(0);
    expect(result.recommendations.map((pick) => pick.championId)).toContain("zeri");
    expect(result.recommendations.flatMap((pick) => pick.reasons).join(" ")).toContain("Peel");
  });

  test("enemy Jinx as a scaling target raises early-pressure options", () => {
    const data = loadAdvisorData();
    const result = recommendAdcs(data, {
      playerPickOrder: 3,
      allies: [],
      enemies: [{ champion: "jinx", role: "dragon" }],
      unavailableChampionIds: [],
    });

    expect(result.recommendations.map((pick) => pick.championId)).toContain("lucian");
    expect(result.candidates.find((pick) => pick.championId === "lucian")?.scoreBreakdown.enemyThreats).toBeGreaterThan(
      0,
    );
    expect(result.candidates.find((pick) => pick.championId === "lucian")?.reasons.join(" ")).toContain("scaling");
  });

  test("coach text is grounded in recommendation evidence", () => {
    const data = loadAdvisorData();
    const result = recommendAdcs(data, {
      playerPickOrder: 1,
      allies: [],
      enemies: [],
      unavailableChampionIds: [],
    });

    const text = composeCoachText(result.recommendations[0]);
    const evidence = [
      ...result.recommendations[0].reasons,
      ...result.recommendations[0].warnings,
      result.recommendations[0].executionPlan.lanePlan,
      result.recommendations[0].executionPlan.teamfightPlan,
    ].join(" ");

    expect(text).toContain(result.recommendations[0].championName);
    expect(text).toContain(result.recommendations[0].reasons[0]);
    expect(text).toContain(result.recommendations[0].executionPlan.lanePlan);
    expect(evidence).toContain("first-pick");
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
