import { useState } from "react";
import { createPanelAccount } from "../lib/api";
import type { EvaluatorProfile } from "../types";
import { X, UserPlus, Eye, EyeOff } from "lucide-react";

interface CreatePanelAccountModalProps {
  onClose: () => void;
  onCreated: (evaluator: EvaluatorProfile) => void;
}

export default function CreatePanelAccountModal({ onClose, onCreated }: CreatePanelAccountModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usernameValid = username.trim().length > 0;
  const passwordValid = password.length >= 6;
  const nameValid = fullName.trim().length > 0;
  const canSubmit = usernameValid && passwordValid && nameValid && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const evaluator = await createPanelAccount({ username, password, fullName });
      onCreated(evaluator);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create panel account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-nu-950/50 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-md p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="eyebrow">New Panel Account</p>
            <h3 className="mt-1 font-display text-lg font-bold text-nu-900">Add an evaluator</h3>
            <p className="mt-1 text-xs text-ink/50">
              They'll sign in with this username and password on the Panel Sign In screen.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink/40 hover:bg-nu-50 hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink/50">
              Username
            </label>
            <input
              className="input"
              placeholder="e.g. Evaluator5"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink/50">
              Password
            </label>
            <div className="relative">
              <input
                className="input pr-10"
                type={showPassword ? "text" : "password"}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/30 hover:text-ink/60"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {password.length > 0 && !passwordValid && (
              <p className="mt-1 text-xs text-rose-600">Password must be at least 6 characters.</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink/50">Name</label>
            <input
              className="input"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="off"
            />
          </div>

          {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={!canSubmit} className="btn-primary">
              <UserPlus size={16} /> {saving ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
