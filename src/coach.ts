import type { Recommendation } from "./types";

export function composeCoachText(recommendation: Recommendation): string {
  const primaryReason = recommendation.reasons[0] ?? `${recommendation.championName} is the highest rated pick.`;
  const warning = recommendation.warnings[0] ? ` Watch-out: ${recommendation.warnings[0]}` : "";

  return [
    `${recommendation.championName}: ${primaryReason}`,
    recommendation.executionPlan.lanePlan,
    recommendation.executionPlan.teamfightPlan,
  ].join(" ") + warning;
}
