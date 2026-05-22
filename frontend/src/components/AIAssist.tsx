import { useEffect, useState } from "react";
import type { Column } from "../types";
import {
  aiAvailable,
  suggestColumns,
  type AIChatMessage,
  type SuggestedColumn,
} from "../api";

interface Props {
  tableName: string;
  existingColumns: Column[];
  onAdd: (cols: Column[]) => void;
  onClose: () => void;
}

export function AIAssist({ tableName, existingColumns, onAdd, onClose }: Props) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [description, setDescription] = useState("");
  const [history, setHistory] = useState<AIChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedColumn[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [rationale, setRationale] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    aiAvailable().then(setAvailable);
  }, []);

  const ask = async () => {
    if (!description.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { result, history: nextHistory } = await suggestColumns({
        description,
        table_name: tableName,
        existing_columns: existingColumns,
        history,
      });
      setSuggestions(result.columns);
      setRationale(result.rationale);
      setHistory(nextHistory);
      setPicked(new Set(result.columns.map((_, i) => i)));
      setDescription("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const togglePicked = (idx: number) => {
    const next = new Set(picked);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setPicked(next);
  };

  const accept = () => {
    const cols: Column[] = suggestions
      .filter((_, i) => picked.has(i))
      .map((s) => ({
        name: s.name,
        type: s.type,
        nullable: s.nullable,
        primary_key: s.primary_key,
        unique: s.unique,
        auto_increment: s.auto_increment,
        default: s.default ?? null,
        length: s.length ?? null,
        precision: s.precision ?? null,
        scale: s.scale ?? null,
        references: s.references ?? null,
      }));
    if (cols.length > 0) onAdd(cols);
    setSuggestions([]);
    setPicked(new Set());
    setRationale("");
  };

  if (available === false) {
    return (
      <div className="ai-panel">
        <div className="ai-head">
          <strong>AI Assist</strong>
          <button className="icon" onClick={onClose}>✕</button>
        </div>
        <div className="ai-unavailable">
          <strong>AI is not configured.</strong>
          <p>
            Set <code>ANTHROPIC_API_KEY</code> in the backend environment and restart{" "}
            <code>uvicorn</code>:
          </p>
          <pre>$env:ANTHROPIC_API_KEY = "sk-ant-..."{`\n`}uvicorn app.main:app --reload --port 8000</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-panel">
      <div className="ai-head">
        <strong>AI Assist</strong>
        <span className="ai-context">
          {history.length === 0 ? "Describe the entity" : "Refine — add details or ask for changes"}
        </span>
        <div className="spacer" />
        <button className="icon" onClick={onClose}>✕</button>
      </div>

      <div className="ai-input-row">
        <textarea
          rows={2}
          placeholder={
            history.length === 0
              ? `e.g. "A user account with email, hashed password, profile metadata as JSON, and timestamps"`
              : `e.g. "Also add a soft-delete flag and make email lowercase-unique"`
          }
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask();
          }}
        />
        <div className="ai-buttons">
          <button disabled={!description.trim() || busy} onClick={ask}>
            {busy ? "Thinking…" : history.length === 0 ? "Suggest" : "Refine"}
          </button>
          {history.length > 0 && (
            <button
              className="ghost"
              onClick={() => {
                setHistory([]);
                setSuggestions([]);
                setPicked(new Set());
                setRationale("");
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {suggestions.length > 0 && (
        <div className="ai-suggestions">
          {rationale && <div className="rationale">{rationale}</div>}
          <table className="suggest-table">
            <thead>
              <tr>
                <th></th>
                <th>Name</th>
                <th>Type</th>
                <th>Attrs</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((s, i) => (
                <tr key={i} className={picked.has(i) ? "picked" : "unpicked"}>
                  <td>
                    <input
                      type="checkbox"
                      checked={picked.has(i)}
                      onChange={() => togglePicked(i)}
                    />
                  </td>
                  <td className="mono">{s.name}</td>
                  <td>
                    <span className="type-badge">{s.type}</span>
                    {s.length ? <span className="muted">({s.length})</span> : null}
                    {s.type === "decimal" && s.precision ? (
                      <span className="muted">
                        ({s.precision},{s.scale ?? 2})
                      </span>
                    ) : null}
                  </td>
                  <td className="attrs">
                    {s.primary_key && <span className="tag">PK</span>}
                    {s.auto_increment && <span className="tag">AI</span>}
                    {s.unique && <span className="tag">UNQ</span>}
                    {!s.nullable && <span className="tag">NN</span>}
                    {s.default && <span className="tag mono-tag">= {s.default}</span>}
                    {s.references && <span className="tag fk">→ {s.references}</span>}
                  </td>
                  <td className="reason">{s.reason ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ai-actions">
            <span className="muted">
              {picked.size} of {suggestions.length} selected
            </span>
            <div className="spacer" />
            <button onClick={accept} disabled={picked.size === 0}>
              Add {picked.size} column{picked.size === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
