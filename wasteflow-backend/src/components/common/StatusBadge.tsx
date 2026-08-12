import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/format";

const TONE: Record<string, string> = {
  collected: "bg-success/12 text-success border-success/30",
  completed: "bg-success/12 text-success border-success/30",
  active: "bg-success/12 text-success border-success/30",
  issued: "bg-info/12 text-info border-info/30",
  in_progress: "bg-info/12 text-info border-info/30",
  scheduled: "bg-info/12 text-info border-info/30",
  partially_collected: "bg-warning/18 text-warning-foreground border-warning/40",
  pending: "bg-muted text-muted-foreground border-border",
  not_started: "bg-muted text-muted-foreground border-border",
  draft: "bg-muted text-muted-foreground border-border",
  inactive: "bg-muted text-muted-foreground border-border",
  closed: "bg-muted text-muted-foreground border-border",
  missed: "bg-destructive/12 text-destructive border-destructive/30",
  cancelled: "bg-destructive/12 text-destructive border-destructive/30",
  maintenance: "bg-warning/18 text-warning-foreground border-warning/40",
};

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  const key = (status ?? "").toLowerCase();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONE[key] ?? "bg-secondary text-secondary-foreground border-border",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {titleCase(status)}
    </span>
  );
}
