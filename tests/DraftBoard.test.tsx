import { describe, expect, test } from "bun:test";
import React from "react";
import ReactDOMServer from "react-dom/server";
import DraftBoard from "../src/components/DraftBoard";
import { loadAdvisorData } from "../src/index";

describe("DraftBoard component", () => {
  test("renders DraftBoard correctly with advisor data", () => {
    const data = loadAdvisorData();
    // Ensure status is approved
    const approvedData = {
      ...data,
      championProfiles: data.championProfiles.map((p) => ({
        ...p,
        status: "approved" as const,
      })),
    };

    const html = ReactDOMServer.renderToString(<DraftBoard data={approvedData} />);
    
    // Check key structural elements
    expect(html).toContain("Recommendations");
    expect(html).toContain("Allies");
    expect(html).toContain("Enemies");
    expect(html).toContain("Bans");
    expect(html).toContain("Pick Order");
    expect(html).toContain("Reset Draft");

    // Check that at least some champions are listed in the selection grid
    for (const dossier of approvedData.dossiers) {
      const escapedName = dossier.name.replace("'", "&#x27;");
      expect(html).toContain(escapedName);
    }
  });

  test("enforces draft size constraints in source code", async () => {
    const fs = await import("fs/promises");
    const path = await import("path");
    const codePath = path.resolve(__dirname, "../src/components/DraftBoard.tsx");
    const code = await fs.readFile(codePath, "utf-8");

    // Check constraint checks in code
    expect(code).toContain("allies.length >= 4");
    expect(code).toContain("enemies.length >= 5");
    expect(code).toContain("bans.length >= 10");
  });
});
