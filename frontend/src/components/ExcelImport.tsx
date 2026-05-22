import { useState } from "react";
import type { Schema } from "../types";
import { excelInserts, validateExcel, type ExcelReport } from "../api";

interface Props {
  schema: Schema;
}

export function ExcelImport({ schema }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ExcelReport | null>(null);
  const [inserts, setInserts] = useState<string>("");
  const [dialect, setDialect] = useState<"postgres" | "mysql">("postgres");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onValidate = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setInserts("");
    try {
      setReport(await validateExcel(schema, file));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const onGenerate = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setInserts(await excelInserts(schema, file, dialect));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    const blob = new Blob([inserts], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `seed.${dialect}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="import">
      <div className="rules">
        <strong>Rules:</strong> one sheet per table, sheet name must equal table name, headers must
        equal column names (extra or missing headers = mismatch).
      </div>

      <div className="controls">
        <input
          type="file"
          accept=".xlsx,.xlsm,.xltx,.xltm"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setReport(null);
            setInserts("");
          }}
        />
        <select value={dialect} onChange={(e) => setDialect(e.target.value as "postgres" | "mysql")}>
          <option value="postgres">postgres</option>
          <option value="mysql">mysql</option>
        </select>
        <button disabled={!file || busy} onClick={onValidate}>
          Validate
        </button>
        <button disabled={!file || busy} onClick={onGenerate}>
          Generate INSERTs
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {report && (
        <div className="report">
          <h3>Validation</h3>
          <div className={`overall ${report.ok ? "ok" : "warn"}`}>
            {report.ok ? "All sheets match the schema." : "Some sheets have issues — see below."}
          </div>
          {Object.entries(report.sheets).map(([name, info]) => (
            <div key={name} className={`sheet-card status-${info.status}`}>
              <div className="sheet-head">
                <span className="sheet-name">{name}</span>
                <span className="sheet-status">{info.status}</span>
                <span className="sheet-rows">{info.rows} rows</span>
              </div>
              {info.reason && <div className="sheet-reason">{info.reason}</div>}
              {info.missing_columns && info.missing_columns.length > 0 && (
                <div className="diff">
                  <strong>Missing columns:</strong> {info.missing_columns.join(", ")}
                </div>
              )}
              {info.extra_columns && info.extra_columns.length > 0 && (
                <div className="diff">
                  <strong>Extra columns:</strong> {info.extra_columns.join(", ")}
                </div>
              )}
              {info.preview && info.preview.length > 0 && info.headers && (
                <details>
                  <summary>Preview ({info.preview.length} rows)</summary>
                  <table className="preview">
                    <thead>
                      <tr>
                        {info.headers.map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {info.preview.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((v, ci) => (
                            <td key={ci}>{v === null || v === undefined ? "" : String(v)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      {inserts && (
        <div className="inserts">
          <div className="tab-row">
            <strong>Generated INSERTs ({dialect})</strong>
            <div className="spacer" />
            <button onClick={() => navigator.clipboard.writeText(inserts)}>Copy</button>
            <button onClick={download}>Download</button>
          </div>
          <pre className="code">{inserts}</pre>
        </div>
      )}
    </div>
  );
}
