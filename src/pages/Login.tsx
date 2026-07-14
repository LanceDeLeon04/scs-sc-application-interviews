import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Seal from "../components/Seal";
import { LogIn } from "lucide-react";

export default function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) {
    const from = (location.state as { from?: string })?.from ?? "/applicants";
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signIn(username, password);
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      navigate("/applicants");
    }
  }

  return (
    <div className="relative flex min-h-[calc(100vh-64px)] items-center justify-center overflow-hidden bg-nu-950 px-6 py-16">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, #D4AF37 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Seal className="h-12 w-12" />
          <p className="eyebrow mt-4 text-gold-400">Interview Panel Access</p>
          <h1 className="mt-2 font-display text-2xl font-bold text-white">Sign in to evaluate</h1>
          <p className="mt-2 text-sm text-nu-100/60">
            Use the credentials provided by the SCS Student Council secretariat.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-7">
          <div>
            <label className="label mb-1.5 block" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              required
              autoComplete="username"
              className="input"
              placeholder="e.g. Evaluator1"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="label mb-1.5 block" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            <LogIn size={16} />
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-nu-100/40">
          Panel accounts are provisioned in Supabase by the system administrator.
        </p>
      </div>
    </div>
  );
}
