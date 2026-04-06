"use client";
import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { api } from "../lib/api-client";
import { T } from "../lib/theme";
import type { Member } from "../lib/types";
import { createClient } from "@/utils/supabase/client";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/utils/supabase/env";

interface AuthContextValue {
  user: Member;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginSent, setLoginSent] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initSession() {
      if (typeof window === "undefined") {
        setLoading(false);
        return;
      }

      const pageUrl = new URL(window.location.href);

      // Implicit grant: tokens in hash (avoid letting PKCE client choke on hash before we read it)
      if (window.location.hash) {
        const params = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = params.get("access_token");
        if (accessToken) {
          api.setToken(accessToken);
          window.history.replaceState(null, "", pageUrl.pathname + pageUrl.search);
        }
      }

      const supabaseConfigured = Boolean(getSupabaseUrl() && getSupabaseAnonKey());
      if (supabaseConfigured) {
        try {
          const supabase = createClient();
          const code = pageUrl.searchParams.get("code");
          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error && !cancelled) {
              setLoginError(error.message);
            }
            pageUrl.searchParams.delete("code");
            window.history.replaceState(null, "", pageUrl.pathname + pageUrl.search);
          }
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!cancelled && session?.access_token) {
            api.setToken(session.access_token);
          }
        } catch {
          // Misconfigured public env; fall through to any legacy api token only.
        }
      }

      const token = api.getToken();
      if (token) {
        try {
          const me = await api.getMe();
          if (!cancelled) setUser(me);
        } catch {
          if (!cancelled) {
            api.setToken(null);
            setLoginError(
              "Signed in with Supabase, but the API rejected your session. Link members.auth_id to your user (migrations/0002_link_members_auth_id.sql) or confirm you are an active member.",
            );
          }
        }
      }
      if (!cancelled) setLoading(false);
    }

    void initSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async (email: string) => {
    setLoginError("");
    setLoginLoading(true);
    try {
      const res = await api.login(email);
      if (res.access_token) {
        // Local dev (DATABASE_URL): JWT returned directly
        api.setToken(res.access_token);
        const me = await api.getMe();
        setUser(me);
      } else if (res.ok === true) {
        // Supabase production: OTP must run in this browser so PKCE verifier exists
        if (!getSupabaseUrl() || !getSupabaseAnonKey()) {
          setLoginError(
            "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY (or publishable key).",
          );
          return;
        }
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            emailRedirectTo: window.location.origin,
            shouldCreateUser: true,
          },
        });
        if (error) {
          setLoginError(error.message);
          return;
        }
        setLoginSent(true);
      } else {
        // Member not found (opaque UX)
        setLoginSent(true);
      }
    } catch (e) {
      setLoginError((e as Error).message);
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (typeof window !== "undefined" && getSupabaseUrl() && getSupabaseAnonKey()) {
        const supabase = createClient();
        await supabase.auth.signOut();
      }
    } catch {
      /* ignore */
    }
    setUser(null);
    api.setToken(null);
    setLoginSent(false);
  };

  if (loading)
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: T.bg, color: T.txm }}>
        Loading...
      </div>
    );

  if (!user) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif", padding: 20 }}>
        <div style={{ background: T.sf, borderRadius: 16, padding: 32, maxWidth: 380, width: "100%", border: `1px solid ${T.bd}` }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: T.tx }}>
              <span style={{ color: T.ac }}>Fraternity</span>OS
            </div>
            <p style={{ color: T.txm, fontSize: 13, marginTop: 4 }}>Sign in with your chapter email</p>
          </div>
          {!loginSent ? (
            <>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && loginEmail) handleLogin(loginEmail); }}
                placeholder="you@chapter.org"
                style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1px solid ${T.bd}`, background: T.bg, color: T.tx, fontSize: 14, marginBottom: 12, boxSizing: "border-box" }}
              />
              {loginError && <div style={{ color: T.err, fontSize: 12, marginBottom: 8 }}>{loginError}</div>}
              <button
                onClick={() => handleLogin(loginEmail)}
                disabled={loginLoading || !loginEmail}
                style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: T.ac, color: "#fff", fontSize: 14, fontWeight: 600, cursor: loginLoading ? "wait" : "pointer", opacity: loginLoading ? 0.6 : 1 }}
              >
                {loginLoading ? "Signing in..." : "Sign In"}
              </button>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: 20 }}>
              <p style={{ color: T.tx, fontWeight: 600, marginBottom: 4 }}>Check your email</p>
              <p style={{ color: T.txm, fontSize: 13 }}>
                We sent a magic link to <strong style={{ color: T.acl }}>{loginEmail}</strong>
              </p>
              <button
                onClick={() => setLoginSent(false)}
                style={{ marginTop: 16, background: "none", border: "none", color: T.ac, cursor: "pointer", fontSize: 13 }}
              >
                Use a different email
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={{ user, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
