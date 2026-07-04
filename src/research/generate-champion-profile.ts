import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
    throw new Error(`Missing cached source: ${sourcePath}. Run bun run research:cache first.`);
  }
  return readFileSync(sourcePath, "utf8");
}

function extractJson(text: string): CandidateProfile {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Foundry response did not contain a JSON object.");
  }

  return JSON.parse(text.slice(start, end + 1)) as CandidateProfile;
}

async function main(): Promise<void> {
  const championId = process.argv[2]?.trim().toLowerCase();
  if (!championId) {
    throw new Error("Usage: bun run profiles:generate <champion-id>");
  }

  const endpoint = requireEnv("AZURE_FOUNDRY_ENDPOINT").replace(/\/$/, "");
  const apiKey = requireEnv("AZURE_FOUNDRY_API_KEY");
  const model = requireEnv("AZURE_FOUNDRY_MODEL");
  const apiVersion = process.env.AZURE_FOUNDRY_API_VERSION ?? "2024-05-01-preview";
  const rootDir = process.cwd();
  const cachedSource = sourceTextFor(championId, rootDir);

  const prompt = [
    "Extract a Wild Rift draft knowledge profile from the official cached source text only.",
    "Return strict JSON with id, name, roles, tags, profile, and sources.",
    "Set tags using only this list:",
    ALLOWED_TAGS.join(", "),
    "Do not infer unsupported facts. Put uncertainty in profile.uncertainties.",
    "The output will be saved as status: candidate and requires human review before scoring.",
    "",
    cachedSource.slice(0, 24000),
  ].join("\n");

  const response = await fetch(`${endpoint}/openai/deployments/${model}/chat/completions?api-version=${apiVersion}`, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content: "You produce conservative JSON draft metadata from provided official Wild Rift sources.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`Foundry request failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Foundry response did not include message content.");
  }

  const candidate = extractJson(content);
  const output = {
    id: candidate.id,
    name: candidate.name,
    status: "candidate",
    roles: candidate.roles,
    tags: candidate.tags.filter((tag) => ALLOWED_TAGS.includes(tag)),
    profile: candidate.profile,
    sources: candidate.sources,
  };

  const outputPath = join(rootDir, "data", "champions", `${candidate.id}.yaml`);
  if (existsSync(outputPath)) {
    const existing = parseYaml(readFileSync(outputPath, "utf8")) as { status?: string };
    if (existing.status !== "candidate") {
      throw new Error(`Refusing to overwrite non-candidate profile: ${outputPath}`);
    }
  }

  writeFileSync(outputPath, stringifyYaml(output));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
