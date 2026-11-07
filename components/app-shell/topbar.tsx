"use client";

import Link from "next/link";
import { Bell, Building2, ChevronDown, LogOut, Search, Settings, UserRound } from "lucide-react";
import { logoutAction, switchWorkspaceAction } from "@/lib/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar({
  slug,
  user,
  memberships,
  unreadCount,
}: {
  slug: string;
  user: { fullName: string; email: string; avatarUrl: string | null };
  memberships: { id: string; name: string; slug: string }[];
  unreadCount: number;
}) {
  const current = memberships.find((membership) => membership.slug === slug);
  const initials = user.fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 pl-16 backdrop-blur lg:px-6 lg:pl-6">
      <div className="flex min-w-0 items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex max-w-[240px] items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm font-medium transition hover:bg-muted">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{current?.name ?? "Workspace"}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
            {memberships.map((membership) => (
              <form key={membership.id} action={switchWorkspaceAction}>
                <input type="hidden" name="workspaceId" value={membership.id} />
                <button type="submit" className="w-full text-left">
                  <DropdownMenuItem className="cursor-pointer">
                    <Building2 className="h-4 w-4" />
                    <span className="truncate">{membership.name}</span>
                  </DropdownMenuItem>
                </button>
              </form>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/w/${slug}/settings`}>
                <Settings className="h-4 w-4" /> Workspace settings
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <form action={`/w/${slug}/search`} method="get" className="relative hidden min-w-0 flex-1 md:block md:max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          name="q"
          placeholder="Search posts, tasks, campaigns…"
          aria-label="Global search"
          className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>

      <div className="flex items-center gap-1.5">
        <Link
          href={`/w/${slug}/search`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card transition hover:bg-muted md:hidden"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </Link>
        <ThemeToggle />
        <Link
          href={`/w/${slug}/notifications`}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card transition hover:bg-muted"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md border border-border bg-card py-1 pl-1 pr-2 transition hover:bg-muted">
            <Avatar className="h-7 w-7">
              {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[120px] truncate text-sm sm:block">{user.fullName}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="normal-case tracking-normal">
              <span className="block text-sm font-medium text-foreground">{user.fullName}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">{user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/w/${slug}/settings`}>
                <UserRound className="h-4 w-4" /> Profile & preferences
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/w/${slug}/notifications`}>
                <Bell className="h-4 w-4" /> Notifications
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={logoutAction}>
              <button type="submit" className="w-full text-left">
                <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600 dark:text-red-400">
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </button>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
