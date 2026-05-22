import { useEffect, useState } from "react";
import type { Schema, Table } from "../types";
import { aiAvailable, generateDataDictionary } from "../api";

interface Props {
  schema: Schema;
  onSchemaChange: (next: Schema) => void;
}

type BusyKind = "all" | { table: string } | null;

export function DataDictionary({ schema, onSchemaChange }: Props) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<BusyKind>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiTouched, setAiTouched] = useState<Set<string>>(new Set());

  useEffect(() => {
    aiAvailable().then(setAvailable);
  }, []);

  const updateTable = (idx: number, patch: Partial<Table>) => {
    const next: Schema = {
      ...schema,
      tables: schema.tables.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
    };
    onSchemaChange(next);
  };

  const updateColumnDescription = (
    tableIdx: number,
    colIdx: number,
    description: string,
  ) => {
    const t = schema.tables[tableIdx];
    const next: Schema = {
      ...schema,
      tables: schema.tables.map((tt, i) =>
        i === tableIdx
          ? {
              ...tt,
              columns: tt.columns.map((c, j) =>
                j === colIdx ? { ...c, description } : c,
              ),
            }
          : tt,
      ),
    };
    onSchemaChange(next);
    // Once the user types here, drop the "AI-generated" marker so the UI shows it's user-owned
    const key = `${t.name}.${schema.tables[tableIdx].columns[colIdx].name}`;
    if (aiTouched.has(key)) {
      const nextSet = new Set(aiTouched);
      nextSet.delete(key);
      setAiTouched(nextSet);
    }
  };

  const applyDictionary = (
    dict: { tables: { name: string; description: string; columns: { name: string; description: string }[] }[] },
    overwrite: boolean,
  ) => {
    const newAiTouched = new Set(aiTouched);
    const next: Schema = {
      ...schema,
      tables: schema.tables.map((t) => {
        const match = dict.tables.find((dt) => dt.name === t.name);
        if (!match) return t;
        const tableDesc = overwrite || !t.description ? match.description : t.description;
        if (overwrite || !t.description) newAiTouched.add(`${t.name}::table`);
        const columns = t.columns.map((c) => {
          const cm = match.columns.find((cc) => cc.name === c.name);
          if (!cm) return c;
          if (overwrite || !c.description) {
            newAiTouched.add(`${t.name}.${c.name}`);
            return { ...c, description: cm.description };
          }
          return c;
        });
        return { ...t, description: tableDesc, columns };
      }),
    };
    onSchemaChange(next);
    setAiTouched(newAiTouched);
  };

  const generate = async (onlyTable?: string) => {
    setBusy(onlyTable ? { table: onlyTable } : "all");
    setError(null);
    try {
      const dict = await generateDataDictionary(schema, onlyTable);
      applyDictionary(dict, false);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const regenerate = async (onlyTable?: string) => {
    if (!confirm(onlyTable
      ? `Overwrite all descriptions for "${onlyTable}"?`
      : "Overwrite all descriptions in the whole schema?")) return;
    setBusy(onlyTable ? { table: onlyTable } : "all");
    setError(null);
    try {
      const dict = await generateDataDictionary(schema, onlyTable);
      applyDictionary(dict, true);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const stats = (() => {
    let total = 0;
    let filled = 0;
    for (const t of schema.tables) {
      total += 1;
      if (t.description) filled += 1;
      for (const c of t.columns) {
        total += 1;
        if (c.description) filled += 1;
      }
    }
    return { total, filled, percent: total ? Math.round((filled / total) * 100) : 0 };
  })();

  return (
    <div className="dictionary">
      <div className="dict-toolbar">
        <div>
          <strong>Data dictionary</strong>
          <div className="muted">
            {stats.filled} of {stats.total} entries described ({stats.percent}%)
            {available === false && " · AI is not configured"}
          </div>
        </div>
        <div className="spacer" />
        <button
          disabled={busy !== null || available === false}
          onClick={() => generate()}
        >
          {busy === "all" ? "Generating…" : "✨ Generate missing"}
        </button>
        <button
          className="ghost"
          disabled={busy !== null || available === false}
          onClick={() => regenerate()}
        >
          ✨ Regenerate all
        </button>
      </div>

      {available === false && (
        <div className="ai-unavailable">
          Set <code>GROQ_API_KEY</code> in the backend environment and restart{" "}
          <code>uvicorn</code> to enable AI generation. Manual editing still works.
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {schema.tables.length === 0 && (
        <div className="muted">No tables yet — add some in the Design view.</div>
      )}

      {schema.tables.map((t, ti) => (
        <div key={t.name} className="dict-table">
          <div className="dict-table-head">
            <div className="dict-table-title">
              <span className="dict-name">{t.name}</span>
              <span className="dict-count">{t.columns.length} cols</span>
            </div>
            <div className="spacer" />
            <button
              disabled={busy !== null || available === false}
              onClick={() => generate(t.name)}
            >
              {typeof busy === "object" && busy?.table === t.name
                ? "Generating…"
                : "✨ Generate"}
            </button>
            <button
              className="ghost"
              disabled={busy !== null || available === false}
              onClick={() => regenerate(t.name)}
            >
              Redo
            </button>
          </div>

          <div className="dict-field">
            <label>
              Table description{" "}
              {aiTouched.has(`${t.name}::table`) && (
                <span className="ai-tag" title="Last set by AI">AI</span>
              )}
            </label>
            <textarea
              rows={2}
              placeholder="What does this table represent? (e.g. 'Registered end users of the application')"
              value={t.description ?? ""}
              onChange={(e) => {
                updateTable(ti, { description: e.target.value });
                const k = `${t.name}::table`;
                if (aiTouched.has(k)) {
                  const next = new Set(aiTouched);
                  next.delete(k);
                  setAiTouched(next);
                }
              }}
            />
          </div>

          <table className="dict-cols">
            <thead>
              <tr>
                <th>Column</th>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {t.columns.map((c, ci) => {
                const key = `${t.name}.${c.name}`;
                return (
                  <tr key={c.name}>
                    <td className="mono col-name">{c.name}</td>
                    <td>
                      <span className="type-badge">{c.type}</span>
                      {c.primary_key && <span className="tag">PK</span>}
                      {c.references && (
                        <span className="tag fk">→ {c.references}</span>
                      )}
                    </td>
                    <td>
                      <div className="desc-cell">
                        <textarea
                          rows={1}
                          placeholder="Describe what this column stores…"
                          value={c.description ?? ""}
                          onChange={(e) =>
                            updateColumnDescription(ti, ci, e.target.value)
                          }
                        />
                        {aiTouched.has(key) && (
                          <span className="ai-tag" title="Last set by AI">AI</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
