import { createFileRoute, redirect, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { getToken } from "@/lib/api";
import { logout, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Clock, FolderKanban, ListTodo, Users, LogOut, Building2, Shield, ChevronDown } from "lucide-react";
import aimployLogo from "@/assets/aimploy-logo.png";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ location }) => {
    if (typeof window !== "undefined" && !getToken()) {
      throw redirect({ to: "/login", search: { redirect: location.href } as never });
    }
  },
  component: AuthenticatedLayout,
});

type NavItem =
  | { to: string; label: string; icon: typeof LayoutDashboard }
  | { label: string; icon: typeof LayoutDashboard; children: { to: string; label: string; icon: typeof LayoutDashboard }[] };

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/attendance", label: "Attendance", icon: Clock },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/tasks", label: "My Tasks", icon: ListTodo },
  { to: "/employees", label: "Employees", icon: Users },
  {
    label: "Organization",
    icon: Building2,
    children: [
      { to: "/departments", label: "Departments", icon: Building2 },
      { to: "/roles", label: "Roles", icon: Shield },
    ],
  },
];

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [orgOpen, setOrgOpen] = useState(pathname.startsWith("/departments") || pathname.startsWith("/roles"));
  
  const allowedNavItems = useMemo(() => {
    const userRole = (role ?? "").toLowerCase().trim();
    const canSeeOrg = ["admin", "hr", "cfo"].includes(userRole);
    return navItems.filter((item) => {
      if (item.label === "Employees" || item.label === "Organization") {
        return canSeeOrg;
      }
      return true;
    });
  }, [role]);

  function onLogout() {
    logout();
    navigate({ to: "/login" });
  }

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen flex bg-muted/30">
      <aside
        className="hidden md:flex w-64 flex-col text-sidebar-foreground sticky top-0 h-screen"
        style={{ background: "var(--gradient-sidebar)" }}
      >
        <div className="px-6 py-6 border-b border-sidebar-border">
          <Link to="/dashboard" className="block">
            <img src={aimployLogo} alt="Aimploy" className="h-8 w-auto" />
          </Link>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {allowedNavItems.map((item) => {
            if ("children" in item) {
              const anyActive = item.children.some((c) => isActive(c.to));
              const expanded = orgOpen || anyActive;
              return (
                <div key={item.label}>
                  <button
                    onClick={() => setOrgOpen((v) => !v)}
                    className={
                      "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all " +
                      (anyActive
                        ? "text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent")
                    }
                    style={anyActive ? { background: "var(--gradient-brand)" } : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </div>
                    <ChevronDown className={"h-4 w-4 transition-transform " + (expanded ? "rotate-180" : "")} />
                  </button>
                  {expanded && (
                    <div className="ml-4 mt-1 space-y-1">
                      {item.children.map((child) => {
                        const childActive = isActive(child.to);
                        return (
                          <Link
                            key={child.to}
                            to={child.to}
                            className={
                              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all " +
                              (childActive
                                ? "text-sidebar-primary-foreground shadow-[var(--shadow-brand)]"
                                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent")
                            }
                            style={childActive ? { background: "var(--gradient-brand)" } : undefined}
                          >
                            <child.icon className="h-4 w-4" />
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all " +
                  (active
                    ? "text-sidebar-primary-foreground shadow-[var(--shadow-brand)]"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent")
                }
                style={active ? { background: "var(--gradient-brand)" } : undefined}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden border-b bg-background sticky top-0 z-10 px-4 h-14 flex items-center justify-between">
          <img src={aimployLogo} alt="Aimploy" className="h-6 w-auto" />
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        <nav className="md:hidden flex items-center gap-1 overflow-x-auto border-b bg-background px-2 py-2">
          {allowedNavItems.flatMap((item) =>
            "children" in item
              ? item.children.map((child) => (
                  <Link
                    key={child.to}
                    to={child.to}
                    className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-1.5 whitespace-nowrap"
                    activeProps={{ className: "px-3 py-1.5 rounded-md text-xs bg-accent text-foreground font-medium flex items-center gap-1.5 whitespace-nowrap" }}
                  >
                    <child.icon className="h-3.5 w-3.5" />
                    {child.label}
                  </Link>
                ))
              : [
                  <Link
                    key={item.to}
                    to={item.to}
                    className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-1.5 whitespace-nowrap"
                    activeProps={{ className: "px-3 py-1.5 rounded-md text-xs bg-accent text-foreground font-medium flex items-center gap-1.5 whitespace-nowrap" }}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>,
                ]
          )}
        </nav>
        <main className="flex-1 px-4 md:px-8 py-6 md:py-8 max-w-6xl w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}