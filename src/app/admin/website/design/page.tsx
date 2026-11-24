import { redirect } from "next/navigation";

// Design moved to Settings → Design.
export default function OldDesignPage() {
  redirect("/admin/settings/design");
}
