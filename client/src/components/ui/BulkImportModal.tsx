import { useState, useRef } from "react";
import Modal from "./Modal";
import { Upload, Download, CheckCircle, XCircle, FileSpreadsheet } from "lucide-react";

interface ColumnDef {
  key: string;
  label: string;
  required?: boolean;
  example: string;
}

interface ImportResult {
  row: number;
  status: string;
  error?: string;
  [key: string]: unknown;
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  columns: ColumnDef[];
  onImport: (items: Record<string, string>[]) => Promise<{
    results: ImportResult[];
    summary: { total: number; success: number; errors: number };
  }>;
  onComplete: () => void;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(current.trim());
        current = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(current.trim());
        if (row.some((c) => c !== "")) rows.push(row);
        row = [];
        current = "";
      } else {
        current += ch;
      }
    }
  }
  row.push(current.trim());
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

export default function BulkImportModal({
  isOpen,
  onClose,
  title,
  columns,
  onImport,
  onComplete,
}: BulkImportModalProps) {
  const [step, setStep] = useState<"upload" | "preview" | "results">("upload");
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [summary, setSummary] = useState<{ total: number; success: number; errors: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setParsedData([]);
    setResults([]);
    setSummary(null);
    setImporting(false);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => {
    if (summary && summary.success > 0) onComplete();
    reset();
    onClose();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const rows = parseCSV(text);
        if (rows.length < 2) {
          setError("CSV must have a header row and at least one data row");
          return;
        }

        const headers = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, ""));
        const colKeys = columns.map((c) => c.key.toLowerCase());

        // Map headers to column keys
        const headerMap: number[] = [];
        for (const col of columns) {
          const idx = headers.findIndex(
            (h) => h === col.key.toLowerCase() || h === col.label.toLowerCase().replace(/\s+/g, "")
          );
          headerMap.push(idx);
        }

        const missingRequired = columns
          .filter((c, i) => c.required && headerMap[i] === -1)
          .map((c) => c.label);

        if (missingRequired.length > 0) {
          setError(`Missing required columns: ${missingRequired.join(", ")}`);
          return;
        }

        const items: Record<string, string>[] = [];
        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          const item: Record<string, string> = {};
          columns.forEach((col, i) => {
            const idx = headerMap[i];
            item[col.key] = idx >= 0 && idx < row.length ? row[idx] : "";
          });
          items.push(item);
        }

        setParsedData(items);
        setStep("preview");
      } catch {
        setError("Failed to parse CSV file");
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await onImport(parsedData);
      setResults(res.results);
      setSummary(res.summary);
      setStep("results");
    } catch (err: any) {
      setError(err.response?.data?.error || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const header = columns.map((c) => c.label).join(",");
    const example = columns.map((c) => c.example).join(",");
    const csv = `${header}\n${example}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, "_")}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <div className="space-y-4">
        {step === "upload" && (
          <>
            <p className="text-sm text-gray-500">
              Upload a CSV file to bulk import. Download the template to see the expected format.
            </p>

            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
            >
              <Download size={16} />
              Download CSV Template
            </button>

            <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
              <FileSpreadsheet size={40} className="mx-auto mb-2 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">
                Choose a CSV file or drag and drop
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFile}
                className="w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-600 hover:file:bg-primary-100"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="text-xs text-gray-400">
              <p className="font-medium text-gray-500 mb-1">Expected columns:</p>
              {columns.map((c) => (
                <span key={c.key} className="mr-2">
                  <span className={c.required ? "font-medium text-gray-600" : ""}>
                    {c.label}
                  </span>
                  {c.required && <span className="text-red-400">*</span>}
                </span>
              ))}
            </div>
          </>
        )}

        {step === "preview" && (
          <>
            <p className="text-sm text-gray-500">
              Preview: <span className="font-medium text-gray-700">{parsedData.length}</span> rows found. Review and click Import.
            </p>

            <div className="max-h-60 overflow-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left font-medium text-gray-500">#</th>
                    {columns.map((c) => (
                      <th key={c.key} className="px-3 py-2 text-left font-medium text-gray-500">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 20).map((item, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                      {columns.map((c) => (
                        <td key={c.key} className="px-3 py-1.5 max-w-[120px] truncate">
                          {item[c.key] || <span className="text-gray-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedData.length > 20 && (
                <p className="px-3 py-2 text-xs text-gray-400 bg-gray-50">
                  ...and {parsedData.length - 20} more rows
                </p>
              )}
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={reset}
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-700 disabled:opacity-50"
              >
                <Upload size={16} />
                {importing ? "Importing..." : `Import ${parsedData.length} Rows`}
              </button>
            </div>
          </>
        )}

        {step === "results" && summary && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <p className="text-lg font-bold text-gray-700">{summary.total}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
              <div className="rounded-lg bg-green-50 p-3 text-center">
                <p className="text-lg font-bold text-green-600">{summary.success}</p>
                <p className="text-xs text-green-600">Success</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3 text-center">
                <p className="text-lg font-bold text-red-600">{summary.errors}</p>
                <p className="text-xs text-red-600">Errors</p>
              </div>
            </div>

            {summary.errors > 0 && (
              <div className="max-h-40 overflow-auto rounded-lg border border-red-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-red-50">
                      <th className="px-3 py-2 text-left font-medium text-red-600">Row</th>
                      <th className="px-3 py-2 text-left font-medium text-red-600">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results
                      .filter((r) => r.status === "error")
                      .map((r, i) => (
                        <tr key={i} className="border-t border-red-100">
                          <td className="px-3 py-1.5 text-red-600">{r.row}</td>
                          <td className="px-3 py-1.5 text-red-600">{r.error}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleClose}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
