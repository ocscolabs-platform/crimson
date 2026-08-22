"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createInviteClient } from "@/lib/supabase/invite-client";
import AdminToast from "@/app/admin/AdminToast";

const INVITE_ERROR = "This invitation link is invalid or has expired. Request a new invitation.";

function clearInviteHash() {
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

function getInviteTokens() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const type = params.get("type");

  if (!accessToken || !refreshToken || type !== "invite") return null;

  return { accessToken, refreshToken };
}

export default function AdminInvitePage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasInviteSession, setHasInviteSession] = useState(false);

  useEffect(() => {
    const supabase = createInviteClient();
    let isMounted = true;

    const { data: authListener } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (!isMounted) return;

      setHasInviteSession(Boolean(session));
      setIsCheckingSession(false);
    });

    async function establishInviteSession() {
      try {
        const tokens = getInviteTokens();
        if (tokens) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
          });

          if (sessionError) throw sessionError;
          clearInviteHash();
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (!isMounted) return;

        setHasInviteSession(Boolean(data.session));
        setIsCheckingSession(false);
        if (!data.session) setError(sessionError?.message || INVITE_ERROR);
      } catch (caughtError) {
        if (!isMounted) return;

        clearInviteHash();
        setHasInviteSession(false);
        setIsCheckingSession(false);
        setError(caughtError instanceof Error ? caughtError.message : INVITE_ERROR);
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
      const supabase = createInviteClient();
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
