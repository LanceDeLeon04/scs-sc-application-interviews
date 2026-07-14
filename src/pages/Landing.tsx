import { Link } from "react-router-dom";
import Seal from "../components/Seal";
import { CRITERIA, RECOMMENDATIONS } from "../types";
import { ArrowRight, ClipboardList, Users, BarChart3 } from "lucide-react";

export default function Landing() {
  return (
    <div className="bg-paper">
      {/* Hero */}
      <section className="relative overflow-hidden bg-nu-950">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #D4AF37 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="pointer-events-none absolute -right-40 -top-40 h-96 w-96 rounded-full bg-nu-700/40 blur-3xl" />
        <div className="pointer-events-none absolute -left-32 bottom-0 h-72 w-72 rounded-full bg-gold-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-28">
          <div className="flex items-center gap-3">
            <Seal className="h-12 w-12" />
            <div className="gold-rule w-16" />
            <p className="eyebrow text-gold-400">School of Computer Studies · Student Council</p>
          </div>

          <h1 className="mt-8 max-w-3xl font-display text-4xl font-bold leading-[1.1] text-white sm:text-6xl">
            Officer Applicant
            <span className="block text-gold-400">Evaluation System</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-nu-100/80">
            A single, standardized panel scoresheet for selecting SCS Student Council
            Officers, A.Y. 2026–2027 — from interview to ranked results, weighted
            exactly to the criteria the panel agreed on.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link to="/login" className="btn-gold">
              Enter Panel Portal <ArrowRight size={16} />
            </Link>
            <a href="#criteria" className="btn-ghost !border-white/20 !bg-transparent !text-white hover:!bg-white/10">
              View Evaluation Criteria
            </a>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { icon: Users, label: "Applicants", desc: "Track every candidate by position and status" },
              { icon: ClipboardList, label: "Evaluation Sheet", desc: "Score against six weighted criteria" },
              { icon: BarChart3, label: "Summary & Ranking", desc: "Automatic per-position leaderboards" },
            ].map((f) => (
              <div key={f.label} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <f.icon className="h-6 w-6 text-gold-400" />
                <p className="mt-3 font-display text-sm font-bold text-white">{f.label}</p>
                <p className="mt-1 text-sm text-nu-100/60">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Criteria */}
      <section id="criteria" className="mx-auto max-w-7xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="eyebrow">Interview Evaluation Criteria</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-nu-900">
            Six weighted criteria. One standard, applied to every applicant.
          </h2>
          <p className="mt-4 text-ink/60">
            Every panelist scores each applicant on a 1–5 scale per criterion below.
            The system computes the weighted total automatically, so rankings stay
            consistent across interviewers and positions.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-nu-100 bg-white shadow-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-nu-100 bg-nu-50">
                <th className="px-5 py-3 font-display text-xs font-bold uppercase tracking-wider text-nu-700">
                  Criteria
                </th>
                <th className="px-5 py-3 font-display text-xs font-bold uppercase tracking-wider text-nu-700">
                  Description
                </th>
                <th className="px-5 py-3 text-right font-display text-xs font-bold uppercase tracking-wider text-nu-700">
                  Weight
                </th>
              </tr>
            </thead>
            <tbody>
              {CRITERIA.map((c, i) => (
                <tr key={c.key} className={i % 2 ? "bg-nu-50/40" : ""}>
                  <td className="px-5 py-4 font-semibold text-nu-900">{c.label}</td>
                  <td className="px-5 py-4 text-ink/60">{c.description}</td>
                  <td className="px-5 py-4 text-right font-mono font-bold text-gold-700">
                    {Math.round(c.weight * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-nu-100 bg-nu-900">
                <td colSpan={2} className="px-5 py-3 font-display text-sm font-bold text-white">
                  Total
                </td>
                <td className="px-5 py-3 text-right font-mono font-bold text-gold-400">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Rating Scale</p>
            <h3 className="mt-2 font-display text-xl font-bold text-nu-900">
              Consistent 1–5 scoring
            </h3>
            <div className="mt-5 space-y-2">
              {[5, 4, 3, 2, 1].map((v) => (
                <div key={v} className="flex items-center gap-3 rounded-xl border border-nu-100 bg-white px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nu-900 font-mono text-sm font-bold text-gold-400">
                    {v}
                  </span>
                  <p className="text-sm font-medium text-ink/80">
                    {
                      ["", "Poor", "Needs Improvement", "Satisfactory", "Very Good", "Outstanding"][v]
                    }
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="eyebrow">Overall Recommendation</p>
            <h3 className="mt-2 font-display text-xl font-bold text-nu-900">
              Every interview closes with a call
            </h3>
            <div className="mt-5 space-y-2">
              {RECOMMENDATIONS.map((r) => (
                <div key={r} className="flex items-center gap-3 rounded-xl border border-nu-100 bg-white px-4 py-3">
                  <span className="h-4 w-4 shrink-0 rounded border-2 border-gold-500" />
                  <p className="text-sm font-medium text-ink/80">{r}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-nu-100 bg-nu-900">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-6 py-16 text-center">
          <Seal className="h-10 w-10" />
          <h2 className="max-w-lg font-display text-2xl font-bold text-white">
            Ready to evaluate this year's applicants?
          </h2>
          <Link to="/login" className="btn-gold">
            Sign in to the panel portal <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
