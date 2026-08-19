"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { services } from "@/lib/site-content";

type FormStatus = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    if (!form.reportValidity()) return;

    setStatus("submitting");
    setStatusMessage("");
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
      });

      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "We could not receive your inquiry. Please try again.");
      form.reset();
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit} aria-busy={status === "submitting"}>
      <div className="contact-honeypot" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="form-field-grid">
        <div className="form-field">
          <label htmlFor="contact-name">Your name <span aria-hidden="true">*</span></label>
          <input className="form-input" id="contact-name" name="name" type="text" autoComplete="name" required />
        </div>
        <div className="form-field">
          <label htmlFor="contact-email">Work email <span aria-hidden="true">*</span></label>
          <input className="form-input" id="contact-email" name="email" type="email" autoComplete="email" required />
        </div>
      </div>
      <div className="form-field-grid">
        <div className="form-field">
          <label htmlFor="contact-company">Company</label>
          <input className="form-input" id="contact-company" name="company" type="text" autoComplete="organization" />
        </div>
        <div className="form-field">
          <label htmlFor="contact-service">What can we help with? <span aria-hidden="true">*</span></label>
          <select className="form-input form-select" id="contact-service" name="service" defaultValue="" required>
            <option value="" disabled>Select a capability</option>
            {services.map((service) => <option key={service.slug} value={service.name}>{service.cardName}</option>)}
            <option value="Something else">Something else</option>
          </select>
        </div>
      </div>
      <div className="form-field">
        <label htmlFor="contact-message">Project details <span aria-hidden="true">*</span></label>
        <textarea className="form-input form-textarea" id="contact-message" name="message" placeholder="What are you trying to make clearer, stronger, or more effective?" minLength={20} aria-describedby="contact-message-hint" required />
        <p className="form-note" id="contact-message-hint">Please include at least 20 characters.</p>
      </div>
      <div className="form-actions">
        <button className="button button-dark" type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? "Sending..." : "Start a conversation"} <span aria-hidden="true">↗</span>
        </button>
        <p className="form-note">Your inquiry is sent securely to the OCSCO inquiry database. No email app is required.</p>
        <p className="form-status" role="status" aria-live="polite">
          {status === "success" ? "Thanks — your inquiry has been received. We will be in touch." : ""}
          {status === "error" ? statusMessage : ""}
        </p>
      </div>
    </form>
  );
}
