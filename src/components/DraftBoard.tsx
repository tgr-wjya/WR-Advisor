import React, { useState, useMemo } from "react";
import { recommendAdcs } from "../recommend";
import type { AdvisorData, DraftInput, DraftChampion } from "../types";
import "./DraftBoard.css";

interface Props {
  data: AdvisorData;
}

export default function DraftBoard({ data }: Props) {
  const [pickOrder, setPickOrder] = useState<number>(3);
  const [allies, setAllies] = useState<DraftChampion[]>([]);
  const [enemies, setEnemies] = useState<DraftChampion[]>([]);
  const [bans, setBans] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [clickMode, setClickMode] = useState<"ally" | "enemy" | "ban">("ally");

  const allChampions = useMemo(() => {
    return [...data.championProfiles].sort((a, b) => a.name.localeCompare(b.name));
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
      setBans([...bans, champId]);
    } else if (team === "ally") {
      const roles: Array<"support" | "mid" | "jungle" | "top"> = ["support", "mid", "jungle", "top"];
      const nextRole = roles[allies.length] || "mid";
      setAllies([...allies, { champion: champId, role: nextRole }]);
    } else {
      const roles: Array<"dragon" | "support" | "mid" | "jungle" | "top"> = ["dragon", "support", "mid", "jungle", "top"];
      const nextRole = roles[enemies.length] || "dragon";
      setEnemies([...enemies, { champion: champId, role: nextRole }]);
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
    <div className="draft-container">
      <div className="draft-grid">
        {/* Left Panel: Selection Controls and Board */}
        <div className="left-panel">
          <div className="controls">
            <button onClick={handleReset} className="btn-reset">Reset Draft</button>
            
            <label className="control-label">
              Pick Order:
              <select value={pickOrder} onChange={(e) => setPickOrder(Number(e.target.value))} className="select-pick-order">
                {[1, 2, 3, 4, 5].map((num) => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </label>

            <div className="click-mode-selector">
              <span className="selector-title">Click Action:</span>
              {(["ally", "enemy", "ban"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setClickMode(mode)}
                  className={`btn-mode-tab ${clickMode === mode ? `active-${mode}` : ""}`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="team-lists">
            <div className="team-column allies-col">
              <h3>Allies</h3>
              {allies.length === 0 ? (
                <p className="empty-text">No allies selected</p>
              ) : (
                allies.map((a, idx) => (
                  <div key={idx} className="team-item">
                    <span>{getChampName(a.champion)} <span className="item-role">({a.role})</span></span>
                    <button onClick={() => handleRemovePick(a.champion, "ally")} className="btn-remove" title="Remove">×</button>
                  </div>
                ))
              )}
            </div>
            
            <div className="team-column enemies-col">
              <h3>Enemies</h3>
              {enemies.length === 0 ? (
                <p className="empty-text">No enemies selected</p>
              ) : (
                enemies.map((e, idx) => (
                  <div key={idx} className="team-item">
                    <span>{getChampName(e.champion)} <span className="item-role">({e.role})</span></span>
                    <button onClick={() => handleRemovePick(e.champion, "enemy")} className="btn-remove" title="Remove">×</button>
                  </div>
                ))
              )}
            </div>

            <div className="team-column bans-col">
              <h3>Bans</h3>
              {bans.length === 0 ? (
                <p className="empty-text">No bans selected</p>
              ) : (
                bans.map((b, idx) => (
                  <div key={idx} className="team-item">
                    <span>{getChampName(b)}</span>
                    <button onClick={() => handleRemovePick(b, "ban")} className="btn-remove" title="Remove">×</button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Champion Selection Search & Grid */}
          <div className="champ-select-box">
            <div className="search-row">
              <input
                type="text"
                placeholder="Search champion..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
            
            <div className="role-filters">
              {["all", "top", "jungle", "mid", "dragon", "support"].map((role) => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`btn-role-tab ${selectedRole === role ? "active" : ""}`}
                >
                  {role.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="champ-grid">
              {filteredChampions.map((champ) => {
                const isPicked = unavailableIds.includes(champ.id);
                // Determine status badge if picked/banned
                let statusLabel = "";
                if (bans.includes(champ.id)) statusLabel = "Banned";
                else if (allies.some((a) => a.champion === champ.id)) statusLabel = "Ally";
                else if (enemies.some((e) => e.champion === champ.id)) statusLabel = "Enemy";

                return (
                  <button
                    key={champ.id}
                    disabled={isPicked}
                    onClick={() => handleAddPick(champ.id, clickMode)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      handleAddPick(champ.id, "enemy");
                    }}
                    className={`champ-card ${isPicked ? "disabled" : ""} ${statusLabel ? `status-${statusLabel.toLowerCase()}` : ""}`}
                    title={isPicked ? `${champ.name} (${statusLabel})` : `Left click to add to ${clickMode}, Right click for Enemy`}
                  >
                    <span className="card-name">{champ.name}</span>
                    {statusLabel && <span className="card-badge">{statusLabel}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Panel: Recommendations Output */}
        <div className="right-panel">
          <h2>Draft Recommendations</h2>
          {recommendations.recommendations.length === 0 ? (
            <p className="no-recs-text">No recommendations available. Reset draft or change pick order.</p>
          ) : (
            recommendations.recommendations.map((rec, idx) => (
              <div key={rec.championId} className="rec-card">
                <div className="rec-header">
                  <span className="rec-rank">#{idx + 1}</span>
                  <div className="rec-title-block">
                    <h3>{rec.championName}</h3>
                    <span className="rec-score">Score: {rec.score}</span>
                  </div>
                </div>

                <div className="score-breakdown">
                  <span className="breakdown-item" title="Player comfort score">Comfort: {rec.scoreBreakdown.playerFit}</span>
                  <span className="breakdown-item" title="Support synergy score">Synergy: {rec.scoreBreakdown.supportSynergy}</span>
                  <span className="breakdown-item" title="Enemy threat defense score">Threats: {rec.scoreBreakdown.enemyThreats}</span>
                  <span className="breakdown-item" title="Team dynamic alignment score">Team Needs: {rec.scoreBreakdown.teamNeeds}</span>
                  <span className="breakdown-item" title="Blind pick safety value">Blind Safety: {rec.scoreBreakdown.blindPickSafety}</span>
                  <span className="breakdown-item" title="Patch balancing adjustment">Patch: {rec.scoreBreakdown.patch}</span>
                </div>

                <div className="rec-section reasons-section">
                  <h4>Reasons for Recommendation</h4>
                  <ul>
                    {rec.reasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>

                {rec.warnings.length > 0 && (
                  <div className="rec-section warnings-section">
                    <h4>Draft & Playstyle Warnings</h4>
                    <div className="warning-box">
                      {rec.warnings.map((w, i) => <div key={i} className="warning-item">[Warning] {w}</div>)}
                    </div>
                  </div>
                )}

                <div className="rec-section execution-section">
                  <h4>Execution Blueprint</h4>
                  <div className="plan-item"><strong>Lane Plan:</strong> {rec.executionPlan.lanePlan}</div>
                  <div className="plan-item"><strong>Teamfight Plan:</strong> {rec.executionPlan.teamfightPlan}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
