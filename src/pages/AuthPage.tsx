import { useState } from "react";
import { useAuth } from "../lib/auth";

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f2f4f7",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
          padding: 32,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 32' fill='none'%3E%3Crect width='40' height='32' rx='6' fill='%231b6ac9'/%3E%3Ctext x='20' y='21' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='14' font-weight='700' fill='white'%3EFDB%3C/text%3E%3C/svg%3E"
            alt="FDB"
            style={{ height: 40, marginBottom: 12 }}
          />
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: "#0972d3" }}>
            F-Droid Repo Builder
          </h1>
          <p style={{ fontSize: 14, color: "#5f6b7a", marginTop: 4 }}>
            {mode === "signin" ? "Sign in to manage your repositories" : "Create an account to get started"}
          </p>
        </div>

        {error && (
          <div
            style={{
              background: "#fff2f0",
              border: "1px solid #ffafa3",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 16,
              fontSize: 14,
              color: "#a3170f",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="email"
              style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 4, color: "#0f1b2a" }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #aab7b8",
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label
              htmlFor="password"
              style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 4, color: "#0f1b2a" }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #aab7b8",
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              background: "#0972d3",
              color: "#fff",
              fontSize: 14,
              fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Please wait..." : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 14 }}>
          {mode === "signin" ? (
            <>
              Don't have an account?{" "}
              <button
                onClick={() => { setMode("signup"); setError(null); }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#0972d3",
                  cursor: "pointer",
                  fontSize: 14,
                  padding: 0,
                }}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => { setMode("signin"); setError(null); }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#0972d3",
                  cursor: "pointer",
                  fontSize: 14,
                  padding: 0,
                }}
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
