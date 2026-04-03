"use client";
import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { api } from "../lib/api-client";
import { MOCK_DB } from "../mocks/mock-db";
import { CONFIG } from "../lib/config";
import { T } from "../lib/theme";
import type { Member } from "../lib/types";

interface AuthContextValue {
  user: Member;
  logout: () => void;
  demoLogin: (memberId: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginSent, setLoginSent] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    if (CONFIG.USE_MOCKS) {
      MOCK_DB.user = MOCK_DB.members[0];
      setUser(MOCK_DB.members[0]);
      setLoading(false);
    } else {
      // Production: check Supabase session on mount
      // const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
      // sb.auth.getSession().then(({ data: { session } }) => {
      //   if (session) {
      //     api.setToken(session.access_token);
      //     api.getMe().then(setUser).finally(() => setLoading(false));
      //   } else setLoading(false);
      // });
      setLoading(false);
    }
  }, []);

  const sendMagicLink = async (email: string) => {
    setLoginError("");
    try {
      if (CONFIG.USE_MOCKS) {
        const member = MOCK_DB.members.find((m) => m.email === email);
        if (!member) {
          setLoginError("No account found for this email");
          return;
        }
        setLoginSent(true);
      } else {
        // Production: await supabase.auth.signInWithOtp({ email });
        setLoginSent(true);
      }
    } catch (e) {
      setLoginError((e as Error).message);
    }
  };

  const demoLogin = (memberId: string) => {
    const m = MOCK_DB.members.find((x) => x.id === memberId);
    if (m) {
      MOCK_DB.user = m;
      setUser(m);
    }
  };

  const logout = () => {
    setUser(null);
    MOCK_DB.user = null;
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
                placeholder="you@chapter.org"
                style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1px solid ${T.bd}`, background: T.bg, color: T.tx, fontSize: 14, marginBottom: 12, boxSizing: "border-box" }}
              />
              {loginError && <div style={{ color: T.err, fontSize: 12, marginBottom: 8 }}>{loginError}</div>}
              <button
                onClick={() => sendMagicLink(loginEmail)}
                style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: T.ac, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 16 }}
              >
                Send Magic Link
              </button>
              <div style={{ borderTop: `1px solid ${T.bd}`, paddingTop: 16 }}>
                <p style={{ color: T.txm, fontSize: 11, textAlign: "center", marginBottom: 10 }}>DEMO — Quick login as:</p>
                <div style={{ display: "grid", gap: 6 }}>
                  {MOCK_DB.members.slice(0, 4).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => demoLogin(m.id)}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${T.bd}`, background: T.bg, color: T.tx, fontSize: 12, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between" }}
                    >
                      <span>{m.name}</span>
                      <span style={{ color: m.role === "officer" ? T.acl : T.txm, fontSize: 11 }}>{m.role}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📧</div>
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

  return <AuthContext.Provider value={{ user, logout, demoLogin }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
