import type { ReactNode } from "react";
import { Card, CardBody } from "@/components/ui";

export function AuthShell({
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-12">
      <div className={wide ? "w-full max-w-lg space-y-6" : "w-full max-w-md space-y-6"}>
        <header className="space-y-2 text-center">
          <h1 className="font-serif text-4xl leading-tight font-medium text-ink">{title}</h1>
          {description && <p className="text-sm text-ink-muted">{description}</p>}
        </header>
        <Card>
          <CardBody className="p-6">{children}</CardBody>
        </Card>
        {footer && <div className="text-center text-sm text-ink-muted">{footer}</div>}
      </div>
    </div>
  );
}
