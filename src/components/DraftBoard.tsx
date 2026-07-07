import React, { useState, useMemo } from "react";
import { recommendAdcs } from "../recommend";
import type { AdvisorData, DraftInput, DraftChampion } from "../types";
import styles from "./DraftBoard.module.css";

export const MAX_ALLIES = 4;
export const MAX_ENEMIES = 5;
export const MAX_BANS = 10;

export function addAllyPickHelper(currentAllies: DraftChampion[], newChampId: string): DraftChampion[] {
  if (currentAllies.length >= MAX_ALLIES) return currentAllies;
  if (currentAllies.some((a) => a.champion === newChampId)) return currentAllies;
  const roles: Array<"support" | "mid" | "jungle" | "top"> = ["support", "mid", "jungle", "top"];
  const activeRoles = currentAllies.map((a) => a.role);
  const nextRole = roles.find((r) => !activeRoles.includes(r)) || "mid";
  return [...currentAllies, { champion: newChampId, role: nextRole }];
}

export function addEnemyPickHelper(currentEnemies: DraftChampion[], newChampId: string): DraftChampion[] {
  if (currentEnemies.length >= MAX_ENEMIES) return currentEnemies;
  if (currentEnemies.some((e) => e.champion === newChampId)) return currentEnemies;
  const roles: Array<"dragon" | "support" | "mid" | "jungle" | "top"> = ["dragon", "support", "mid", "jungle", "top"];
  const activeRoles = currentEnemies.map((e) => e.role);
  const nextRole = roles.find((r) => !activeRoles.includes(r)) || "dragon";
  return [...currentEnemies, { champion: newChampId, role: nextRole }];
}

export function addBanHelper(currentBans: string[], newChampId: string): string[] {
  if (currentBans.length >= MAX_BANS) return currentBans;
  if (currentBans.includes(newChampId)) return currentBans;
  return [...currentBans, newChampId];
}

export const DEFAULT_PICK_ORDER = 3;

interface Props {
  data: AdvisorData;
}

