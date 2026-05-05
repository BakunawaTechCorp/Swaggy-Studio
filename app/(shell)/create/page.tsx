import { createClient } from "@/lib/supabase/server";
import { CreateTool } from "./_components/CreateTool";

function deriveFirstName(user: {
  email?: string | null;
  user_metadata?: { full_name?: string | null; name?: string | null } | null;
}): string | undefined {
  const meta = user.user_metadata ?? {};
  const fromMeta =
    typeof meta.full_name === "string"
      ? meta.full_name
      : typeof meta.name === "string"
        ? meta.name
        : null;
  if (fromMeta) {
    const first = fromMeta.trim().split(/\s+/)[0];
    if (first) return first;
  }
  if (user.email) {
    const local = user.email.split("@")[0];
    const cleaned = local.replace(/[._-]+/g, " ").trim().split(/\s+/)[0];
    if (cleaned) return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return undefined;
}

export default async function CreatePage() {
  // Layout already enforced auth — re-read user only to derive the greeting.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const firstName = user ? deriveFirstName(user) : undefined;

  return <CreateTool firstName={firstName} />;
}
