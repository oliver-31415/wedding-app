"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

const COLLAPSE_AFTER = 5;

export function TextAnswerList({
  answers,
}: {
  answers: { who: string; value: string }[];
}) {
  const [expanded, setExpanded] = useState(false);

  if (answers.length === 0) {
    return <p className="text-sm text-ink-muted">No answers yet.</p>;
  }

  const visible = expanded ? answers : answers.slice(0, COLLAPSE_AFTER);
  const remaining = answers.length - COLLAPSE_AFTER;

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-line">
        {visible.map((item, idx) => (
          <li key={`${item.who}-${idx}`} className="py-2.5 first:pt-0 last:pb-0">
            <p className="text-sm text-ink whitespace-pre-wrap">{item.value}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{item.who}</p>
          </li>
        ))}
      </ul>
      {remaining > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((prev) => !prev)}
          className="-ml-3"
        >
          {expanded ? "Show fewer" : `Show all (${answers.length})`}
        </Button>
      )}
    </div>
  );
}
