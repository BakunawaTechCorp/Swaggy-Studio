import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      tagline="Reset your password."
      footer={
        <>
          Remembered it?{" "}
          <Link
            href="/login"
            className="font-medium text-[#c084fc] transition-colors duration-300 ease-out hover:text-white"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
