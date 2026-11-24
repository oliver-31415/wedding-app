import { Button } from "./button";

/**
 * Up/down controls for ordered lists. `action` receives a FormData with
 * `id` and `direction` ("up" | "down"); implement it with `moveId` from
 * src/lib/forms.ts and write the new positions back.
 */
export function ReorderButtons({
  id,
  action,
  isFirst,
  isLast,
  label,
}: {
  id: string;
  action: (formData: FormData) => Promise<void>;
  isFirst: boolean;
  isLast: boolean;
  label: string;
}) {
  return (
    <form action={action} className="flex">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" name="direction" value="up" variant="ghost" size="sm" disabled={isFirst} aria-label={`Move ${label} up`}>
        ↑
      </Button>
      <Button type="submit" name="direction" value="down" variant="ghost" size="sm" disabled={isLast} aria-label={`Move ${label} down`}>
        ↓
      </Button>
    </form>
  );
}
