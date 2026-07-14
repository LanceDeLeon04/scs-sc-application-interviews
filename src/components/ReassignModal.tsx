import { useState } from "react";
import type { Applicant, ApplicantStatus, Position } from "../types";
import { reassignApplicant, updateApplicantStatus } from "../lib/api";
import { X } from "lucide-react";

interface ReassignModalProps {
  applicant: Applicant;
  positions: Position[];
  onClose: () => void;
  onSaved: () => void;
}

const STATUSES: ApplicantStatus[] = ["Pending", "Evaluated", "Qualified", "Disqualified"];

export default function ReassignModal({ applicant, positions, onClose, onSaved }: ReassignModalProps) {
  const [positionId, setPositionId] = useState(
    applicant.position_assigned_id ?? applicant.position_applied_id ?? ""
  );
  const [status, setStatus] = useState<ApplicantStatus>(applicant.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changedPosition = positionId !== (applicant.position_assigned_id ?? applicant.position_applied_id);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (positionId && positionId !== applicant.position_assigned_id) {
        await reassignApplicant(applicant.id, positionId);
      }
      if (status !== applicant.status) {
        await updateApplicantStatus(applicant.id, status);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-nu-950/50 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-md p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="eyebrow">Manage Assignment</p>
            <h3 className="mt-1 font-display text-lg font-bold text-nu-900">{applicant.full_name}</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink/40 hover:bg-nu-50 hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label mb-1.5 block">Applied for</label>
            <p className="text-sm text-ink/70">
              {applicant.position_applied?.name ?? "No position on file"}
            </p>
          </div>

          <div>
            <label className="label mb-1.5 block" htmlFor="assign-position">
              Assign to position
            </label>
            <select
              id="assign-position"
              className="input"
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
            >
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.id === applicant.position_applied_id ? " (applied)" : ""}
                </option>
              ))}
            </select>
            {changedPosition && (
              <p className="mt-1.5 text-xs font-medium text-gold-700">
                This differs from the position the applicant originally applied for.
              </p>
            )}
          </div>

          <div>
            <label className="label mb-1.5 block" htmlFor="assign-status">
              Status
            </label>
            <select
              id="assign-status"
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value as ApplicantStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
