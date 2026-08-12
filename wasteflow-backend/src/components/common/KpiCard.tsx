import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  tone?: "default" | "primary" | "accent" | "danger";
}) {
  return (
    <div
      className={cn(
        "surface-card flex items-start justify-between gap-3 p-4",
        tone === "primary" && "kpi-gradient border-transparent text-primary-foreground",
      )}
    >
      <div className="min-w-0">
        <p
          className={cn(
            "text-xs font-medium uppercase tracking-wide",
            tone === "primary" ? "text-primary-foreground/75" : "text-muted-foreground",
          )}
        >
          {label}
        </p>
        <p className="mt-1.5 truncate text-2xl font-semibold tabular-nums">{value}</p>
        {sub ? (
          <p
            className={cn(
              "mt-0.5 text-xs",
              tone === "primary" ? "text-primary-foreground/75" : "text-muted-foreground",
            )}
          >
            {sub}
          </p>
        ) : null}
      </div>
      {Icon ? (
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-md",
            tone === "primary" && "bg-primary-foreground/15 text-primary-foreground",
            tone === "accent" && "bg-accent/20 text-accent-foreground",
            tone === "danger" && "bg-destructive/12 text-destructive",
            tone === "default" && "bg-secondary text-secondary-foreground",
          )}
        >
          <Icon className="size-4.5" />
        </span>
      ) : null}
    </div>
  );
}
