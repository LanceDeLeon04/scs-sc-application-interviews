import type { ApplicantStatus } from "../types";

const STYLES: Record<ApplicantStatus, string> = {
  Pending: "bg-nu-50 text-nu-700 border-nu-100",
  Evaluated: "bg-blue-50 text-blue-700 border-blue-200",
  Qualified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Disqualified: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function StatusBadge({ status }: { status: ApplicantStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${STYLES[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
