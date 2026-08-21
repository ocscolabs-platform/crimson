"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import AdminToast from "@/app/admin/AdminToast";

export default function AdminInvitePage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasInviteSession, setHasInviteSession] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    const { data: authListener } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (!isMounted) return;

      setHasInviteSession(Boolean(session));
      setIsCheckingSession(false);
    });

    async function establishInviteSession() {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!isMounted) return;

      setHasInviteSession(Boolean(data.session));
      setIsCheckingSession(false);
      if (!data.session) {
        setError(sessionError?.message || "This invitation link is invalid or has expired. Request a new invitation.");
      }
    }

    establishInviteSession();

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
      setError(caughtError instanceof Error ? caughtError.message : "Unable to accept the invitation.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="admin-page admin-login-page">
      <div className="admin-login-card">
        <p className="admin-kicker">OCSCO / CMS</p>
        <h1>Accept your invitation.</h1>
        <p className="admin-intro">Create a password to activate your CMS account.</p>
        <form className="admin-form" onSubmit={handleSubmit}>
          <label>
            New password
            <input className="admin-input" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <label>
            Confirm password
            <input className="admin-input" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
          </label>
          {isCheckingSession ? <p className="admin-intro" role="status">Verifying your invitation…</p> : null}
          {error ? <p className="admin-error" role="alert">{error}</p> : null}
          {error ? <AdminToast tone="error" message={`Invitation could not be accepted: ${error}`} /> : null}
          <button className="button button-primary admin-submit" type="submit" disabled={isSubmitting || isCheckingSession || !hasInviteSession}>
            {isSubmitting ? <><span className="admin-button-spinner" aria-hidden="true" /> Activating…</> : <>Create password <span aria-hidden="true">↗</span></>}
          </button>
        </form>
        <Link className="admin-back-link" href="/crimson-admin-control/login">Back to sign in</Link>
      </div>
    </main>
  );
}
