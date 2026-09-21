"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2, Trophy } from "lucide-react";
import { placementLabel } from "@/lib/placement";

type GamerOption = { id: string; handle: string; displayName: string };

type PlacementRow = { gamerId: string; finalRank: string; placementLabel: string };

export type PlacementDivision = {
  divisionId: string;
  divisionName: string;
  gameName: string;
  placements: Array<{ gamerId: string; displayName: string; finalRank: number | null; placementLabel: string | null }>;
};

function DivisionEditor({ division, gamers }: { division: PlacementDivision; gamers: GamerOption[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<PlacementRow[]>(division.placements.map((entry) => ({
    gamerId: entry.gamerId,
    finalRank: entry.finalRank === null ? "" : String(entry.finalRank),
    placementLabel: entry.placementLabel ?? "",
  })));
  const [message, setMessage] = useState("Rank 1 shows as Champion, 2 as Runner-up, and anything else as Top N.");
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  function update(index: number, patch: Partial<PlacementRow>) {
    setRows((current) => current.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  }

  async function save() {
    setSaving(true);
    setError(false);
    try {
      const response = await fetch(`/api/v1/admin/divisions/${division.divisionId}/placements`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          placements: rows
            .filter((row) => row.gamerId)
            .map((row) => ({
              gamerId: row.gamerId,
              finalRank: row.finalRank.trim() === "" ? null : Number(row.finalRank),
              placementLabel: row.placementLabel.trim() === "" ? null : row.placementLabel.trim(),
            })),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(true);
        setMessage(body.errors?.[0]?.message ?? body.detail ?? "The results could not be saved.");
        return;
      }
      setMessage("Results saved.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card panel entity-editor">
      <h3 className="panel-title"><Trophy size={16} /> {division.gameName} · {division.divisionName}</h3>
      {rows.map((row, index) => (
        <div className="builder-grid" key={`${division.divisionId}-${index}`}>
          <label className="form-group">
            <span className="form-label">Player</span>
            <select className="select" value={row.gamerId} onChange={(event) => update(index, { gamerId: event.target.value })}>
              <option value="">Select a player</option>
              {gamers.map((gamer) => <option key={gamer.id} value={gamer.id}>{gamer.handle}</option>)}
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Rank</span>
            <input className="input" type="number" min="1" value={row.finalRank} onChange={(event) => update(index, { finalRank: event.target.value })} placeholder="1" />
          </label>
          <label className="form-group">
            <span className="form-label">Label override</span>
            <input className="input" value={row.placementLabel} onChange={(event) => update(index, { placementLabel: event.target.value })} placeholder={placementLabel(Number(row.finalRank) || null)} />
          </label>
          <button type="button" className="button button-secondary button-small" onClick={() => setRows((current) => current.filter((_, position) => position !== index))}>
            <Trash2 size={14} /> Remove
          </button>
        </div>
      ))}
      <div className="header-actions">
        <button type="button" className="button button-secondary button-small" onClick={() => setRows((current) => [...current, { gamerId: "", finalRank: "", placementLabel: "" }])}>
          <Plus size={14} /> Add a player
        </button>
        <button type="button" className="button button-primary button-small" disabled={saving} onClick={save}>
          <Save size={14} /> {saving ? "Saving…" : "Save results"}
        </button>
      </div>
      <p className={`helper${error ? " form-error" : ""}`} role="status">{message}</p>
    </section>
  );
}

export function AdminPlacementEditor({ divisions, gamers }: { divisions: PlacementDivision[]; gamers: GamerOption[] }) {
  if (divisions.length === 0) return null;
  return (
    <>
      <div className="section-header" style={{ marginTop: 28 }}>
        <div>
          <h2 className="admin-heading">Results</h2>
          <p className="admin-subtitle">This event has no bracket, so enter the final placements here.</p>
        </div>
      </div>
      {divisions.map((division) => (
        <DivisionEditor key={division.divisionId} division={division} gamers={gamers} />
      ))}
    </>
  );
}
