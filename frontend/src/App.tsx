import { useEffect, useMemo, useState } from "react";
import { TableEditor } from "./components/TableEditor";
import { GeneratedCode } from "./components/GeneratedCode";
import { ExcelImport } from "./components/ExcelImport";
import { AIAssist } from "./components/AIAssist";
import { DataDictionary } from "./components/DataDictionary";
import { defaultSchema, newTable, type Column, type Schema, type Table } from "./types";

const STORAGE_KEY = "schema-designer.schema";

type View = "design" | "dictionary" | "code" | "import";

export default function App() {
  const [schema, setSchema] = useState<Schema>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as Schema;
      } catch {
        /* ignore */
      }
    }
    return defaultSchema();
  });
  const [view, setView] = useState<View>("design");
  const [newTableAi, setNewTableAi] = useState<{ name: string } | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schema));
  }, [schema]);

  const setTable = (idx: number, next: Table) => {
    setSchema((s) => ({ ...s, tables: s.tables.map((t, i) => (i === idx ? next : t)) }));
  };
  const deleteTable = (idx: number) => {
    setSchema((s) => ({ ...s, tables: s.tables.filter((_, i) => i !== idx) }));
  };
  const addTable = () => {
    setSchema((s) => ({
      ...s,
      tables: [...s.tables, newTable(`table_${s.tables.length + 1}`)],
    }));
  };
  const startAiTable = () => {
    const proposed = `table_${schema.tables.length + 1}`;
    const name = prompt("Name for the new table?", proposed)?.trim();
    if (!name) return;
    setNewTableAi({ name });
  };
  const onAiCreateTable = (cols: Column[]) => {
    if (!newTableAi) return;
    const t: Table = { name: newTableAi.name, columns: cols };
    setSchema((s) => ({ ...s, tables: [...s.tables, t] }));
    setNewTableAi(null);
  };
  const resetSchema = () => {
    if (confirm("Reset to the example schema? This will discard your tables.")) {
      setSchema(defaultSchema());
    }
  };

  const stats = useMemo(() => {
    const cols = schema.tables.reduce((acc, t) => acc + t.columns.length, 0);
    const jsonCols = schema.tables.reduce(
      (acc, t) => acc + t.columns.filter((c) => c.type === "json").length,
      0
    );
    return { tables: schema.tables.length, cols, jsonCols };
  }, [schema]);

  return (
    <div className="app">
      <header>
        <div className="brand">
          <h1>Schema Designer</h1>
          <span className="subtitle">MySQL · Postgres · Prisma · Excel seed</span>
        </div>
        <nav>
          <button className={view === "design" ? "active" : ""} onClick={() => setView("design")}>
            1. Design
          </button>
          <button
            className={view === "dictionary" ? "active" : ""}
            onClick={() => setView("dictionary")}
          >
            2. Data dictionary
          </button>
          <button className={view === "code" ? "active" : ""} onClick={() => setView("code")}>
            3. Generate code
          </button>
          <button className={view === "import" ? "active" : ""} onClick={() => setView("import")}>
            4. Excel import
          </button>
        </nav>
      </header>

      <section className="schema-bar">
        <label>
          Project name{" "}
          <input
            value={schema.name}
            onChange={(e) => setSchema((s) => ({ ...s, name: e.target.value }))}
          />
        </label>
        <span className="stat">
          {stats.tables} tables · {stats.cols} columns · {stats.jsonCols} JSON
        </span>
        <div className="spacer" />
        <button onClick={resetSchema}>Reset example</button>
      </section>

      <main>
        {view === "design" && (
          <div className="designer">
            {schema.tables.map((t, i) => (
              <TableEditor
                key={i}
                table={t}
                allTables={schema.tables}
                onChange={(next) => setTable(i, next)}
                onDelete={() => deleteTable(i)}
              />
            ))}

            {newTableAi && (
              <div className="table-card">
                <div className="table-header">
                  <span className="table-name new-ai">{newTableAi.name}</span>
                  <span className="muted">— describe this entity below</span>
                </div>
                <AIAssist
                  tableName={newTableAi.name}
                  existingColumns={[]}
                  onAdd={onAiCreateTable}
                  onClose={() => setNewTableAi(null)}
                />
              </div>
            )}

            <div className="add-row">
              <button className="add-table" onClick={addTable}>
                + Add table
              </button>
              <button className="add-table ai" onClick={startAiTable}>
                ✨ New table from description
              </button>
            </div>
          </div>
        )}

        {view === "dictionary" && (
          <DataDictionary schema={schema} onSchemaChange={setSchema} />
        )}

        {view === "code" && <GeneratedCode schema={schema} />}

        {view === "import" && <ExcelImport schema={schema} />}
      </main>
    </div>
  );
}
