import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  role: "commissioner" | "evaluator";
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
}

// Supabase Auth requires an email, but this app authenticates panelists by
// username. Usernames are mapped to a synthetic, never-shown email so the
// person only ever sees/types their username.
function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}@scs.local`;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      if (!session?.user) {
        setProfile(null);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, role")
        .eq("id", session.user.id)
        .maybeSingle();
      if (active) {
        if (!error && data) {
          setProfile(data as Profile);
        } else {
          setProfile({
            id: session.user.id,
            username: null,
            full_name: session.user.email ?? null,
            role: "evaluator",
          });
        }
      }
    }
    loadProfile();
    return () => {
      active = false;
    };
  }, [session]);

  async function signIn(username: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    return { error: error ? "Incorrect username or password." : null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signIn,
    signOut,
    isAdmin: profile?.role === "commissioner",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
