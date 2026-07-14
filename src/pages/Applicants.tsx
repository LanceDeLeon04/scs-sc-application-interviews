import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchApplicants,
  fetchPositions,
  createApplicant,
  fetchEvaluators,
  fetchAllAssignments,
  fetchAssignedApplicantIdsForEvaluator,
} from "../lib/api";
import type { Applicant, ApplicantStatus, Assignment, EvaluatorProfile, Position } from "../types";
import StatusBadge from "../components/StatusBadge";
import ReassignModal from "../components/ReassignModal";
import AssignEvaluatorsModal from "../components/AssignEvaluatorsModal";
import CreatePanelAccountModal from "../components/CreatePanelAccountModal";
import { useAuth } from "../context/AuthContext";
import { Search, SlidersHorizontal, ArrowRight, UserPlus, UserRoundPlus, X, Users } from "lucide-react";

const STATUSES: (ApplicantStatus | "All")[] = ["All", "Pending", "Evaluated", "Qualified", "Disqualified"];

export default function Applicants() {
  const { isAdmin, user } = useAuth();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [evaluators, setEvaluators] = useState<EvaluatorProfile[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [myAssignedIds, setMyAssignedIds] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<ApplicantStatus | "All">("All");
  const [reassignTarget, setReassignTarget] = useState<Applicant | null>(null);
  const [assignTarget, setAssignTarget] = useState<Applicant | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCreatePanelForm, setShowCreatePanelForm] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      if (isAdmin) {
        const [a, p, ev, asg] = await Promise.all([
          fetchApplicants(),
          fetchPositions(),
          fetchEvaluators(),
          fetchAllAssignments(),
        ]);
        setApplicants(a);
        setPositions(p);
        setEvaluators(ev);
        setAssignments(asg);
      } else {
        const [a, p, mine] = await Promise.all([
          fetchApplicants(),
          fetchPositions(),
          user ? fetchAssignedApplicantIdsForEvaluator(user.id) : Promise.resolve([]),
        ]);
        setApplicants(a);
        setPositions(p);
        setMyAssignedIds(new Set(mine));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load applicants.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, user?.id]);

  const assignedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const asg of assignments) {
      counts.set(asg.applicant_id, (counts.get(asg.applicant_id) ?? 0) + 1);
    }
    return counts;
  }, [assignments]);

  const filtered = useMemo(() => {
    return applicants.filter((a) => {
      if (!isAdmin && myAssignedIds && !myAssignedIds.has(a.id)) return false;
      const matchesSearch = a.full_name.toLowerCase().includes(search.toLowerCase());
      const matchesPosition =
        positionFilter === "All" ||
        a.position_assigned_id === positionFilter ||
        a.position_applied_id === positionFilter;
      const matchesStatus = statusFilter === "All" || a.status === statusFilter;
      return matchesSearch && matchesPosition && matchesStatus;
    });
  }, [applicants, search, positionFilter, statusFilter, isAdmin, myAssignedIds]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Panel Roster</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-nu-900">Applicants</h1>
          <p className="mt-1 text-sm text-ink/50">
            {isAdmin
              ? `${applicants.length} applicant${applicants.length === 1 ? "" : "s"} across ${positions.length} position${positions.length === 1 ? "" : "s"}.`
              : `${myAssignedIds?.size ?? 0} applicant${(myAssignedIds?.size ?? 0) === 1 ? "" : "s"} assigned to you.`}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowCreatePanelForm(true)} className="btn-ghost">
              <UserRoundPlus size={16} /> Add panel account
            </button>
            <button onClick={() => setShowAddForm(true)} className="btn-primary">
              <UserPlus size={16} /> Add applicant
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-nu-100 bg-white p-4 shadow-card sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
          <input
            className="input pl-9"
            placeholder="Search applicant name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-ink/30" />
          <select className="input" value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}>
            <option value="All">All positions</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ApplicantStatus | "All")}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All statuses" : s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="mt-6 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p>}

      {/* List */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-nu-100 bg-white shadow-card">
        {loading ? (
          <div className="p-10 text-center text-sm text-ink/40">Loading applicants…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-ink/40">No applicants match these filters.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-nu-100 bg-nu-50 text-xs font-bold uppercase tracking-wider text-nu-700">
                <th className="px-5 py-3">Applicant</th>
                <th className="px-5 py-3">Applied Position</th>
                <th className="px-5 py-3">Assigned Position</th>
                <th className="px-5 py-3">Status</th>
                {isAdmin && <th className="px-5 py-3">Evaluators</th>}
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nu-50">
              {filtered.map((a) => {
                const reassigned =
                  a.position_assigned_id && a.position_assigned_id !== a.position_applied_id;
                return (
                  <tr key={a.id} className="transition hover:bg-nu-50/50">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-nu-900">{a.full_name}</p>
                      <p className="text-xs text-ink/40">
                        <span className="font-mono font-semibold text-nu-700/70">{a.applicant_code}</span>
                        {(a.course || a.year_level) && " · "}
                        {a.course ?? ""} {a.year_level ? `· ${a.year_level}` : ""}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-ink/70">
                      {a.position_applied?.name ?? "—"}
                      {a.other_positions && a.other_positions.length > 0 && (
                        <span className="ml-1.5 inline-flex items-center rounded-full bg-nu-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-nu-700" title={`Also applied: ${a.other_positions.join(", ")}`}>
                          +{a.other_positions.length} more
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={reassigned ? "font-semibold text-gold-700" : "text-ink/70"}>
                        {a.position_assigned?.name ?? "—"}
                      </span>
                      {reassigned && (
                        <span className="ml-2 rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-700">
                          Reassigned
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={a.status} />
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setAssignTarget(a)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-nu-100 px-2.5 py-1 text-xs font-semibold text-nu-700 hover:border-gold-500"
                        >
                          <Users size={12} />
                          {assignedCounts.get(a.id) ?? 0} assigned
                        </button>
                      </td>
                    )}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {isAdmin && (
                          <button onClick={() => setReassignTarget(a)} className="btn-ghost !px-3 !py-1.5 !text-xs">
                            Reassign
                          </button>
                        )}
                        <Link to={`/evaluate/${a.id}`} className="btn-primary !px-3 !py-1.5 !text-xs">
                          Evaluate <ArrowRight size={13} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {reassignTarget && (
        <ReassignModal
          applicant={reassignTarget}
          positions={positions}
          onClose={() => setReassignTarget(null)}
          onSaved={load}
        />
      )}

      {assignTarget && (
        <AssignEvaluatorsModal
          applicant={assignTarget}
          evaluators={evaluators}
          onClose={() => setAssignTarget(null)}
          onSaved={load}
        />
      )}

      {showAddForm && (
        <AddApplicantModal positions={positions} onClose={() => setShowAddForm(false)} onSaved={load} />
      )}

      {showCreatePanelForm && (
        <CreatePanelAccountModal
          onClose={() => setShowCreatePanelForm(false)}
          onCreated={(evaluator) => setEvaluators((prev) => [...prev, evaluator].sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "")))}
        />
      )}
    </div>
  );
}

function AddApplicantModal({
  positions,
  onClose,
  onSaved,
}: {
  positions: Position[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [course, setCourse] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [positionId, setPositionId] = useState(positions[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !positionId) return;
    setSaving(true);
    setError(null);
    try {
      await createApplicant({
        full_name: fullName.trim(),
        email: email.trim() || undefined,
        course: course.trim() || undefined,
        year_level: yearLevel.trim() || undefined,
        position_applied_id: positionId,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add applicant.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-nu-950/50 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="card w-full max-w-md p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="eyebrow">New Entry</p>
            <h3 className="mt-1 font-display text-lg font-bold text-nu-900">Add applicant</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink/40 hover:bg-nu-50 hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label mb-1.5 block">Full name</label>
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label mb-1.5 block">Course</label>
              <input className="input" value={course} onChange={(e) => setCourse(e.target.value)} placeholder="BSCS" />
            </div>
            <div>
              <label className="label mb-1.5 block">Year level</label>
              <input className="input" value={yearLevel} onChange={(e) => setYearLevel(e.target.value)} placeholder="3rd Year" />
            </div>
          </div>
          <div>
            <label className="label mb-1.5 block">Email</label>
            <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label mb-1.5 block">Applied position</label>
            <select className="input" value={positionId} onChange={(e) => setPositionId(e.target.value)} required>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Adding…" : "Add applicant"}
          </button>
        </div>
      </form>
    </div>
  );
}
