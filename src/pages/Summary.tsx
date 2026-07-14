import { useEffect, useMemo, useState } from "react";
import { fetchAllAssignments, fetchAllEvaluations, fetchApplicants, fetchPositions } from "../lib/api";
import type { Applicant, Assignment, Evaluation, Position, Recommendation } from "../types";
import { weightedScore } from "../types";
import StatusBadge from "../components/StatusBadge";
import { Link } from "react-router-dom";
import { Trophy, Medal, Award } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface RankedApplicant {
  applicant: Applicant;
  avgScore: number;
  evaluationCount: number;
  assignedCount: number;
  topRecommendation: Recommendation | null;
}

const RANK_ICONS = [Trophy, Medal, Award];

export default function Summary() {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePosition, setActivePosition] = useState<string | "All">("All");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [a, p, e, asg] = await Promise.all([
        fetchApplicants(),
        fetchPositions(),
        fetchAllEvaluations(),
        fetchAllAssignments(),
      ]);
      setApplicants(a);
      setPositions(p);
      setEvaluations(e);
      setAssignments(asg);
      setLoading(false);
    }
    load();
  }, []);

  const assignedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const asg of assignments) {
      counts.set(asg.applicant_id, (counts.get(asg.applicant_id) ?? 0) + 1);
    }
    return counts;
  }, [assignments]);

  const byPosition = useMemo(() => {
    const groups = new Map<string, RankedApplicant[]>();
    for (const applicant of applicants) {
      const posId = applicant.position_assigned_id ?? applicant.position_applied_id ?? "unassigned";
      const evals = evaluations.filter((e) => e.applicant_id === applicant.id);
      // Average = Total Score / Number of Assigned Evaluators (not just those who
      // have submitted so far), so an applicant's score reflects outstanding grades too.
      // Falls back to the number of submitted evaluations if nobody has been assigned yet.
      const assignedCount = assignedCounts.get(applicant.id) ?? 0;
      const divisor = assignedCount > 0 ? assignedCount : evals.length;
      const totalScore = evals.reduce((sum, e) => sum + weightedScore(e), 0);
      const avgScore = divisor > 0 ? totalScore / divisor : 0;

      const recCounts = new Map<Recommendation, number>();
      evals.forEach((e) => recCounts.set(e.recommendation, (recCounts.get(e.recommendation) ?? 0) + 1));
      let topRecommendation: Recommendation | null = null;
      let max = 0;
      recCounts.forEach((count, rec) => {
        if (count > max) {
          max = count;
          topRecommendation = rec;
        }
      });

      const entry: RankedApplicant = {
        applicant,
        avgScore,
        evaluationCount: evals.length,
        assignedCount,
        topRecommendation,
      };
      const arr = groups.get(posId) ?? [];
      arr.push(entry);
      groups.set(posId, arr);
    }
    groups.forEach((arr) => arr.sort((a, b) => b.avgScore - a.avgScore));
    return groups;
  }, [applicants, evaluations, assignedCounts]);

  const positionsToShow = activePosition === "All" ? positions : positions.filter((p) => p.id === activePosition);

  const chartData = useMemo(
    () =>
      positions.map((p) => {
        const list = byPosition.get(p.id) ?? [];
        const top = list[0];
        return {
          name: p.name.length > 14 ? p.name.slice(0, 14) + "…" : p.name,
          score: top ? Number(top.avgScore.toFixed(1)) : 0,
        };
      }),
    [positions, byPosition]
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <p className="eyebrow">Panel Results</p>
      <h1 className="mt-1 font-display text-3xl font-bold text-nu-900">Summary &amp; Ranking</h1>
      <p className="mt-1 text-sm text-ink/50">
        Averaged weighted scores across all submitted panelist evaluations, ranked within each position.
      </p>

      {!loading && positions.length > 0 && (
        <div className="mt-8 card p-5">
          <p className="label mb-3">Top Score by Position</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7EEF9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#0F1B2D99" }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#0F1B2D99" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #E7EEF9", fontSize: 12 }}
                  formatter={(v) => [`${v}`, "Weighted score"]}
                />
                <Bar dataKey="score" fill="#0A2050" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => setActivePosition("All")}
          className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
            activePosition === "All" ? "border-nu-900 bg-nu-900 text-white" : "border-nu-100 bg-white text-nu-700 hover:border-nu-500"
          }`}
        >
          All Positions
        </button>
        {positions.map((p) => (
          <button
            key={p.id}
            onClick={() => setActivePosition(p.id)}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              activePosition === p.id ? "border-nu-900 bg-nu-900 text-white" : "border-nu-100 bg-white text-nu-700 hover:border-nu-500"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-10 text-center text-sm text-ink/40">Calculating rankings…</div>
      ) : (
        <div className="mt-8 space-y-8">
          {positionsToShow.map((p) => {
            const ranked = byPosition.get(p.id) ?? [];
            if (ranked.length === 0) return null;
            return (
              <div key={p.id}>
                <div className="flex items-baseline justify-between">
                  <h2 className="font-display text-lg font-bold text-nu-900">{p.name}</h2>
                  <span className="text-xs font-medium text-ink/40">
                    {ranked.length} candidate{ranked.length === 1 ? "" : "s"}
                    {p.max_slots ? ` · ${p.max_slots} slot${p.max_slots === 1 ? "" : "s"}` : ""}
                  </span>
                </div>
                <div className="mt-3 overflow-hidden rounded-2xl border border-nu-100 bg-white shadow-card">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-nu-100 bg-nu-50 text-xs font-bold uppercase tracking-wider text-nu-700">
                        <th className="px-5 py-3 w-14">Rank</th>
                        <th className="px-5 py-3">Applicant</th>
                        <th className="px-5 py-3">Panel Recommendation</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Evaluators</th>
                        <th className="px-5 py-3 text-right">Weighted Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-nu-50">
                      {ranked.map((r, idx) => {
                        const withinSlots = p.max_slots ? idx < p.max_slots : idx === 0;
                        const Icon = RANK_ICONS[idx];
                        return (
                          <tr key={r.applicant.id} className={withinSlots ? "bg-gold-100/30" : ""}>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-1.5">
                                {Icon ? <Icon size={16} className="text-gold-600" /> : null}
                                <span className="font-mono font-bold text-nu-900">{idx + 1}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <Link to={`/evaluate/${r.applicant.id}`} className="font-semibold text-nu-900 hover:text-gold-700">
                                {r.applicant.full_name}
                              </Link>
                              {r.applicant.position_assigned_id !== r.applicant.position_applied_id && (
                                <p className="text-xs text-ink/40">Applied: {r.applicant.position_applied?.name}</p>
                              )}
                            </td>
                            <td className="px-5 py-4 text-ink/60">{r.topRecommendation ?? "Not yet scored"}</td>
                            <td className="px-5 py-4">
                              <StatusBadge status={r.applicant.status} />
                            </td>
                            <td className="px-5 py-4 text-right text-ink/60">
                              {r.evaluationCount}/{r.assignedCount || r.evaluationCount}
                            </td>
                            <td className="px-5 py-4 text-right">
                              <span className="font-mono text-lg font-extrabold text-nu-900">
                                {r.evaluationCount > 0 ? r.avgScore.toFixed(1) : "—"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
