import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  trend?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info" | "violet";
  href?: string;
  className?: string;
};

const toneClasses = {
  default: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  danger: "bg-red-500/10 text-red-600 dark:text-red-300",
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
};

export function StatCard({ label, value, hint, icon: Icon, trend, tone = "default", href, className }: StatCardProps) {
  const content = (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 shadow-sm",
        href && "transition hover:border-primary/40 hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        {Icon ? (
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", toneClasses[tone])}>
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
      {hint || trend ? (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {trend ? <span className="font-medium text-emerald-600 dark:text-emerald-300">{trend}</span> : null}
          {hint ? <span className="text-muted-foreground">{hint}</span> : null}
        </div>
      ) : null}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
