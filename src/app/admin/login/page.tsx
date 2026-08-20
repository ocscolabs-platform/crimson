"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AdminToast from "@/app/admin/AdminToast";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="admin-page admin-login-page">
      <div className="admin-login-card">
        <p className="admin-kicker">OCSCO / CMS</p>
        <h1>Sign in to manage content.</h1>
        <p className="admin-intro">
          Content editing is available to approved CMS members according to their role. Publishing and broader controls remain restricted.
        </p>
        <form className="admin-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input className="admin-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Password
            <input className="admin-input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <Link className="admin-forgot-link" href="/admin/forgot-password">Forgot password?</Link>
          {error ? <p className="admin-error" role="alert">{error}</p> : null}
          {error ? <AdminToast tone="error" message={`Sign-in failed: ${error}`} /> : null}
          <button className="button button-primary admin-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="admin-button-spinner" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              <>
                Sign in <span aria-hidden="true">↗</span>
              </>
            )}
          </button>
        </form>
        <Link className="admin-back-link" href="/">Return to OCSCO ↗</Link>
      </div>
    </main>
  );
}
