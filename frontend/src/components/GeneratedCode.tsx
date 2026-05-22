import { useEffect, useState } from "react";
import type { Schema } from "../types";
import { generatePrisma, generateSql } from "../api";

interface Props {
  schema: Schema;
}

type Tab = "postgres" | "mysql" | "prisma-pg" | "prisma-mysql";

const TABS: { id: Tab; label: string; filename: string }[] = [
  { id: "postgres", label: "Postgres SQL", filename: "schema.postgres.sql" },
  { id: "mysql", label: "MySQL SQL", filename: "schema.mysql.sql" },
  { id: "prisma-pg", label: "Prisma (Postgres)", filename: "schema.prisma" },
  { id: "prisma-mysql", label: "Prisma (MySQL)", filename: "schema.prisma" },
];

export function GeneratedCode({ schema }: Props) {
  const [tab, setTab] = useState<Tab>("postgres");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const run = async () => {
      try {
        let result: string;
        if (tab === "postgres") result = await generateSql(schema, "postgres");
        else if (tab === "mysql") result = await generateSql(schema, "mysql");
        else if (tab === "prisma-pg") result = await generatePrisma(schema, "postgresql");
        else result = await generatePrisma(schema, "mysql");
        if (!cancelled) setCode(result);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [schema, tab]);

  const current = TABS.find((t) => t.id === tab)!;

  const download = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = current.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(code);
  };

  return (
    <div className="generated">
      <div className="tab-row">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <div className="spacer" />
        <button onClick={copy}>Copy</button>
        <button onClick={download}>Download</button>
      </div>
      {error && <div className="error">{error}</div>}
      <pre className="code">{loading ? "// generating…" : code}</pre>
    </div>
  );
}
