import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/10 text-primary",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-muted-foreground",
        success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
        warning: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        danger: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-300",
        info: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        violet: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
        neutral: "border-border bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
