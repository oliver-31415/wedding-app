"use client";

import { useState } from "react";
import { Button, Card, CardBody, CardHeader, EmptyState } from "@/components/ui";
import { formatTimestamp } from "./format";

export type OutboxItem = {
  id: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  createdAtMs: number;
};

export function OutboxViewer({
  emails,
  timeZone,
}: {
  emails: OutboxItem[];
  timeZone: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(emails[0]?.id ?? null);
  const [viewMode, setViewMode] = useState<"html" | "text">("html");

  if (emails.length === 0) {
    return (
      <EmptyState
        title="Outbox is empty"
        body="Emails sent by the app in development — messages, RSVP confirmations and co-host invites — will appear here."
      />
    );
  }

  const selected = emails.find((e) => e.id === selectedId) ?? emails[0];

  return (
    <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0">
      <Card className="overflow-hidden">
        <CardHeader
          title={`Captured emails (${emails.length})`}
          description="Newest first"
        />
        <div className="max-h-[36rem] divide-y divide-line overflow-y-auto">
          {emails.map((email) => {
            const active = email.id === selected.id;
            return (
              <button
                key={email.id}
                type="button"
                onClick={() => setSelectedId(email.id)}
                className={`block w-full px-4 py-3 text-left transition-colors ${
                  active
                    ? "bg-brand-soft"
                    : "bg-surface hover:bg-sunken"
                }`}
              >
                <p className="truncate text-sm font-medium text-ink">
                  {email.subject || "(No subject)"}
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-muted">
                  To: {email.to}
                </p>
                <p className="mt-0.5 text-xs text-ink-faint">
                  {formatTimestamp(email.createdAtMs, timeZone)}
                </p>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader
          title={selected.subject || "(No subject)"}
          description={
            <>
              To: <span className="text-ink">{selected.to}</span> ·{" "}
              {formatTimestamp(selected.createdAtMs, timeZone)}
            </>
          }
          actions={
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={viewMode === "html" ? "primary" : "secondary"}
                onClick={() => setViewMode("html")}
              >
                HTML
              </Button>
              <Button
                size="sm"
                variant={viewMode === "text" ? "primary" : "secondary"}
                onClick={() => setViewMode("text")}
              >
                Plain text
              </Button>
            </div>
          }
        />
        <CardBody>
          {viewMode === "html" ? (
            <iframe
              title={`Email preview: ${selected.subject}`}
              srcDoc={selected.html}
              sandbox=""
              className="h-[520px] w-full rounded-lg border border-line bg-canvas"
            />
          ) : (
            <pre className="max-h-[520px] overflow-auto rounded-lg border border-line bg-sunken p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink">
              {selected.text}
            </pre>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
