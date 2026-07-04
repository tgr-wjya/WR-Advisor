export type ChampionId = "zeri" | "tristana" | "jinx" | "kaisa" | "lucian" | "sivir";

export type ComfortLevel = "High" | "Medium" | "Low";

export type PickTag =
  | "assassin"
  | "dive"
  | "engage"
  | "enchanter"
  | "immobile"
  | "lockdown"
  | "peel"
  | "poke"
  | "scaling"
  | "shortRange"
  | "tanks"
  | "waveclear";

export interface DraftChampion {
  champion: string;
  role?: string;
  tags?: PickTag[];
}

export interface DraftInput {
  playerPickOrder: number;
  allies: DraftChampion[];
  enemies: DraftChampion[];
  unavailableChampionIds: string[];
}

export interface PlayerChampionProfile {
  championId: ChampionId;
  totalGames: number;
  winRate: number;
  averageKda: string;
  comfortLevel: ComfortLevel;
  notes: string;
}

export interface PlayerProfile {
  role: "adc";
  champions: PlayerChampionProfile[];
}

export interface TaggedRule {
  tags: PickTag[];
  score: number;
  reason: string;
  warning?: string;
}

export interface ChampionDossier {
  id: ChampionId;
  name: string;
  playerFit: {
    comfortLevel: ComfortLevel;
    playstyleFit: "high" | "medium" | "low";
    statisticalConfidence: "high" | "medium" | "low";
    rosterNotes: string;
  };
  pickProfile: {
    identity: string;
    blindPickSafety: number;
    lanePattern: string;
    scalingCurve: string;
    damageProfile: string;
    mobility: string;
    selfPeel: string;
    objectiveDps: string;
  };
  supportSynergies: TaggedRule[];
  enemyThreatRules: TaggedRule[];
  teamNeedRules: TaggedRule[];
  execution: {
    lanePlan: string;
    teamfightPlan: string;
    defaultWarnings: string[];
  };
  patch: {
    reviewedPatch: string;
    status: "stable" | "buffed" | "nerfed" | "watch";
    notes: string;
  };
}

export type ChampionProfileStatus = "candidate" | "approved" | "rejected";

export interface ChampionKnowledgeProfile {
  id: string;
  name: string;
  status: ChampionProfileStatus;
  roles: string[];
  tags: PickTag[];
  profile: {
    draftIdentity: string;
    synergyHooks: string[];
    threatHooks: string[];
    uncertainties: string[];
  };
  sources: string[];
}

export interface AdvisorData {
  playerProfile: PlayerProfile;
  dossiers: ChampionDossier[];
  championProfiles: ChampionKnowledgeProfile[];
}

export interface ScoreBreakdown {
  playerFit: number;
  blindPickSafety: number;
  supportSynergy: number;
  enemyThreats: number;
  teamNeeds: number;
  patch: number;
}

export interface Recommendation {
  championId: ChampionId;
  championName: string;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  reasons: string[];
  warnings: string[];
  executionPlan: {
    lanePlan: string;
    teamfightPlan: string;
  };
}

export interface RecommendationResult {
  recommendations: Recommendation[];
  candidates: Recommendation[];
}
