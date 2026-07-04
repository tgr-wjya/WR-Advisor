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

`recommendAdcs()` accepts visible draft state, including player pick order. It
supports first-pick or low-information drafts by weighting blind-pick safety and
player comfort more heavily when little draft context is known.

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

## Development

This project uses Bun's TypeScript test runner, `yaml` for dossier parsing, and
`zod` for runtime dossier validation.

```bash
bun test
```
