import { useState } from "react";
import { COLUMN_TYPES, type Column, type Table, newColumn } from "../types";
import { AIAssist } from "./AIAssist";

interface Props {
  table: Table;
  allTables: Table[];
  onChange: (next: Table) => void;
  onDelete: () => void;
}

export function TableEditor({ table, allTables, onChange, onDelete }: Props) {
  const [aiOpen, setAiOpen] = useState(false);
  const update = (patch: Partial<Table>) => onChange({ ...table, ...patch });
  const updateCol = (idx: number, patch: Partial<Column>) => {
    const cols = table.columns.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    update({ columns: cols });
  };
  const removeCol = (idx: number) => update({ columns: table.columns.filter((_, i) => i !== idx) });
  const addCol = () => update({ columns: [...table.columns, newColumn(`col_${table.columns.length}`)] });
  const addManyCols = (cols: Column[]) => {
    const existing = new Set(table.columns.map((c) => c.name));
    const merged = [...table.columns];
    for (const c of cols) {
      if (!existing.has(c.name)) merged.push(c);
    }
    update({ columns: merged });
  };

  const fkOptions = allTables
    .filter((t) => t.name !== table.name)
    .flatMap((t) =>
      t.columns.filter((c) => c.primary_key || c.unique).map((c) => `${t.name}.${c.name}`)
    );

  return (
    <div className="table-card">
      <div className="table-header">
        <input
          className="table-name"
          value={table.name}
          onChange={(e) => update({ name: e.target.value })}
        />
        <button className="ai-toggle" onClick={() => setAiOpen((v) => !v)}>
          {aiOpen ? "× AI Assist" : "✨ AI Assist"}
        </button>
        <button className="danger" onClick={onDelete}>
          Delete table
        </button>
      </div>

      {aiOpen && (
        <AIAssist
          tableName={table.name}
          existingColumns={table.columns}
          onAdd={addManyCols}
          onClose={() => setAiOpen(false)}
        />
      )}

      <table className="cols">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Size / Prec.</th>
            <th>PK</th>
            <th>Null</th>
            <th>Uniq</th>
            <th>AI</th>
            <th>Default</th>
            <th>FK → table.col</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {table.columns.map((col, i) => (
            <tr key={i}>
              <td>
                <input value={col.name} onChange={(e) => updateCol(i, { name: e.target.value })} />
              </td>
              <td>
                <select
                  value={col.type}
                  onChange={(e) => updateCol(i, { type: e.target.value as Column["type"] })}
                >
                  {COLUMN_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </td>
              <td className="size-cell">
                {col.type === "string" && (
                  <input
                    type="number"
                    className="num"
                    placeholder="255"
                    value={col.length ?? ""}
                    onChange={(e) =>
                      updateCol(i, { length: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                )}
                {col.type === "decimal" && (
                  <>
                    <input
                      type="number"
                      className="num tiny"
                      placeholder="p"
                      value={col.precision ?? ""}
                      onChange={(e) =>
                        updateCol(i, {
                          precision: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                    <input
                      type="number"
                      className="num tiny"
                      placeholder="s"
                      value={col.scale ?? ""}
                      onChange={(e) =>
                        updateCol(i, { scale: e.target.value ? Number(e.target.value) : null })
                      }
                    />
                  </>
                )}
                {col.type === "json" && <span className="badge">JSON/JSONB</span>}
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={col.primary_key}
                  onChange={(e) => updateCol(i, { primary_key: e.target.checked })}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={col.nullable}
                  onChange={(e) => updateCol(i, { nullable: e.target.checked })}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={col.unique}
                  onChange={(e) => updateCol(i, { unique: e.target.checked })}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={col.auto_increment}
                  disabled={!(col.type === "int" || col.type === "bigint")}
                  onChange={(e) => updateCol(i, { auto_increment: e.target.checked })}
                />
              </td>
              <td>
                <input
                  className="default"
                  placeholder="e.g. 0, 'x', CURRENT_TIMESTAMP"
                  value={col.default ?? ""}
                  onChange={(e) => updateCol(i, { default: e.target.value || null })}
                />
              </td>
              <td>
                <select
                  value={col.references ?? ""}
                  onChange={(e) => updateCol(i, { references: e.target.value || null })}
                >
                  <option value="">— none —</option>
                  {fkOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <button className="icon" onClick={() => removeCol(i)} title="Delete column">
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button className="ghost" onClick={addCol}>
        + Add column
      </button>
    </div>
  );
}