export default function DraftBoard({ data }: Props) {
  const [pickOrder, setPickOrder] = useState<number>(DEFAULT_PICK_ORDER);
  const [allies, setAllies] = useState<DraftChampion[]>([]);
  const [enemies, setEnemies] = useState<DraftChampion[]>([]);
  const [bans, setBans] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [clickMode, setClickMode] = useState<"ally" | "enemy" | "ban">("ally");

  const allChampions = useMemo(() => {
    const profiles = data?.championProfiles || [];
    return [...profiles].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const unavailableIds = useMemo(() => {
    return [
      ...bans,
      ...allies.map((a) => a.champion),
      ...enemies.map((e) => e.champion),
    ];
  }, [bans, allies, enemies]);

  const recommendations = useMemo(() => {
    const draft: DraftInput = {
      playerPickOrder: pickOrder,
      allies,
      enemies,
      unavailableChampionIds: unavailableIds,
    };
    return recommendAdcs(data, draft);
  }, [data, pickOrder, allies, enemies, unavailableIds]);

  const filteredChampions = useMemo(() => {
    return allChampions.filter((champ) => {
      const matchesSearch = champ.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (selectedRole === "all") return matchesSearch;
      return matchesSearch && champ.roles.includes(selectedRole);
    });
  }, [allChampions, searchQuery, selectedRole]);

  const handleAddPick = (champId: string, team: "ally" | "enemy" | "ban") => {
    if (unavailableIds.includes(champId)) return;

    if (team === "ban") {
      setBans(addBanHelper(bans, champId));
    } else if (team === "ally") {
      setAllies(addAllyPickHelper(allies, champId));
    } else {
      setEnemies(addEnemyPickHelper(enemies, champId));
    }
  };

  const handleRemovePick = (champId: string, team: "ally" | "enemy" | "ban") => {
    if (team === "ban") {
      setBans(bans.filter((b) => b !== champId));
    } else if (team === "ally") {
      setAllies(allies.filter((a) => a.champion !== champId));
    } else {
      setEnemies(enemies.filter((e) => e.champion !== champId));
    }
  };

  const handleReset = () => {
    setAllies([]);
    setEnemies([]);
    setBans([]);
  };

  // Find a profile name helper
  const getChampName = (id: string) => {
    const found = allChampions.find((c) => c.id === id);
    return found ? found.name : id;
  };

  return (
    <div className={styles.draftContainer}>
      <div className={styles.draftGrid}>
        {/* Left Panel: Selection Controls and Board */}
        <div className={styles.leftPanel}>
          <div className={styles.controls}>
            <button onClick={handleReset} className={styles.btnReset}>Reset Draft</button>
            
            <label className={styles.controlLabel}>
              Pick Order:
              <select value={pickOrder} onChange={(e) => setPickOrder(Number(e.target.value))} className={styles.selectPickOrder}>
                {[1, 2, 3, 4, 5].map((num) => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </label>

            <div className={styles.clickModeSelector}>
              <span className={styles.selectorTitle}>Click Action:</span>
              {(["ally", "enemy", "ban"] as const).map((mode) => {
                const activeStyle = mode === "ally" ? styles.activeAlly : mode === "enemy" ? styles.activeEnemy : styles.activeBan;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setClickMode(mode)}
                    className={`${styles.btnModeTab} ${clickMode === mode ? activeStyle : ""}`}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.teamLists}>
            <div className={`${styles.teamColumn} ${styles.alliesCol}`}>
              <h3>Allies</h3>
              {allies.length === 0 ? (
                <p className={styles.emptyText}>No allies selected</p>
              ) : (
                allies.map((a, idx) => (
                  <div key={idx} className={styles.teamItem}>
                    <span>{getChampName(a.champion)} <span className={styles.itemRole}>({a.role})</span></span>
                    <button onClick={() => handleRemovePick(a.champion, "ally")} className={styles.btnRemove} title="Remove">×</button>
                  </div>
                ))
              )}
            </div>
            
            <div className={`${styles.teamColumn} ${styles.enemiesCol}`}>
              <h3>Enemies</h3>
              {enemies.length === 0 ? (
                <p className={styles.emptyText}>No enemies selected</p>
              ) : (
                enemies.map((e, idx) => (
                  <div key={idx} className={styles.teamItem}>
                    <span>{getChampName(e.champion)} <span className={styles.itemRole}>({e.role})</span></span>
                    <button onClick={() => handleRemovePick(e.champion, "enemy")} className={styles.btnRemove} title="Remove">×</button>
                  </div>
                ))
              )}
            </div>

            <div className={`${styles.teamColumn} ${styles.bansCol}`}>
              <h3>Bans</h3>
              {bans.length === 0 ? (
                <p className={styles.emptyText}>No bans selected</p>
              ) : (
                bans.map((b, idx) => (
                  <div key={idx} className={styles.teamItem}>
                    <span>{getChampName(b)}</span>
                    <button onClick={() => handleRemovePick(b, "ban")} className={styles.btnRemove} title="Remove">×</button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Champion Selection Search & Grid */}
          <div className={styles.champSelectBox}>
            <div className={styles.searchRow}>
              <input
                type="text"
                placeholder="Search champion..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            
            <div className={styles.roleFilters}>
              {["all", "top", "jungle", "mid", "dragon", "support"].map((role) => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`${styles.btnRoleTab} ${selectedRole === role ? styles.active : ""}`}
                >
                  {role.toUpperCase()}
                </button>
              ))}
            </div>

            <div className={styles.champGrid}>
              {filteredChampions.map((champ) => {
                const isPicked = unavailableIds.includes(champ.id);
                // Determine status badge if picked/banned
                let statusLabel = "";
                if (bans.includes(champ.id)) statusLabel = "Banned";
                else if (allies.some((a) => a.champion === champ.id)) statusLabel = "Ally";
                else if (enemies.some((e) => e.champion === champ.id)) statusLabel = "Enemy";

                const statusStyle = statusLabel === "Banned" ? styles.statusBanned : statusLabel === "Ally" ? styles.statusAlly : statusLabel === "Enemy" ? styles.statusEnemy : "";

                return (
                  <button
                    key={champ.id}
                    disabled={isPicked}
                    onClick={() => handleAddPick(champ.id, clickMode)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      handleAddPick(champ.id, "enemy");
                    }}
                    className={`${styles.champCard} ${isPicked ? styles.disabled : ""} ${statusStyle}`}
                    title={isPicked ? `${champ.name} (${statusLabel})` : `Left click to add to ${clickMode}, Right click for Enemy`}
                  >
                    <span className={styles.cardName}>{champ.name}</span>
                    {statusLabel && <span className={styles.cardBadge}>{statusLabel}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Panel: Recommendations Output */}
        <div className={styles.rightPanel}>
          <h2>Draft Recommendations</h2>
          {recommendations.recommendations.length === 0 ? (
            <p className={styles.noRecsText}>No recommendations available. Reset draft or change pick order.</p>
          ) : (
            recommendations.recommendations.map((rec, idx) => (
              <div key={rec.championId} className={styles.recCard}>
                <div className={styles.recHeader}>
                  <span className={styles.recRank}>#{idx + 1}</span>
                  <div className={styles.recTitleBlock}>
                    <h3>{rec.championName}</h3>
                    <span className={styles.recScore}>Score: {rec.score}</span>
                  </div>
                </div>

                <div className={styles.scoreBreakdown}>
                  <span className={styles.breakdownItem} title="Player comfort score">Comfort: {rec.scoreBreakdown.playerFit}</span>
                  <span className={styles.breakdownItem} title="Support synergy score">Synergy: {rec.scoreBreakdown.supportSynergy}</span>
                  <span className={styles.breakdownItem} title="Enemy threat defense score">Threats: {rec.scoreBreakdown.enemyThreats}</span>
                  <span className={styles.breakdownItem} title="Team dynamic alignment score">Team Needs: {rec.scoreBreakdown.teamNeeds}</span>
                  <span className={styles.breakdownItem} title="Blind pick safety value">Blind Safety: {rec.scoreBreakdown.blindPickSafety}</span>
                  <span className={styles.breakdownItem} title="Patch balancing adjustment">Patch: {rec.scoreBreakdown.patch}</span>
                </div>

                <div className={`${styles.recSection} ${styles.reasonsSection}`}>
                  <h4>Reasons for Recommendation</h4>
                  <ul>
                    {rec.reasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>

                {rec.warnings.length > 0 && (
                  <div className={`${styles.recSection} ${styles.warningsSection}`}>
                    <h4>Draft & Playstyle Warnings</h4>
                    <div className={styles.warningBox}>
                      {rec.warnings.map((w, i) => <div key={i} className={styles.warningItem}>[Warning] {w}</div>)}
                    </div>
                  </div>
                )}

                <div className={`${styles.recSection} ${styles.executionSection}`}>
                  <h4>Execution Blueprint</h4>
                  <div className={styles.planItem}><strong>Lane Plan:</strong> {rec.executionPlan.lanePlan}</div>
                  <div className={styles.planItem}><strong>Teamfight Plan:</strong> {rec.executionPlan.teamfightPlan}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
