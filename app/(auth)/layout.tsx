import Link from "next/link";
import { Sparkles, CalendarDays, CheckCircle2, MessageCircle } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-black p-10 text-white lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.06),transparent_50%)]" />
        <div className="relative">
          <Link href="/login" className="flex items-center gap-2 text-lg font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">SF</span>
            SocialFlow
          </Link>
        </div>
        <div className="relative max-w-md space-y-6">
          <h1 className="text-3xl font-semibold leading-tight">
            Plan, approve and publish your social content without the chaos.
          </h1>
          <p className="text-sm text-white/70">
            One calendar for Instagram and Facebook, approvals that actually move, and analytics your whole team can
            understand.
          </p>
          <ul className="space-y-3 text-sm text-white/80">
            <li className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-sky-300" /> Visual calendar and publishing queue
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" /> Role-based approvals and audit trail
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-white/70" /> AI scheduling suggestions you control
            </li>
            <li className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-white/70" /> Discord commands for on-the-go updates
            </li>
          </ul>
        </div>
        <p className="relative text-xs text-white/50">Mock integrations included. No external accounts required.</p>
      </div>
      <div className="flex min-h-screen flex-col bg-background">
        <div className="flex items-center justify-between p-4 lg:justify-end">
          <Link href="/login" className="flex items-center gap-2 text-sm font-semibold lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs text-primary-foreground">SF</span>
            SocialFlow
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
