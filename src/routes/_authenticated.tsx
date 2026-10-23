import {
  createFileRoute,
  redirect,
  Outlet,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { getToken, api } from "@/lib/api";
import { logout, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Clock,
  FolderKanban,
  ListTodo,
  Users,
  LogOut,
  Building2,
  Shield,
  ChevronDown,
  Calendar,
  Lock,
  Eye,
  EyeOff,
  Settings,
  Menu,
  Wallet,
  Sparkles,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import aimployLogo from "@/assets/aimploy-logo.png";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NotificationBell } from "@/components/notification-bell";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { AiAssistantButton } from "@/components/ai/ai-assistant-button";
import { AiChatDrawer } from "@/components/ai/ai-chat-drawer";

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
  | {
      label: string;
      icon: typeof LayoutDashboard;
      children: { to: string; label: string; icon: typeof LayoutDashboard }[];
    };

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/ai-assistant", label: "AI Assistant", icon: Sparkles },
  { to: "/attendance", label: "Attendance", icon: Clock },
  { to: "/leaves", label: "Leaves", icon: Calendar },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/tasks", label: "My Tasks", icon: ListTodo },
  { to: "/employees", label: "Employees", icon: Users },
  { to: "/payroll", label: "Payroll", icon: Wallet },
  {
    label: "Organization",
    icon: Building2,
    children: [
      { to: "/departments", label: "Departments", icon: Building2 },
      { to: "/roles", label: "Roles", icon: Shield },
    ],
  },
  { to: "/settings", label: "Settings", icon: Settings },
];

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const { role, email, passwordResetRequired, permissions } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [orgOpen, setOrgOpen] = useState(
    pathname.startsWith("/departments") || pathname.startsWith("/roles"),
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);

  const allowedNavItems = useMemo(() => {
    const userRole = (role ?? "").toLowerCase().trim();
    const isSystemAdmin = userRole === "admin";
    return navItems.filter((item) => {
      if (item.label === "Employees") {
        return isSystemAdmin || permissions.includes("manage_employees");
      }
      if (item.label === "Organization") {
        return (
          isSystemAdmin ||
          permissions.includes("manage_departments") ||
          permissions.includes("manage_roles")
        );
      }
      return true;
    });
  }, [role, permissions]);

  function onLogout() {
    logout();
    navigate({ to: "/login" });
  }

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  if (passwordResetRequired) {
    return <ForcePasswordReset email={email} onLogout={onLogout} />;
  }

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
                    <ChevronDown
                      className={"h-4 w-4 transition-transform " + (expanded ? "rotate-180" : "")}
                    />
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
                            style={
                              childActive ? { background: "var(--gradient-brand)" } : undefined
                            }
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
          <div className="flex items-center gap-2">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 cursor-pointer">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="p-0 w-64 text-sidebar-foreground border-none"
                style={{ background: "var(--gradient-sidebar)" }}
              >
                <div className="flex flex-col h-full">
                  <div className="px-6 py-6 border-b border-sidebar-border">
                    <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="block">
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
                              style={
                                anyActive ? { background: "var(--gradient-brand)" } : undefined
                              }
                            >
                              <div className="flex items-center gap-3">
                                <item.icon className="h-4 w-4" />
                                {item.label}
                              </div>
                              <ChevronDown
                                className={
                                  "h-4 w-4 transition-transform " + (expanded ? "rotate-180" : "")
                                }
                              />
                            </button>
                            {expanded && (
                              <div className="ml-4 mt-1 space-y-1">
                                {item.children.map((child) => {
                                  const childActive = isActive(child.to);
                                  return (
                                    <Link
                                      key={child.to}
                                      to={child.to}
                                      onClick={() => setMobileOpen(false)}
                                      className={
                                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all " +
                                        (childActive
                                          ? "text-sidebar-primary-foreground shadow-[var(--shadow-brand)]"
                                          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent")
                                      }
                                      style={
                                        childActive
                                          ? { background: "var(--gradient-brand)" }
                                          : undefined
                                      }
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
                          onClick={() => setMobileOpen(false)}
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
                      onClick={() => {
                        setMobileOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <img src={aimployLogo} alt="Aimploy" className="h-6 w-auto" />
          </div>
          <div className="flex items-center gap-1.5">
            <NotificationBell />
            <Button variant="ghost" size="sm" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <header className="hidden md:flex h-14 border-b bg-background/80 backdrop-blur sticky top-0 z-10 px-8 items-center justify-between">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>Signed in as</span>
            <span className="font-semibold text-foreground">{email}</span>
            {role && (
              <span className="ml-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-primary/10 text-primary border border-primary/20">
                {role}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 px-4 md:px-8 py-6 md:py-8 max-w-6xl w-full">
          <Outlet />
        </main>
        <AiAssistantButton onClick={() => setAiDrawerOpen(true)} />
        <AiChatDrawer open={aiDrawerOpen} onOpenChange={setAiDrawerOpen} />
      </div>
    </div>
  );
}

interface ForcePasswordResetProps {
  email: string | null;
  onLogout: () => void;
}

function ForcePasswordReset({ email, onLogout }: ForcePasswordResetProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("User email not found. Please log in again.");
      onLogout();
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: {
          email,
          new_password: newPassword,
          confirm_password: confirmPassword,
        },
      });
      toast.success("Password updated successfully! Please log in with your new password.");
      onLogout();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 w-full"
      style={{ background: "var(--gradient-sidebar)" }}
    >
      <Card className="w-full max-w-md shadow-2xl border border-border/50 backdrop-blur-md bg-card/90">
        <CardHeader className="space-y-2 text-center pb-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
            <Lock className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Set New Password</CardTitle>
          <CardDescription className="text-sm text-muted-foreground max-w-[280px] mx-auto">
            This is your first login or your password was recently reset. Please set a new password
            to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNew ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full font-semibold shadow-md transition-all hover:opacity-90 mt-2 cursor-pointer"
              style={{ background: "var(--gradient-brand)" }}
              disabled={loading}
            >
              {loading ? "Updating Password..." : "Update & Log In"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-xs text-muted-foreground hover:text-foreground mt-1 cursor-pointer"
              onClick={onLogout}
            >
              Cancel & Log Out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
