"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { services } from "@/lib/site-content";

const recipient = "ocscolabs@gmail.com";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "ready">("idle");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const service = data.get("service")?.toString() || "General conversation";
    const subject = `OCSCO inquiry / ${service}`;
    const body = [
      `Name: ${data.get("name")}`,
      `Email: ${data.get("email")}`,
      `Company: ${data.get("company") || "Not provided"}`,
      `Capability: ${service}`,
      "",
      "Project details:",
      data.get("message"),
    ].join("\\n");

    setStatus("ready");
    window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
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
        <textarea className="form-input form-textarea" id="contact-message" name="message" placeholder="What are you trying to make clearer, stronger, or more effective?" required />
      </div>
      <div className="form-actions">
        <button className="button button-dark" type="submit">Start a conversation <span aria-hidden="true">↗</span></button>
        <p className="form-note">This staged form prepares an email to {recipient}. No information is stored by the site yet.</p>
        <p className="form-status" role="status" aria-live="polite">{status === "ready" ? "Your email app should open with the inquiry prepared. If it does not, email us directly." : ""}</p>
      </div>
    </form>
  );
}
