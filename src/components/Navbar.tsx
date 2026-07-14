import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Seal from "./Seal";
import { LogOut } from "lucide-react";

const links = [
  { to: "/applicants", label: "Applicants" },
  { to: "/summary", label: "Summary & Ranking" },
];

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-nu-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <NavLink to={user ? "/applicants" : "/"} className="flex items-center gap-3">
          <Seal className="h-8 w-8" />
          <div className="leading-tight">
            <p className="font-display text-sm font-bold text-nu-900">SCS Officer Evaluation</p>
            <p className="text-[11px] font-medium uppercase tracking-wider text-gold-600">A.Y. 2026–2027</p>
          </div>
        </NavLink>

        {user && (
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    isActive ? "bg-nu-900 text-white" : "text-nu-900 hover:bg-nu-50"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        )}

        {user ? (
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-ink">{profile?.full_name ?? user.email}</p>
              <p className="text-xs text-ink/50">{profile?.role === "commissioner" ? "Commissioner" : "Evaluator"}</p>
            </div>
            <button onClick={handleSignOut} className="btn-ghost !px-3 !py-2" title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <NavLink to="/login" className="btn-primary">
            Panel Sign In
          </NavLink>
        )}
      </div>
      {user && (
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-nu-50 px-4 py-1.5 md:hidden">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  isActive ? "bg-nu-900 text-white" : "text-nu-900"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
