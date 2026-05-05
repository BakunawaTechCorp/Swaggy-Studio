import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <AuthShell
      tagline="Welcome back."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-[#c084fc] transition-colors duration-300 ease-out hover:text-white"
          >
            Sign up free
          </Link>
        </>
      }
    >
      <Suspense fallback={<FormSkeleton />}>
        <LoginForm />
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
      <div className="h-11 w-full animate-pulse rounded-full bg-white/5" />
    </div>
  );
}
