"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  FileText,
  History,
  Image as ImageIcon,
  LayoutDashboard,
  Link2,
  ListOrdered,
  Megaphone,
  Menu,
  MessageCircle,
  PenSquare,
  Plus,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { isNavItemActive, visibleNavSections } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/permissions";

const ICONS: Record<string, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  bell: Bell,
  calendar: CalendarDays,
  queue: ListOrdered,
  approvals: CheckCircle2,
  sparkles: Sparkles,
  bot: Bot,
  tasks: CheckSquare,
  pen: PenSquare,
  image: ImageIcon,
  megaphone: Megaphone,
  chart: BarChart3,
  report: FileText,
  team: Users,
  link: Link2,
  discord: MessageCircle,
  history: History,
  settings: Settings,
};

export function Sidebar({
  slug,
  allowed,
  workspaceName,
  role,
  logoUrl,
}: {
  slug: string;
  allowed: string[];
  workspaceName: string;
  role: Role;
  logoUrl?: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const base = `/w/${slug}`;
  const canCreate = allowed.includes("posts.create");
  const sections = visibleNavSections(allowed, role);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-4 top-3 z-50 inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background/95 shadow-sm lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <Link href={`${base}/dashboard`} className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" /> : "SF"}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-5">SocialFlow</span>
              <span className="block truncate text-xs text-muted-foreground">{workspaceName}</span>
            </span>
          </Link>
          <button type="button" onClick={() => setOpen(false)} className="rounded p-1 lg:hidden" aria-label="Close navigation">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {canCreate ? (
            <Link
              href={`${base}/content-studio/new`}
              onClick={() => setOpen(false)}
              className="mb-4 flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> New post
            </Link>
          ) : null}
          <div className="space-y-5">
            {sections.map((section) => (
              <div key={section.label}>
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </p>
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = ICONS[item.icon] ?? LayoutDashboard;
                    const active = isNavItemActive(pathname, base, item.href, item.exact);
                    return (
                      <li key={item.href}>
                        <Link
                          href={`${base}${item.href}`}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition",
                            active
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>
        <div className="border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="text-sm font-medium">{ROLE_LABELS[role]}</p>
        </div>
      </aside>
    </>
  );
}
