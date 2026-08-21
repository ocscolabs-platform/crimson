"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AdminToast from "@/app/admin/AdminToast";

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSent(false);
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/crimson-admin-control/auth/callback?next=/crimson-admin-control/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSent(true);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to send the reset email.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="admin-page admin-login-page">
      <div className="admin-login-card">
        <p className="admin-kicker">OCSCO / CMS</p>
        <h1>Reset your password.</h1>
        <p className="admin-intro">Enter your CMS email and we will send a secure password reset link.</p>
        <form className="admin-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input className="admin-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          {error ? <p className="admin-error" role="alert">{error}</p> : null}
          {error ? <AdminToast tone="error" message={`Reset failed: ${error}`} /> : null}
          {sent ? (
            <>
              <p className="admin-success" role="status">If that account exists, a reset link has been sent.</p>
              <AdminToast tone="success" message="Password reset email sent. Check your inbox." />
            </>
          ) : null}
          <button className="button button-primary admin-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? <><span className="admin-button-spinner" aria-hidden="true" /> Sending…</> : <>Send reset link <span aria-hidden="true">↗</span></>}
          </button>
        </form>
        <Link className="admin-back-link" href="/crimson-admin-control/login">Back to sign in</Link>
      </div>
    </main>
  );
}
