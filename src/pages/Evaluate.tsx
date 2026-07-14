import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchApplicant,
  fetchEvaluationsForApplicant,
  fetchMyEvaluation,
  fetchAssignedEvaluatorIds,
  upsertEvaluation,
  deleteEvaluation,
  fetchPositions,
} from "../lib/api";
import type { Applicant, Evaluation, Position, Recommendation } from "../types";
import { CRITERIA, RECOMMENDATIONS, weightedScore } from "../types";
import RatingInput from "../components/RatingInput";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { ArrowLeft, CheckCircle2, Save, Eraser } from "lucide-react";

type ScoreState = Record<(typeof CRITERIA)[number]["key"], number>;

const EMPTY_SCORES: ScoreState = {
  leadership: 0,
  communication: 0,
  role_knowledge: 0,
  problem_solving: 0,
  commitment: 0,
  professionalism: 0,
};

export default function Evaluate() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();

  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [priorEvaluations, setPriorEvaluations] = useState<Evaluation[]>([]);
  const [isAssignedToMe, setIsAssignedToMe] = useState<boolean | null>(null);
  const [scores, setScores] = useState<ScoreState>(EMPTY_SCORES);
  const [recommendation, setRecommendation] = useState<Recommendation | "">("");
  const [notes, setNotes] = useState("");
  const [allPositions, setAllPositions] = useState<Position[]>([]);
  const [recommendedPositions, setRecommendedPositions] = useState<string[]>([]);
  const [recommendedOtherPosition, setRecommendedOtherPosition] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mineId, setMineId] = useState<string | null>(null);
  const [confirmClearId, setConfirmClearId] = useState<string | null>(null);
  const [clearingId, setClearingId] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !user) return;
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [a, evals, mine, positions] = await Promise.all([
          fetchApplicant(id!),
          fetchEvaluationsForApplicant(id!),
          fetchMyEvaluation(id!, user!.id),
          fetchPositions(),
        ]);
        if (!active) return;
        setApplicant(a);
        setPriorEvaluations(evals);
        setAllPositions(positions);

        if (!isAdmin) {
          const assignedIds = await fetchAssignedEvaluatorIds(id!);
          if (active) setIsAssignedToMe(assignedIds.includes(user!.id));
        } else {
          setIsAssignedToMe(true);
        }

        if (mine) {
          setScores({
            leadership: mine.leadership,
            communication: mine.communication,
            role_knowledge: mine.role_knowledge,
            problem_solving: mine.problem_solving,
            commitment: mine.commitment,
            professionalism: mine.professionalism,
          });
          setRecommendation(mine.recommendation);
          setNotes(mine.notes ?? "");
          setRecommendedPositions(mine.recommended_positions ?? []);
          setRecommendedOtherPosition(mine.recommended_other_position ?? "");
          setMineId(mine.id);
        } else {
          setMineId(null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load applicant.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [id, user, isAdmin]);

  const total = useMemo(() => weightedScore(scores), [scores]);
  const allRated = CRITERIA.every((c) => scores[c.key] > 0);

  async function handleSubmit() {
    if (!id || !user || !allRated || !recommendation) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await upsertEvaluation({
        applicant_id: id,
        evaluator_id: user.id,
        ...scores,
        recommendation,
        notes: notes.trim() || null,
        recommended_positions: recommendedPositions,
        recommended_other_position: recommendedOtherPosition || null,
      });
      const evals = await fetchEvaluationsForApplicant(id);
      setPriorEvaluations(evals);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save evaluation.");
    } finally {
      setSaving(false);
    }
  }

  async function handleClear(evaluationId: string) {
    if (!id) return;
    setClearingId(evaluationId);
    setError(null);
    try {
      await deleteEvaluation(evaluationId);
      const evals = await fetchEvaluationsForApplicant(id);
      setPriorEvaluations(evals);
      if (evaluationId === mineId) {
        setMineId(null);
        setScores(EMPTY_SCORES);
        setRecommendation("");
        setNotes("");
        setRecommendedPositions([]);
        setRecommendedOtherPosition("");
        setSaved(false);
      }
      setConfirmClearId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not clear this evaluation.");
    } finally {
      setClearingId(null);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl px-6 py-20 text-center text-sm text-ink/40">Loading evaluation sheet…</div>;
  }

  if (error && !applicant) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <p className="text-sm font-medium text-rose-600">{error}</p>
        <Link to="/applicants" className="btn-ghost mt-4 inline-flex">
          Back to Applicants
        </Link>
      </div>
    );
  }

  if (!applicant) return null;

  if (isAssignedToMe === false) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <p className="text-sm font-medium text-rose-600">
          You haven't been assigned to evaluate {applicant.full_name}. Ask the Commissioner to assign you first.
        </p>
        <Link to="/applicants" className="btn-ghost mt-4 inline-flex">
          Back to Applicants
        </Link>
      </div>
    );
  }

  const othersEvaluations = priorEvaluations.filter((e) => e.evaluator_id !== user?.id);

  const appliedPositionNames = [
    applicant.position_applied?.name,
    ...(applicant.other_positions ?? []),
  ].filter((n): n is string => Boolean(n));

  function togglePosition(name: string) {
    setRecommendedPositions((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link to="/applicants" className="inline-flex items-center gap-1.5 text-sm font-semibold text-nu-700 hover:text-nu-900">
        <ArrowLeft size={15} /> Back to Applicants
      </Link>

      <div className="mt-4 flex flex-col justify-between gap-4 rounded-2xl border border-nu-100 bg-white p-6 shadow-card sm:flex-row sm:items-center">
        <div>
          <p className="eyebrow">Evaluation Sheet</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-nu-900">{applicant.full_name}</h1>
          <p className="mt-1 text-sm text-ink/50">
            Applied for{" "}
            <strong className="text-nu-700">
              {applicant.position_applied?.name ?? "—"}
              {applicant.other_positions && applicant.other_positions.length > 0
                ? `, ${applicant.other_positions.join(", ")}`
                : ""}
            </strong>
            {applicant.position_assigned_id !== applicant.position_applied_id && (
              <> · Currently assigned to <strong className="text-gold-700">{applicant.position_assigned?.name}</strong></>
            )}
          </p>
        </div>
        <StatusBadge status={applicant.status} />
      </div>

      {/* Score dial */}
      <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_auto]">
        <div className="card p-6">
          <p className="label mb-4">Evaluator</p>
          <p className="font-display text-lg font-bold text-nu-900">{profile?.full_name ?? user?.email}</p>
          <p className="mt-1 text-sm text-ink/50">
            {priorEvaluations.length} panelist{priorEvaluations.length === 1 ? "" : "s"} have submitted a score sheet so far.
          </p>
        </div>
        <div className="card flex flex-col items-center justify-center p-6">
          <p className="label">Your Weighted Score</p>
          <p className="mt-2 font-mono text-4xl font-extrabold text-nu-900">
            {allRated ? total.toFixed(1) : "—"}
            <span className="text-lg font-semibold text-ink/30">/100</span>
          </p>
        </div>
      </div>

      {/* Criteria */}
      <div className="mt-6 space-y-3">
        {CRITERIA.map((c) => (
          <div key={c.key} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-display text-sm font-bold text-nu-900">{c.label}</p>
                <p className="mt-0.5 max-w-xl text-xs text-ink/50">{c.description}</p>
              </div>
              <span className="rounded-full bg-nu-50 px-2.5 py-1 font-mono text-xs font-bold text-nu-700">
                {Math.round(c.weight * 100)}% weight
              </span>
            </div>
            <div className="mt-4">
              <RatingInput
                name={c.key}
                value={scores[c.key]}
                onChange={(v) => setScores((s) => ({ ...s, [c.key]: v }))}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Recommendation */}
      <div className="card mt-3 p-5">
        <p className="font-display text-sm font-bold text-nu-900">Overall Recommendation</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {RECOMMENDATIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRecommendation(r)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                recommendation === r
                  ? "border-gold-500 bg-nu-900 text-white shadow-gold"
                  : "border-nu-100 bg-white text-ink/70 hover:border-nu-500"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${
                  recommendation === r ? "border-gold-400 bg-gold-400" : "border-nu-200"
                }`}
              >
                {recommendation === r && <CheckCircle2 size={12} className="text-nu-900" />}
              </span>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Recommended Position(s) */}
      <div className="card mt-3 p-5">
        <p className="font-display text-sm font-bold text-nu-900">Recommend For Position</p>
        <p className="mt-0.5 text-xs text-ink/50">Check which of the applicant's applied position(s) you recommend them for.</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {appliedPositionNames.map((name) => (
            <label
              key={name}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                recommendedPositions.includes(name)
                  ? "border-gold-500 bg-nu-900 text-white shadow-gold"
                  : "border-nu-100 bg-white text-ink/70 hover:border-nu-500"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={recommendedPositions.includes(name)}
                onChange={() => togglePosition(name)}
              />
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${
                  recommendedPositions.includes(name) ? "border-gold-400 bg-gold-400" : "border-nu-200"
                }`}
              >
                {recommendedPositions.includes(name) && <CheckCircle2 size={12} className="text-nu-900" />}
              </span>
              {name}
            </label>
          ))}
        </div>

        <div className="mt-4">
          <label className="label mb-1.5 block" htmlFor="other-position">
            Others: <span className="font-normal text-ink/40">(recommend for a different position, if applicable)</span>
          </label>
          <select
            id="other-position"
            className="input"
            value={recommendedOtherPosition}
            onChange={(e) => setRecommendedOtherPosition(e.target.value)}
          >
            <option value="">None</option>
            {allPositions
              .filter((p) => !appliedPositionNames.includes(p.name))
              .map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Notes */}
      <div className="card mt-3 p-5">
        <label className="font-display text-sm font-bold text-nu-900" htmlFor="notes">
          Panelist Notes <span className="font-normal text-ink/40">(optional)</span>
        </label>
        <textarea
          id="notes"
          className="input mt-3 min-h-[100px]"
          placeholder="Observations, standout answers, concerns…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p>}
      {saved && (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          <CheckCircle2 size={16} /> Evaluation saved.
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink/40">
          {allRated && recommendation ? "All fields complete — ready to submit." : "Rate all six criteria and select a recommendation to submit."}
        </p>
        <div className="flex items-center gap-2">
          {isAdmin && mineId && (
            <>
              {confirmClearId === mineId ? (
                <span className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  Clear this score sheet?
                  <button
                    onClick={() => handleClear(mineId)}
                    disabled={clearingId === mineId}
                    className="rounded-lg bg-rose-600 px-2.5 py-1 text-white hover:bg-rose-700"
                  >
                    {clearingId === mineId ? "Clearing…" : "Yes, clear"}
                  </button>
                  <button onClick={() => setConfirmClearId(null)} className="rounded-lg px-2 py-1 text-rose-700 hover:bg-rose-100">
                    Cancel
                  </button>
                </span>
              ) : (
                <button onClick={() => setConfirmClearId(mineId)} className="btn-ghost !px-3 !py-1.5 !text-xs !text-rose-600">
                  <Eraser size={14} /> Clear Evaluation
                </button>
              )}
            </>
          )}
          <button onClick={handleSubmit} disabled={saving || !allRated || !recommendation} className="btn-gold">
            <Save size={16} /> {saving ? "Saving…" : "Save Evaluation"}
          </button>
        </div>
      </div>

      {/* Other panelists */}
      {othersEvaluations.length > 0 && (
        <div className="mt-10">
          <p className="eyebrow">Other Panelist Scores</p>
          <div className="mt-3 space-y-2">
            {othersEvaluations.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-xl border border-nu-100 bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-nu-900">{e.evaluator_name}</p>
                  <p className="text-xs text-ink/40">{e.recommendation}</p>
                  {((e.recommended_positions && e.recommended_positions.length > 0) || e.recommended_other_position) && (
                    <p className="text-xs text-ink/40">
                      For: {[...(e.recommended_positions ?? []), e.recommended_other_position].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-mono text-lg font-bold text-nu-900">{weightedScore(e).toFixed(1)}</p>
                  {isAdmin && (
                    confirmClearId === e.id ? (
                      <span className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">
                        Clear?
                        <button
                          onClick={() => handleClear(e.id)}
                          disabled={clearingId === e.id}
                          className="rounded bg-rose-600 px-1.5 py-0.5 text-white hover:bg-rose-700"
                        >
                          {clearingId === e.id ? "…" : "Yes"}
                        </button>
                        <button onClick={() => setConfirmClearId(null)} className="rounded px-1.5 py-0.5 text-rose-700 hover:bg-rose-100">
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmClearId(e.id)}
                        title={`Clear ${e.evaluator_name}'s score sheet`}
                        className="rounded-lg p-1.5 text-ink/30 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Eraser size={14} />
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={() => navigate("/applicants")} className="btn-ghost mt-8">
        <ArrowLeft size={15} /> Return to list
      </button>
    </div>
  );
}
