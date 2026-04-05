"use client";
import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { api } from "../lib/api-client";
import { T } from "../lib/theme";
import type { Member } from "../lib/types";

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
    // Check URL hash for Supabase magic link redirect tokens
    if (typeof window !== "undefined" && window.location.hash) {
      const params = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = params.get("access_token");
      if (accessToken) {
        api.setToken(accessToken);
        window.history.replaceState(null, "", window.location.pathname);
      }
    }

    // Try to load session from stored token
    const token = api.getToken();
    if (token) {
      api.getMe()
        .then(setUser)
        .catch(() => {
          api.setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = async (email: string) => {
    setLoginError("");
    setLoginLoading(true);
    try {
      const res = await api.login(email);
      if (res.access_token) {
        // Local dev mode: got token directly
        api.setToken(res.access_token);
        const me = await api.getMe();
        setUser(me);
      } else {
        // Production: magic link sent
        setLoginSent(true);
      }
    } catch (e) {
      setLoginError((e as Error).message);
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = () => {
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
