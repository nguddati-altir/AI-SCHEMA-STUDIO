import type { Column, Schema } from "./types";

const BASE = "/api";

export async function generateSql(schema: Schema, dialect: "postgres" | "mysql"): Promise<string> {
  const res = await fetch(`${BASE}/generate/sql?dialect=${dialect}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(schema),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.sql;
}

export async function generatePrisma(
  schema: Schema,
  provider: "postgresql" | "mysql"
): Promise<string> {
  const res = await fetch(`${BASE}/generate/prisma?provider=${provider}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(schema),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.prisma;
}

export interface ExcelReport {
  ok: boolean;
  sheets: Record<
    string,
    {
      status: "ok" | "mismatch" | "absent" | "skipped" | "error";
      rows: number;
      reason?: string;
      headers?: string[];
      missing_columns?: string[];
      extra_columns?: string[];
      preview?: unknown[][];
    }
  >;
}

export async function validateExcel(schema: Schema, file: File): Promise<ExcelReport> {
  const form = new FormData();
  form.append("schema_json", JSON.stringify(schema));
  form.append("file", file);
  const res = await fetch(`${BASE}/excel/validate`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function excelInserts(
  schema: Schema,
  file: File,
  dialect: "postgres" | "mysql"
): Promise<string> {
  const form = new FormData();
  form.append("schema_json", JSON.stringify(schema));
  form.append("dialect", dialect);
  form.append("file", file);
  const res = await fetch(`${BASE}/excel/inserts`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.sql;
}

export interface AIChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SuggestedColumn extends Column {
  reason?: string | null;
}

export interface SuggestResult {
  columns: SuggestedColumn[];
  rationale: string;
}

export async function aiAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/ai/available`);
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.available;
  } catch {
    return false;
  }
}

export async function suggestColumns(req: {
  description: string;
  table_name?: string;
  existing_columns?: Column[];
  history?: AIChatMessage[];
}): Promise<{ result: SuggestResult; history: AIChatMessage[] }> {
  const res = await fetch(`${BASE}/ai/suggest-columns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      description: req.description,
      table_name: req.table_name,
      existing_columns: req.existing_columns ?? [],
      history: req.history ?? [],
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface DictionaryResult {
  tables: {
    name: string;
    description: string;
    columns: { name: string; description: string }[];
  }[];
}

export async function generateDataDictionary(
  schema: Schema,
  onlyTable?: string
): Promise<DictionaryResult> {
  const res = await fetch(`${BASE}/ai/data-dictionary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schema, only_table: onlyTable ?? null }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.result as DictionaryResult;
}
