"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AdminToast from "@/app/admin/AdminToast";

export default function AdminResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;
    const queryError = new URLSearchParams(window.location.search).get("error");

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === "PASSWORD_RECOVERY" || session) {
        setHasRecoverySession(true);
        setIsCheckingSession(false);
      }
    });

    async function establishRecoverySession() {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!isMounted) return;

      setHasRecoverySession(Boolean(data.session));
      setIsCheckingSession(false);
      if (!data.session) {
        setError(
          queryError ||
            sessionError?.message ||
            "Auth session missing. Request a new password reset link and open it in this browser.",
        );
      }
    }

    establishRecoverySession();

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }

    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      router.replace("/crimson-admin-control");
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update the password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="admin-page admin-login-page">
      <div className="admin-login-card">
        <p className="admin-kicker">OCSCO / CMS</p>
        <h1>Create a new password.</h1>
        <p className="admin-intro">Choose a new password for your CMS account.</p>
        <form className="admin-form" onSubmit={handleSubmit}>
          <label>
            New password
            <input className="admin-input" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <label>
            Confirm password
            <input className="admin-input" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
          </label>
          {isCheckingSession ? <p className="admin-intro" role="status">Verifying your password reset link…</p> : null}
          {error ? <p className="admin-error" role="alert">{error}</p> : null}
          {error ? <AdminToast tone="error" message={`Password update failed: ${error}`} /> : null}
          <button className="button button-primary admin-submit" type="submit" disabled={isSubmitting || isCheckingSession || !hasRecoverySession}>
            {isSubmitting ? <><span className="admin-button-spinner" aria-hidden="true" /> Updating…</> : <>Update password <span aria-hidden="true">↗</span></>}
          </button>
        </form>
        <Link className="admin-back-link" href="/crimson-admin-control/login">Back to sign in</Link>
      </div>
    </main>
  );
}
