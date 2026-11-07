import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, resolvePostLoginPath } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect(await resolvePostLoginPath(user.id));
  const { next, reset } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to your workspace to keep things moving.</p>
      </div>
      {reset ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          Password updated. Sign in with your new password.
        </p>
      ) : null}
      <LoginForm next={next} />
      <p className="text-center text-sm text-muted-foreground">
        New to SocialFlow?{" "}
        <Link
          href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-primary hover:underline"
        >
          Create an account
        </Link>
      </p>
      <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Demo accounts</p>
        <p>admin@socialflow.test · manager@socialflow.test · exec@socialflow.test</p>
        <p>Password: Password123!</p>
      </div>
    </div>
  );
}
