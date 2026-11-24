import { Fragment, type ReactNode } from "react";
import { cn } from "./cn";

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

function linkify(line: string): ReactNode[] {
  return line.split(URL_RE).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noreferrer" className="break-all underline underline-offset-2">
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/**
 * Renders host-written plain text: blank lines make paragraphs, single line
 * breaks are kept, URLs become links. Renders nothing for null/blank text.
 * Use this for every multi-line text field, on the guest site and in admin previews.
 */
export function TextBlock({ text, className }: { text: string | null | undefined; className?: string }) {
  const paragraphs = (text ?? "").trim().split(/\n\s*\n/).filter((p) => p.trim());
  if (paragraphs.length === 0) return null;
  return (
    <div className={cn("space-y-4 [overflow-wrap:anywhere]", className)}>
      {paragraphs.map((p, i) => (
        <p key={i}>
          {p.split("\n").map((line, j, lines) => (
            <Fragment key={j}>
              {linkify(line)}
              {j < lines.length - 1 && <br />}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
