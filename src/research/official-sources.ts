export interface OfficialSource {
  id: string;
  kind: "champion" | "patch";
  title: string;
  url: string;
}

export const OFFICIAL_SOURCES: OfficialSource[] = [
  {
    id: "champion-jinx",
    kind: "champion",
    title: "Jinx champion page",
    url: "https://wildrift.leagueoflegends.com/en-us/champions/jinx/",
  },
  {
    id: "champion-leona",
    kind: "champion",
    title: "Leona champion page",
    url: "https://wildrift.leagueoflegends.com/en-us/champions/leona/",
  },
  {
    id: "champion-lulu",
    kind: "champion",
    title: "Lulu champion page",
    url: "https://wildrift.leagueoflegends.com/en-us/champions/lulu/",
  },
  {
    id: "champion-nautilus",
    kind: "champion",
    title: "Nautilus champion page",
    url: "https://wildrift.leagueoflegends.com/en-us/champions/nautilus/",
  },
  {
    id: "champion-vi",
    kind: "champion",
    title: "Vi champion page",
    url: "https://wildrift.leagueoflegends.com/en-us/champions/vi/",
  },
  {
    id: "champion-yasuo",
    kind: "champion",
    title: "Yasuo champion page",
    url: "https://wildrift.leagueoflegends.com/en-us/champions/yasuo/",
  },
  {
    id: "game-updates",
    kind: "patch",
    title: "Wild Rift game updates",
    url: "https://wildrift.leagueoflegends.com/en-us/news/game-updates/",
  },
];
