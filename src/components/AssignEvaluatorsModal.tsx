import { useEffect, useState } from "react";
import type { Applicant, EvaluatorProfile } from "../types";
import { fetchAssignedEvaluatorIds, setAssignedEvaluators } from "../lib/api";
import { X, Users } from "lucide-react";

interface AssignEvaluatorsModalProps {
  applicant: Applicant;
  evaluators: EvaluatorProfile[];
  onClose: () => void;
  onSaved: () => void;
}

export default function AssignEvaluatorsModal({
  applicant,
  evaluators,
  onClose,
  onSaved,
}: AssignEvaluatorsModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchAssignedEvaluatorIds(applicant.id)
      .then((ids) => {
        if (active) setSelected(new Set(ids));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load current assignment."))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applicant.id]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await setAssignedEvaluators(applicant.id, Array.from(selected));
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save assignment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-nu-950/50 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-md p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="eyebrow">Assign Evaluators</p>
            <h3 className="mt-1 font-display text-lg font-bold text-nu-900">{applicant.full_name}</h3>
            <p className="mt-1 text-xs text-ink/50">Pick one or more evaluators to grade this applicant.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink/40 hover:bg-nu-50 hover:text-ink">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-ink/40">Loading evaluators…</div>
        ) : evaluators.length === 0 ? (
          <div className="py-8 text-center text-sm text-ink/40">No evaluator accounts found.</div>
        ) : (
          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {evaluators.map((ev) => {
              const checked = selected.has(ev.id);
              return (
                <label
                  key={ev.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition ${
                    checked ? "border-gold-500 bg-nu-900 text-white" : "border-nu-100 bg-white text-ink/70 hover:border-nu-500"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-gold-500"
                    checked={checked}
                    onChange={() => toggle(ev.id)}
                  />
                  <div className="flex-1">
                    <p className={checked ? "font-semibold text-white" : "font-semibold text-nu-900"}>
                      {ev.full_name ?? ev.username}
                    </p>
                    <p className={`text-xs ${checked ? "text-white/60" : "text-ink/40"}`}>@{ev.username}</p>
                  </div>
                  {checked && <Users size={14} />}
                </label>
              );
            })}
          </div>
        )}

        {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}

        <div className="mt-6 flex items-center justify-between gap-2">
          <p className="text-xs text-ink/40">
            {selected.size} evaluator{selected.size === 1 ? "" : "s"} assigned
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || loading} className="btn-primary">
              {saving ? "Saving…" : "Save assignment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
