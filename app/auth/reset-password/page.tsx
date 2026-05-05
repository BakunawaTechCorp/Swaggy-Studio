import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      tagline="Choose a new password."
      footer={
        <>
          Changed your mind?{" "}
          <Link
            href="/login"
            className="font-medium text-[#c084fc] transition-colors duration-300 ease-out hover:text-white"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
