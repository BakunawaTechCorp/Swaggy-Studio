import Link from "next/link";
import { redirect } from "next/navigation";
import { Rail } from "@/components/layout/Rail";
import { ToastProvider } from "@/components/toast";
import { BrandProfileForm } from "@/components/marketplace/BrandProfileForm";
import { PartnerProfileForm } from "@/components/marketplace/PartnerProfileForm";
import { getProfileBundle } from "@/lib/marketplace/profile";

type Props = {
  params: { role: string };
  searchParams: { edit?: string };
};

export default async function RoleOnboardingPage({ params, searchParams }: Props) {
  const role = params.role;
  if (role !== "brand" && role !== "partner") {
    redirect("/home");
  }

  const { userId, bundle } = await getProfileBundle();
  if (!userId) {
    redirect("/login");
  }

  const isEditing = searchParams?.edit === "1";

  // If they already have this profile and they're not editing, send them home.
  if (!isEditing) {
    if (role === "brand" && bundle?.brand) redirect("/home");
    if (role === "partner" && bundle?.partner) redirect("/home");
  }

  const editingExisting =
    isEditing &&
    ((role === "brand" && bundle?.brand) || (role === "partner" && bundle?.partner));

  return (
    <ToastProvider>
      <div className="app-shell app-shell-no-sidebar">
        <Rail />
        <main className="canvas onboarding">
          <Link href="/home" className="back-link">← Back to home</Link>
          <div className="onboarding-card">
            <h1 className="onboarding-title">
              {editingExisting
                ? role === "brand"
                  ? "Edit your brand profile"
                  : "Edit your partner profile"
                : role === "brand"
                ? "Set up your brand profile"
                : "Set up your partner profile"}
            </h1>
            <p className="onboarding-subtitle">
              {role === "brand"
                ? "Tell partners who you are and what you make. You can edit any of this later."
                : "Tell brands what you cover and how to reach you. You can edit any of this later."}
            </p>
            {role === "brand" ? (
              <BrandProfileForm initial={bundle?.brand ?? null} />
            ) : (
              <PartnerProfileForm initial={bundle?.partner ?? null} />
            )}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
