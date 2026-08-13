import { useEffect, useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "@/lib/format";
import {
  LayoutDashboard,
  QrCode,
  ClipboardCheck,
  Building2,
  Route as RouteIcon,
  Users,
  Truck,
  Fuel,
  FileText,
  Recycle,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
  Bell,
  CloudOff,
  RefreshCw,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth, ROLE_LABELS } from "@/hooks/useAuth";
import { readQueue, flushQueue } from "@/lib/offline-queue";
import { toast } from "sonner";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/scanner", label: "QR Scanner", icon: QrCode },
  { to: "/collection", label: "Collection & Tracking", icon: ClipboardCheck },
  { to: "/bwgs", label: "Bulk Waste Generators", icon: Building2 },
  { to: "/routes", label: "Routes", icon: RouteIcon },
  { to: "/employees", label: "Employees", icon: Users },
  { to: "/vehicles", label: "Vehicles", icon: Truck },
  { to: "/diesel", label: "Diesel Log", icon: Fuel },
  { to: "/waybills", label: "Waybills", icon: FileText },
  { to: "/waste-types", label: "Waste Types & Quantities", icon: Recycle },
  { to: "/reports", label: "Reports & Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

const MOBILE_NAV = NAV.slice(0, 5);

function useQueueCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(readQueue().length);
    update();
    window.addEventListener("wasteflow:queue-changed", update);
    window.addEventListener("online", update);
    return () => {
      window.removeEventListener("wasteflow:queue-changed", update);
      window.removeEventListener("online", update);
    };
  }, []);
  return count;
}

function SyncStatus() {
  const pending = useQueueCount();
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online && pending === 0) return null;

  return (
    <Button
      size="sm"
      variant={online ? "secondary" : "destructive"}
      disabled={syncing || !online}
      onClick={async () => {
        setSyncing(true);
        const res = await flushQueue();
        setSyncing(false);
        toast[res.failed ? "warning" : "success"](
          `Synced ${res.synced} record(s)${res.failed ? `, ${res.failed} still pending` : ""}`,
        );
      }}
    >
      {online ? <RefreshCw className={cn("size-4", syncing && "animate-spin")} /> : <CloudOff className="size-4" />}
      {online ? `Sync ${pending}` : `Offline${pending ? ` · ${pending} queued` : ""}`}
    </Button>
  );
}

function AlertsBell() {
  const alerts = useQuery({
    queryKey: ["ops-alerts", todayISO()],
    queryFn: async () => {
      const [missed, diesel] = await Promise.all([
        supabase
          .from("daily_bwg_status")
          .select("id", { count: "exact", head: true })
          .eq("status_date", todayISO())
          .eq("status", "missed"),
        supabase.from("diesel_logs").select("id", { count: "exact", head: true }).eq("is_abnormal", true).eq("log_date", todayISO()),
      ]);
      return (missed.count ?? 0) + (diesel.count ?? 0);
    },
    refetchInterval: 60_000,
  });
  const count = alerts.data ?? 0;
  return (
    <Link
      to="/collection"
      className="relative rounded-md p-2 hover:bg-secondary"
      aria-label={count ? `${count} operational alerts` : "No operational alerts"}
    >
      <Bell className="size-4.5" />
      {count > 0 ? <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent" /> : null}
    </Link>
  );
}

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { user, primaryRole, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const sidebar = (
    <nav className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <Recycle className="size-4.5" />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">WasteFlow ERP</p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">Municipal operations</p>
          </div>
        )}
        <button
          className="ml-auto rounded p-1 text-sidebar-foreground/70 hover:bg-sidebar-accent lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              pathname.startsWith(item.to)
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80",
            )}
            title={item.label}
          >
            <item.icon className="size-4.5 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        ))}
      </div>
      <div className="border-t border-sidebar-border p-2">
        <button
          className="hidden w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent lg:flex"
          onClick={() => setCollapsed((c) => !c)}
        >
          <Menu className="size-4.5 shrink-0" />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-50 w-64 transition-transform lg:static lg:translate-x-0",
          collapsed && "lg:w-16",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {sidebar}
      </aside>
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-3 backdropblur sm:px-5">
          <button
            className="rounded-md p-2 hover:bg-secondary lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
          <p className="hidden text-sm text-muted-foreground sm:block">{today}</p>
          <div className="ml-auto flex items-center gap-2">
            <SyncStatus />
            <AlertsBell />
            <div className="hidden text-right sm:block">
              <p className="max-w-[160px] truncate text-xs font-medium">{user?.email}</p>
              <p className="text-[11px] text-muted-foreground">
                {primaryRole ? ROLE_LABELS[primaryRole] : "No role"}
              </p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => void signOut()}>
              <LogOut className="size-4.5" />
            </Button>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-3 pb-24 sm:p-5 lg:pb-6">
          <Outlet />
        </main>

        <nav className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card lg:hidden">
          {MOBILE_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px]",
                pathname.startsWith(item.to) ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" />
              <span className="max-w-full truncate px-1">{item.label.split(" ")[0]}</span>
            </Link>
          ))}
        </nav>

        {moreOpen ? null : null}
        <button
          className="no-print fixed bottom-16 right-3 z-40 grid size-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-panel lg:hidden"
          onClick={() => setOpen(true)}
          aria-label="More sections"
        >
          <MoreHorizontal className="size-5" />
        </button>
      </div>
    </div>
  );
}
