import { SubNav } from "@/components/ui";

export function DayOfSubNav({ current }: { current: string }) {
  return (
    <div className="print:hidden">
      <SubNav
        label="Day of"
        current={current}
        items={[
          { href: "/admin/day-of", label: "Run sheet" },
          { href: "/admin/day-of/helpers", label: "Helpers" },
          { href: "/admin/day-of/music", label: "Music" },
        ]}
      />
    </div>
  );
}
