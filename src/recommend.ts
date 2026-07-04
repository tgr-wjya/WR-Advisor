import type {
  AdvisorData,
  ChampionDossier,
  DraftChampion,
  DraftInput,
  PickTag,
  Recommendation,
  RecommendationResult,
  ScoreBreakdown,
  TaggedRule,
} from "./types";

function comfortScore(dossier: ChampionDossier): number {
  const comfort = { High: 24, Medium: 12, Low: 0 }[dossier.playerFit.comfortLevel];
  const playstyle = { high: 16, medium: 8, low: 0 }[dossier.playerFit.playstyleFit];
  const confidence = { high: 8, medium: 4, low: 1 }[dossier.playerFit.statisticalConfidence];
  return comfort + playstyle + confidence;
}

function patchScore(dossier: ChampionDossier): number {
  return { buffed: 4, stable: 0, watch: -3, nerfed: -7 }[dossier.patch.status];
}

function collectTags(picks: DraftChampion[]): PickTag[] {
  return picks.flatMap((pick) => pick.tags ?? []);
}

function applyRules(rules: TaggedRule[], tags: PickTag[]): { score: number; reasons: string[]; warnings: string[] } {
  const activeTags = new Set(tags);
  const matched = rules.filter((rule) => rule.tags.some((tag) => activeTags.has(tag)));

  return {
    score: matched.reduce((sum, rule) => sum + rule.score, 0),
    reasons: matched.filter((rule) => rule.score > 0).map((rule) => rule.reason),
    warnings: matched.filter((rule) => rule.warning).map((rule) => rule.warning as string),
  };
}

function blindPickScore(dossier: ChampionDossier, draft: DraftInput): { score: number; reason?: string } {
  const earlyPickMultiplier = draft.playerPickOrder <= 2 ? 8 : 3;
  const score = dossier.pickProfile.blindPickSafety * earlyPickMultiplier;

  if (draft.playerPickOrder <= 2 && draft.allies.length === 0 && draft.enemies.length === 0) {
    return {
      score,
      reason: `${dossier.name} has strong first-pick safety for low-information drafts.`,
    };
  }

  return { score };
}

function buildRecommendation(dossier: ChampionDossier, draft: DraftInput): Recommendation {
  const allyTags = collectTags(draft.allies);
  const enemyTags = collectTags(draft.enemies);
  const support = draft.allies.find((ally) => ally.role === "support");
  const supportTags = support?.tags ?? [];

  const supportResult = applyRules(dossier.supportSynergies, supportTags);
  const enemyResult = applyRules(dossier.enemyThreatRules, enemyTags);
  const teamNeedResult = applyRules(dossier.teamNeedRules, allyTags);
  const blind = blindPickScore(dossier, draft);

  const scoreBreakdown: ScoreBreakdown = {
    playerFit: comfortScore(dossier),
    blindPickSafety: blind.score,
    supportSynergy: supportResult.score,
    enemyThreats: enemyResult.score,
    teamNeeds: teamNeedResult.score,
    patch: patchScore(dossier),
  };

  const score = Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0);
  const reasons = [
    dossier.pickProfile.identity,
    dossier.playerFit.rosterNotes,
    blind.reason,
    ...supportResult.reasons,
    ...enemyResult.reasons,
    ...teamNeedResult.reasons,
  ].filter((reason): reason is string => Boolean(reason));

  return {
    championId: dossier.id,
    championName: dossier.name,
    score,
    scoreBreakdown,
    reasons,
    warnings: [...dossier.execution.defaultWarnings, ...supportResult.warnings, ...enemyResult.warnings],
    executionPlan: {
      lanePlan: dossier.execution.lanePlan,
      teamfightPlan: dossier.execution.teamfightPlan,
    },
  };
}

export function recommendAdcs(data: AdvisorData, draft: DraftInput): RecommendationResult {
  const unavailable = new Set(draft.unavailableChampionIds);
  const candidates = data.dossiers
    .filter((dossier) => !unavailable.has(dossier.id))
    .map((dossier) => buildRecommendation(dossier, draft))
    .sort((left, right) => right.score - left.score || left.championName.localeCompare(right.championName));

  return {
    recommendations: candidates.slice(0, 3),
    candidates,
  };
}
