"use client";

import { useEffect, useState } from "react";

function formatLocal(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Scheduled publication" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function LocalScheduleTime({ value }: { value: string }) {
  const [label, setLabel] = useState("Scheduled publication");

  useEffect(() => {
    const timer = window.setTimeout(() => setLabel(formatLocal(value)), 0);
    return () => window.clearTimeout(timer);
  }, [value]);

  return <time dateTime={value} suppressHydrationWarning>{label}</time>;
}
