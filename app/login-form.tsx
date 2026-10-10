"use client";

import { ArrowRight, Eye, EyeOff, Factory, LockKeyhole, Mail, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json() as { error?: string; destination?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not sign in");
      window.location.assign(result.destination ?? "/supervisor");
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Could not sign in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="company-login-page">
      <section className="company-login-card">
        <div className="company-login-brand"><span>VC</span><div><strong>Vibes Components</strong><small>Factory operations platform</small></div></div>
        <div className="company-login-icon"><Factory size={27} /></div>
        <p className="eyebrow">Supervisor workspace</p>
        <h1>Sign in to your dashboard</h1>
        <p>Use your company email and password. This sign-in is managed directly by your company dashboard.</p>
        <form onSubmit={signIn}>
          <label className="login-field"><span>Company email</span><div><Mail size={19} /><input autoComplete="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="supervisor@vibescomponents.com" /></div></label>
          <label className="login-field"><span>Password</span><div><LockKeyhole size={19} /><input autoComplete="current-password" required type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></label>
          {error ? <div className="login-error">{error}</div> : null}
          <button className="company-login-submit" disabled={submitting}>{submitting ? <RefreshCw className="spin" size={19} /> : <ArrowRight size={19} />}{submitting ? "Signing in…" : "Open supervisor dashboard"}</button>
        </form>
        <Link href="/">← Choose a different workspace</Link>
      </section>
    </main>
  );
}
