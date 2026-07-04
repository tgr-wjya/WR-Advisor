import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import type { AdvisorData, ChampionDossier, ChampionKnowledgeProfile, PlayerProfile } from "./types";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

const pickTagSchema = z.enum([
  "assassin",
  "dive",
  "engage",
  "enchanter",
  "immobile",
  "lockdown",
  "peel",
  "poke",
  "scaling",
  "shortRange",
  "tanks",
  "waveclear",
]);

const taggedRuleSchema = z.object({
  tags: z.array(pickTagSchema).min(1),
  score: z.number(),
  reason: z.string().min(1).optional(),
  warning: z.string().min(1).optional(),
});

const championProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["candidate", "approved", "rejected"]),
  roles: z.array(z.string().min(1)).min(1),
  tags: z.array(pickTagSchema),
  profile: z.object({
    draftIdentity: z.string().min(1),
    synergyHooks: z.array(z.string().min(1)),
    threatHooks: z.array(z.string().min(1)),
    uncertainties: z.array(z.string().min(1)),
  }),
  sources: z.array(z.string().min(1)),
});

const dossierSchema = z.object({
  id: z.enum(["zeri", "tristana", "jinx", "kaisa", "lucian", "sivir"]),
  name: z.string().min(1),
  playerFit: z.object({
    comfortLevel: z.enum(["High", "Medium", "Low"]),
    playstyleFit: z.enum(["high", "medium", "low"]),
    statisticalConfidence: z.enum(["high", "medium", "low"]),
    rosterNotes: z.string().min(1),
  }),
  pickProfile: z.object({
    identity: z.string().min(1),
    blindPickSafety: z.number().int().min(1).max(5),
    lanePattern: z.string().min(1),
    scalingCurve: z.string().min(1),
    damageProfile: z.string().min(1),
    mobility: z.string().min(1),
    selfPeel: z.string().min(1),
    objectiveDps: z.string().min(1),
  }),
  supportSynergies: z.array(taggedRuleSchema),
  enemyThreatRules: z.array(taggedRuleSchema),
  teamNeedRules: z.array(taggedRuleSchema),
  execution: z.object({
    lanePlan: z.string().min(1),
    teamfightPlan: z.string().min(1),
    defaultWarnings: z.array(z.string().min(1)),
  }),
  patch: z.object({
    reviewedPatch: z.string().min(1),
    status: z.enum(["stable", "buffed", "nerfed", "watch"]),
    notes: z.string().min(1),
  }),
});

function readYamlDossier(path: string): ChampionDossier {
  const parsed = parseYaml(readFileSync(path, "utf8"));
  return dossierSchema.parse(parsed) as ChampionDossier;
}

function readYamlChampionProfile(path: string): ChampionKnowledgeProfile {
  const parsed = parseYaml(readFileSync(path, "utf8"));
  return championProfileSchema.parse(parsed) as ChampionKnowledgeProfile;
}

export function loadAdvisorData(rootDir = process.cwd()): AdvisorData {
  const dataDir = join(rootDir, "data");
  const playerProfile = readJson<PlayerProfile>(join(dataDir, "player-profile.json"));
  const dossierDir = join(dataDir, "dossiers");
  const championDir = join(dataDir, "champions");
  const dossiers = readdirSync(dossierDir)
    .filter((file) => file.endsWith(".yaml") || file.endsWith(".yml"))
    .sort()
    .map((file) => readYamlDossier(join(dossierDir, file)));
  const championProfiles = readdirSync(championDir)
    .filter((file) => file.endsWith(".yaml") || file.endsWith(".yml"))
    .sort()
    .map((file) => readYamlChampionProfile(join(championDir, file)));

  return { playerProfile, dossiers, championProfiles };
}
