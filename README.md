# Wild Rift Advisor

Wild Rift Advisor is a data-first ADC draft recommendation engine. V1 focuses on
the user's playable core ADC pool and uses curated structured dossiers instead
of generic League of Legends memory.

## V1 Scope

The first version recommends only these fully supported ADCs:

- Zeri
- Tristana
- Jinx
- Kai'Sa
- Lucian
- Sivir

Other champions in `ROSTER.md` are player context only until they receive full
dossiers.

## How It Works

The engine loads:

- `data/player-profile.json` for user-specific ADC comfort and roster notes.
- `data/dossiers/*.yaml` for champion identity, lane pattern, support synergy,
  enemy threats, execution plans, and manual patch status.
- `data/champions/*.yaml` for reviewed ally/enemy/support champion knowledge.
  Only `approved` profiles affect scoring; `candidate` and `rejected` profiles
  are visible for review but ignored by the recommendation engine.

`recommendAdcs()` accepts visible draft state, including player pick order. It
supports first-pick or low-information drafts by weighting blind-pick safety and
player comfort more heavily when little draft context is known. Draft champions
can be passed by champion ID, for example `{ champion: "leona", role:
"support" }`; manual tags remain supported for ad hoc experiments.

The result contains:

- ranked top 3 recommendations
- full candidate ranking
- score breakdowns
- cited structured reasons
- warnings
- lane and teamfight execution plans

## Usage

```ts
import { loadAdvisorData, recommendAdcs } from "./src";

const data = loadAdvisorData();
const result = recommendAdcs(data, {
  playerPickOrder: 1,
  allies: [],
  enemies: [],
  unavailableChampionIds: [],
});

console.log(result.recommendations);
```

## Research Loop

Official Wild Rift source pages can be cached locally:

```bash
bun run research:cache
```

Candidate champion profiles can then be generated from cached text with
Microsoft Foundry:

```bash
AZURE_FOUNDRY_ENDPOINT=... \
AZURE_FOUNDRY_API_KEY=... \
AZURE_FOUNDRY_MODEL=... \
bun run profiles:generate leona
```

The generator always writes `status: candidate`. A human must review and change
the status to `approved` before the profile can affect recommendations. It will
not overwrite an existing non-candidate profile.

## Development

This project uses Bun's TypeScript test runner, `yaml` for dossier parsing, and
`zod` for runtime dossier validation.

```bash
bun test
```
