import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { services } from "@/lib/site-content";

const allowedCapabilities = new Set([...services.map((service) => service.name), "Something else"]);

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type InquiryPayload = {
  name?: unknown;
  email?: unknown;
  company?: unknown;
  service?: unknown;
  message?: unknown;
  website?: unknown;
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const submissionsEnabled = process.env.INQUIRY_SUBMISSIONS_ENABLED === "true"
    || process.env.VERCEL_ENV === "production";

  if (!submissionsEnabled) {
    return NextResponse.json({ error: "Inquiry submissions are disabled in this environment." }, { status: 503 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  const notificationEmail = process.env.INQUIRY_NOTIFICATION_EMAIL;
  const notificationFrom = process.env.INQUIRY_NOTIFICATION_FROM;

  if (!supabaseUrl || !supabaseSecretKey) {
    console.error("Supabase inquiry configuration is missing.");
    return NextResponse.json({ error: "The inquiry service is not configured." }, { status: 503 });
  }

  let payload: InquiryPayload;
  try {
    payload = await request.json() as InquiryPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (stringValue(payload.website)) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const name = stringValue(payload.name);
  const email = stringValue(payload.email).toLowerCase();
  const company = stringValue(payload.company);
  const capability = stringValue(payload.service);
  const message = stringValue(payload.message);
  const isValid =
    name.length >= 2 && name.length <= 120 &&
    emailPattern.test(email) && email.length <= 254 &&
    company.length <= 160 &&
    allowedCapabilities.has(capability) &&
    message.length >= 20 && message.length <= 4000;

  if (!isValid) {
    return NextResponse.json({ error: "Please check the form fields and try again." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await supabase.from("inquiries").insert({
    name,
    email,
    company: company || null,
    capability,
    message,
    source: "website",
  });

  if (error) {
    console.error("Supabase inquiry insert failed.", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return NextResponse.json({ error: "We could not receive your inquiry. Please try again." }, { status: 500 });
  }

  if (!resendApiKey || !notificationEmail || !notificationFrom) {
    console.error("Inquiry notification configuration is missing.");
    return NextResponse.json({ error: "Your inquiry was saved, but email notification is not configured yet." }, { status: 503 });
  }

  const notificationText = [
    "New OCSCO inquiry",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Company: ${company || "Not provided"}`,
    `Capability: ${capability}`,
    "",
    "Project details:",
    message,
  ].join("\n");

  let resendResponse: Response;
  try {
    resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: notificationFrom,
        to: [notificationEmail],
        reply_to: email,
        subject: `New OCSCO inquiry / ${capability}`,
        text: notificationText,
      }),
    });
  } catch (notificationError) {
    console.error("Inquiry notification request failed.", notificationError);
    return NextResponse.json({ error: "Your inquiry was saved, but the email notification could not be sent." }, { status: 502 });
  }

  if (!resendResponse.ok) {
    const resendError = await resendResponse.json().catch(() => null) as { message?: string } | null;
    console.error("Inquiry notification failed.", {
      status: resendResponse.status,
      message: resendError?.message,
    });
    return NextResponse.json({ error: "Your inquiry was saved, but the email notification could not be sent." }, { status: 502 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
