import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const ALLOWED_TAGS = [
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
];

interface CandidateProfile {
  id: string;
  name: string;
  roles: string[];
  tags: string[];
  profile: {
    draftIdentity: string;
    synergyHooks: string[];
    threatHooks: string[];
    uncertainties: string[];
  };
  sources: string[];
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function sourceTextFor(championId: string, rootDir: string): string {
  const sourcePath = join(rootDir, "data", "source-cache", `champion-${championId}.txt`);
  if (!existsSync(sourcePath)) {
    throw new Error(`Missing cached source: ${sourcePath}. Run bun run research:cache <champion-id> first.`);
  }
  return readFileSync(sourcePath, "utf8");
}

function extractJson(text: string): CandidateProfile {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("API response did not contain a JSON object.");
  }

  return JSON.parse(text.slice(start, end + 1)) as CandidateProfile;
}

async function callAzureOpenAI(endpoint: string, apiKey: string, model: string, apiVersion: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch(`${endpoint}/openai/deployments/${model}/chat/completions?api-version=${apiVersion}`, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`Azure OpenAI request failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Azure OpenAI response did not include message content.");
  }

  return content;
}

async function generateProfileFor(championId: string, rootDir: string, endpoint: string, apiKey: string, model: string, apiVersion: string): Promise<void> {
  const cachedSource = sourceTextFor(championId, rootDir);

  // 1. Generator Phase
  const genSystem = "You produce conservative JSON draft metadata from provided official Wild Rift sources.";
  const genPrompt = [
    "Extract a Wild Rift draft knowledge profile from the official cached source text only.",
    "Return strict JSON matching this structure:",
    "{",
    '  "id": "champion-id (lower case, e.g. yasuo)",',
    '  "name": "Champion Name (e.g. Yasuo)",',
    '  "roles": ["role1", "role2"],',
    '  "tags": ["tag1", "tag2"],',
    '  "profile": {',
    '    "draftIdentity": "brief 1-sentence draft identity description",',
    '    "synergyHooks": ["ally synergy hook 1", "ally synergy hook 2"],',
    '    "threatHooks": ["enemy threat hook 1", "enemy threat hook 2"],',
    '    "uncertainties": ["uncertainty/missing info 1", "uncertainty/missing info 2"]',
    '  },',
    '  "sources": ["source-url-1", "source-url-2"]',
    "}",
    "",
    "Set tags using only this list:",
    ALLOWED_TAGS.join(", "),
    "",
    "The roles array MUST NOT be empty. Choose at least one standard role from: dragon (for marksmen/bottom carries), support, mid, jungle, top.",
    "",
    "Strict rules for tags based on abilities:",
    "- **dive/assassin**: Has high mobility skills (dashes, blinks, teleports) and target access.",
    "- **engage/lockdown**: Has hard crowd control (stuns, roots, knockups, suppressions) to initiate or lock down targets.",
    "- **enchanter/peel**: Has shields, heals, speed boosts, or displacement to protect allies.",
    "- **poke**: Has long-range skillshots or persistent safe damage.",
    "- **immobile**: Lacks dashes, blinks, teleports, or significant movement speed boosts.",
    "- **tanks**: Is naturally durable, usually with shields, damage reduction, and defense scaling.",
    "- **waveclear**: Has area-of-effect (AoE) spells suitable for clearing minion waves.",
    "- **scaling**: Has passive or scaling mechanics that make them much stronger in the late game.",
    "- **shortRange**: Melee champions or low-range marksmen.",
    "",
    "Do not infer unsupported facts. Put uncertainty in profile.uncertainties.",
    "",
    cachedSource,
  ].join("\n");

  console.log(`[Generate] Calling generator LLM for ${championId}...`);
  const genOutput = await callAzureOpenAI(endpoint, apiKey, model, apiVersion, genSystem, genPrompt);
  const candidate = extractJson(genOutput);

  // 2. Judge Phase
  const judgeSystem = "You are an expert Wild Rift Draft Analyst and Rules Judge.";
  const judgePrompt = [
    "Your task is to review a candidate draft profile against the official champion abilities source text.",
    "Verify each tag, role, and hook against strict logical criteria:",
    "- **engage/lockdown**: MUST have stuns, roots, knockups, pulls, or suppressions. Slows DO NOT qualify.",
    "- **dive/assassin**: MUST have mobility skills like dashes, blinks, or leaps.",
    "- **enchanter/peel**: MUST have heals, shields, buffs for allies, or displacement to push enemies away from carries.",
    "- **immobile**: MUST NOT have dashes, blinks, leaps, or teleports. If they have a dash, they are NOT immobile.",
    "- **tanks**: MUST have strong defensive steroids, shields, or defense scaling.",
    "- **waveclear**: MUST have substantial AoE damage spells.",
    "- **shortRange**: MUST be melee or low attack range.",
    "",
    "Ensure the roles array is not empty. If it is empty, add at least one appropriate role (e.g. dragon, support, mid, jungle, top).",
    "",
    "Review this candidate JSON profile:",
    JSON.stringify(candidate, null, 2),
    "",
    "Here is the official ability source text:",
    cachedSource,
    "",
    "Return a corrected version of the JSON profile matching the exact same schema. Correct any tags or roles that violate the rules, and add any missing tags that clearly apply. Explain your corrections and thoughts inside the profile.uncertainties array.",
  ].join("\n");

  console.log(`[Judge] Calling judge LLM for ${championId} verification...`);
  const judgeOutput = await callAzureOpenAI(endpoint, apiKey, model, apiVersion, judgeSystem, judgePrompt);
  const validated = extractJson(judgeOutput);

  const cleanRoles = validated.roles && validated.roles.length > 0
    ? validated.roles
    : ["dragon"];

  const finalOutput = {
    id: validated.id,
    name: validated.name,
    status: "candidate",
    roles: cleanRoles,
    tags: validated.tags.filter((tag) => ALLOWED_TAGS.includes(tag)),
    profile: validated.profile,
    sources: validated.sources,
  };

  function getSubdirectoryForRoles(roles: string[]): string {
    const mappedRoles = roles.map(r => r.toLowerCase().trim());
    if (mappedRoles.includes("dragon") || mappedRoles.includes("marksman") || mappedRoles.includes("adc")) return "dragon";
    if (mappedRoles.includes("support")) return "support";
    if (mappedRoles.includes("jungle")) return "jungle";
    if (mappedRoles.includes("mid") || mappedRoles.includes("middle")) return "mid";
    if (mappedRoles.includes("top") || mappedRoles.includes("baron")) return "top";
    
    if (mappedRoles.length > 0) {
      const first = mappedRoles[0];
      if (first === "assassin" || first === "fighter" || first === "mage") return "mid";
      if (first === "tank") return "support";
    }
    return "dragon";
  }

  function findExistingProfilePath(dir: string, champId: string): string | null {
    if (!existsSync(dir)) return null;
    const list = readdirSync(dir);
    for (const file of list) {
      const path = join(dir, file);
      const stat = statSync(path);
      if (stat && stat.isDirectory()) {
        const found = findExistingProfilePath(path, champId);
        if (found) return found;
      } else if (file === `${champId}.yaml` || file === `${champId}.yml`) {
        return path;
      }
    }
    return null;
  }

  const existingPath = findExistingProfilePath(join(rootDir, "data", "champions"), finalOutput.id);
  let outputPath = existingPath;

  if (outputPath) {
    const existing = parseYaml(readFileSync(outputPath, "utf8")) as { status?: string };
    if (existing.status !== "candidate") {
      console.log(`[Skip] Refusing to overwrite non-candidate (approved/rejected) profile: ${outputPath}`);
      return;
    }
  } else {
    const subDir = getSubdirectoryForRoles(cleanRoles);
    const destDir = join(rootDir, "data", "champions", subDir);
    mkdirSync(destDir, { recursive: true });
    outputPath = join(destDir, `${finalOutput.id}.yaml`);
  }

  writeFileSync(outputPath, stringifyYaml(finalOutput));
  console.log(`[Success] Written profile: ${outputPath}`);
}

async function main(): Promise<void> {
  const arg = process.argv[2]?.trim().toLowerCase();
  if (!arg) {
    throw new Error("Usage: bun run profiles:generate <champion-id> | all");
  }

  const endpoint = requireEnv("AZURE_FOUNDRY_ENDPOINT").replace(/\/$/, "");
  const apiKey = requireEnv("AZURE_FOUNDRY_API_KEY");
  const model = requireEnv("AZURE_FOUNDRY_MODEL");
  const apiVersion = process.env.AZURE_FOUNDRY_API_VERSION ?? "2024-05-01-preview";
  const rootDir = process.cwd();

  let targetChampions: string[] = [];

  if (arg === "all") {
    const cacheDir = join(rootDir, "data", "source-cache");
    const files = readdirSync(cacheDir).filter(f => f.startsWith("champion-") && f.endsWith(".txt"));
    targetChampions = files.map(f => f.replace("champion-", "").replace(".txt", ""));
    console.log(`Bulk generation mode. Found ${targetChampions.length} cached profiles.`);
  } else {
    targetChampions = process.argv.slice(2).map(c => c.trim().toLowerCase());
  }

  for (const championId of targetChampions) {
    console.log(`\n--- Processing Champion: ${championId} ---`);
    try {
      await generateProfileFor(championId, rootDir, endpoint, apiKey, model, apiVersion);
      // Wait 1s between LLM calls to prevent Azure rate limits
      await new Promise(r => setTimeout(r, 1000));
    } catch (error: any) {
      console.error(`[Error] Failed to generate profile for ${championId}:`, error.message || error);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
