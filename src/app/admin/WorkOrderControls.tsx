"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

type WorkOrderControlsProps = {
  canMoveUp: boolean;
  canMoveDown: boolean;
};

export default function WorkOrderControls({ canMoveUp, canMoveDown }: WorkOrderControlsProps) {
  const { pending } = useFormStatus();
  const [intent, setIntent] = useState<"up" | "down" | null>(null);

  return (
    <div className="admin-work-order-controls" aria-label="Manual Work order controls">
      <button
        className="button admin-button-secondary admin-order-button"
        type="submit"
        name="direction"
        value="up"
        disabled={pending || !canMoveUp}
        onClick={() => setIntent("up")}
      >
        {pending && intent === "up" ? <span className="admin-button-spinner" aria-hidden="true" /> : null}
        {pending && intent === "up" ? "Moving up…" : "Move up"}
      </button>
      <button
        className="button admin-button-secondary admin-order-button"
        type="submit"
        name="direction"
        value="down"
        disabled={pending || !canMoveDown}
        onClick={() => setIntent("down")}
      >
        {pending && intent === "down" ? <span className="admin-button-spinner" aria-hidden="true" /> : null}
        {pending && intent === "down" ? "Moving down…" : "Move down"}
      </button>
    </div>
  );
}
