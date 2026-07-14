import { useState } from "react";
import { fetchApplicantResultByCode } from "../lib/api";
import type { ApplicantResult } from "../types";
import StatusBadge from "../components/StatusBadge";
import Seal from "../components/Seal";
import { Search, IdCard } from "lucide-react";

export default function MyEvaluation() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApplicantResult | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetchApplicantResultByCode(code);
      setResult(r);
      setSearched(true);
      if (!r) setError("No applicant found with that ID. Double-check and try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <div className="flex flex-col items-center text-center">
        <Seal className="h-12 w-12" />
        <p className="eyebrow mt-4">Applicant Lookup</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-nu-900">View My Evaluation</h1>
        <p className="mt-2 text-sm text-ink/50">
          Enter the Applicant ID you were given to check your evaluation status.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card mt-8 flex flex-col gap-3 p-5 sm:flex-row sm:items-start">
        <div className="relative flex-1">
          <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
          <input
            className="input pl-9"
            placeholder="e.g. APP-0001"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            autoComplete="off"
          />
        </div>
        <button type="submit" disabled={!code.trim() || loading} className="btn-primary sm:w-auto">
          <Search size={16} /> {loading ? "Checking…" : "Check status"}
        </button>
      </form>

      {error && <p className="mt-4 text-center text-sm font-medium text-rose-600">{error}</p>}

      {searched && result && (
        <div className="card mt-6 p-6">
          <p className="eyebrow">Result for</p>
          <h2 className="mt-1 font-display text-xl font-bold text-nu-900">{result.full_name}</h2>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-nu-100 bg-nu-50/40 p-4">
              <p className="label">Average</p>
              <p className="mt-1 font-mono text-2xl font-extrabold text-nu-900">
                {result.has_grades && result.average_score !== null ? result.average_score.toFixed(1) : "—"}
              </p>
              {!result.has_grades && <p className="mt-1 text-xs text-ink/50">No Grades Yet</p>}
            </div>

            <div className="rounded-xl border border-nu-100 bg-nu-50/40 p-4">
              <p className="label">Approved Position</p>
              <p className="mt-1 text-sm font-semibold text-nu-900">{result.position_name ?? "—"}</p>
            </div>

            <div className="rounded-xl border border-nu-100 bg-nu-50/40 p-4">
              <p className="label">Status</p>
              <div className="mt-1.5">
                <StatusBadge status={result.status} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
