import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <AuthShell
      tagline="Start posting better content."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-[#c084fc] transition-colors duration-300 ease-out hover:text-white"
          >
            Sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={<FormSkeleton />}>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}

function FormSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="h-11 w-full animate-pulse rounded-full bg-white/5" />
      <div className="h-11 w-full animate-pulse rounded-[10px] bg-white/5" />
      <div className="h-11 w-full animate-pulse rounded-[10px] bg-white/5" />
      <div className="h-11 w-full animate-pulse rounded-[10px] bg-white/5" />
      <div className="h-11 w-full animate-pulse rounded-full bg-white/5" />
    </div>
  );
}
