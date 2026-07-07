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

The advisor uses a data-first scoring engine that combines your personal champion pool (dossiers) with the general champion knowledge database (champions list) to score picks based on active draft synergies and threats:

- **Player Profile** (`data/player-profile.json`): Configures your comfort level and playstyle alignment.
- **Player Dossiers** (`data/dossiers/*.yaml`): YAML schemas defining your personal pick pool, pick identity, support synergies, and counter-pick threat guidelines. Recommended picks are selected exclusively from champions with dossiers.
- **Champion Knowledge Base** (`data/champions/<role>/*.yaml`): A database of all 139 Wild Rift champions organized by primary roles (`dragon/`, `support/`, `jungle/`, `mid/`, `top/`). Each profile contains mechanical tags (`engage`, `lockdown`, `dive`, `immobile`, etc.) checked by the scoring engine. Only profiles with `status: approved` participate in recommendations.

The recommendation engine:
1. Filters out unavailable picks (picked/banned).
2. Calculates player comfort and patch-tuning scores for comfort ADCs.
3. Inspects current ally/enemy picks, resolves their tags from the champion database, and runs dossier rules (e.g. adding peel synergy points, subtracting dive threat points).
4. Returns the top recommendations with score breakdowns, specific coaching reasoning, and warnings.

---

## Customizing for Your Roster

To adapt this advisor for your own champion pool and lane preferences:

### 1. Update Your Player Profile
Edit [player-profile.json](file:///home/tgrwjya/Documents/Projects/Me/wild-rift-advisor/data/player-profile.json) to set your account name, default role, and base comfort ratings.

### 2. Define Your Playable Pool
The recommendations are drawn strictly from [data/dossiers/](file:///home/tgrwjya/Documents/Projects/Me/wild-rift-advisor/data/dossiers/). To add a new playable champion:
1. Copy an existing dossier template (such as [zeri.yaml](file:///home/tgrwjya/Documents/Projects/Me/wild-rift-advisor/data/dossiers/zeri.yaml) or [jinx.yaml](file:///home/tgrwjya/Documents/Projects/Me/wild-rift-advisor/data/dossiers/jinx.yaml)).
2. Set the `id` (champion slug) and configure `playerFit` comfort details.
3. Define your champion's support synergies, enemy threats, and lane need scores using valid tag matches (e.g., `peel`, `dive`, `lockdown`).

### 3. Approve Knowledge Profiles
The generator writes profiles with `status: candidate`. Review and change the status to `approved` inside [data/champions/](file:///home/tgrwjya/Documents/Projects/Me/wild-rift-advisor/data/champions/) folders to activate those champions' tags in the recommendation math.

---

## Usage & Commands

### Load Recommendations Programmatically
```ts
import { loadAdvisorData, recommendAdcs } from "./src";

const data = loadAdvisorData();
const result = recommendAdcs(data, {
  playerPickOrder: 3,
  allies: [
    { champion: "leona", role: "support" }
  ],
  enemies: [
    { champion: "zed", role: "mid" }
  ],
  unavailableChampionIds: ["leona", "zed"],
});

console.log(result.recommendations);
```

### Run Caching Crawler
Crawls abilities for all active champions incrementally:
```bash
bun run research:cache
```

### Generate Knowledge Profiles
Analyzes raw abilities text using Azure OpenAI (Generator + Judge LLM) and outputs files to matching role folders:
```bash
bun run profiles:generate all
```

### Run Draft Simulations
Runs pre-configured draft scenarios using both approved and candidate files to verify scoring:
```bash
bun run src/research/simulate-draft.ts
```
Or generate a random draft composition:
```bash
bun run src/research/simulate-draft.ts --random
```

---

## Development

This project uses Bun's test runner, `yaml` for dossier parsing, and `zod` for validation.

To run all unit, simulation, and randomized comp tests:
```bash
bun test
```

