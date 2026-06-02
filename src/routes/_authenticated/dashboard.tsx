import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, FolderKanban, ListTodo, Users, 
  Calendar, Coins, ArrowRight, UserCheck, 
  MapPin, RefreshCw, Check, X, ShieldAlert,
  CalendarDays, Briefcase, FileSpreadsheet, Plus
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — HRMS" }] }),
  component: Dashboard,
});

// Helper: Geolocation
function getLocation(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation not supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Location permission required to clock in/out."
              : err.message || "Could not detect your location.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getGreeting() {
  const hr = new Date().getHours();
  if (hr < 12) return "Good morning";
  if (hr < 17) return "Good afternoon";
  return "Good evening";
}

function Dashboard() {
  const qc = useQueryClient();
  const { role: authRole } = useAuth();
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [commentText, setCommentText] = useState<Record<string, string>>({});

  // 1. Fetch unified dashboard summary
  const { data: summary, isLoading, refetch } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => api<any>("/dashboard/summary"),
  });

  const { data: company } = useQuery({
    queryKey: ["settings-company"],
    queryFn: () => api<any>("/settings/company"),
  });
  const currencySymbol = company?.currency ?? "AED";

  const isClockedIn = summary?.attendance_today?.status === "clocked_in";
  const userRole = (summary?.user?.role ?? authRole ?? "").toLowerCase().trim();
  const isAdminOrHr = ["admin", "hr", "manager", "line_manager", "cfo"].includes(userRole);

  // 2. Geolocation Detector
  const detectLocation = async () => {
    setDetecting(true);
    try {
      const c = await getLocation();
      setCoords(c);
      return c;
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    } finally {
      setDetecting(false);
    }
  };

  // 3. Attendance Clock mutations
  const clockIn = useMutation({
    mutationFn: async () => {
      const c = await detectLocation();
      return api("/attendance/clockin", {
        method: "POST",
        body: { lat: c.lat, lon: c.lon },
      });
    },
    onSuccess: () => {
      toast.success("Successfully clocked in today!");
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (e: Error) => {
      if (!detecting) toast.error(e.message);
    },
  });

  const clockOut = useMutation({
    mutationFn: async () => {
      const c = await detectLocation();
      return api("/attendance/clockout", {
        method: "POST",
        body: { lat: c.lat, lon: c.lon },
      });
    },
    onSuccess: () => {
      toast.success("Successfully clocked out today!");
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (e: Error) => {
      if (!detecting) toast.error(e.message);
    },
  });

  // 4. Approval Mutations
  const approveAction = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: string }) => {
      const comment = commentText[id] || "Approved from Dashboard";
      if (type === "leave") {
        return api(`/leaves/${id}/approve`, { method: "POST", body: { comment } });
      } else {
        const formData = new FormData();
        formData.append("comment", comment);
        return api(`/reimbursements/${id}/approve`, { method: "POST", formData });
      }
    },
    onSuccess: (_, variables) => {
      toast.success(`Successfully approved ${variables.type} request.`);
      // Clear comment text
      setCommentText(prev => {
        const next = { ...prev };
        delete next[variables.id];
        return next;
      });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectAction = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: string }) => {
      const comment = commentText[id] || "Rejected from Dashboard";
      if (type === "leave") {
        return api(`/leaves/${id}/reject`, { method: "POST", body: { comment } });
      } else {
        const formData = new FormData();
        formData.append("comment", comment);
        return api(`/reimbursements/${id}/reject`, { method: "POST", formData });
      }
    },
    onSuccess: (_, variables) => {
      toast.success(`Successfully rejected ${variables.type} request.`);
      setCommentText(prev => {
        const next = { ...prev };
        delete next[variables.id];
        return next;
      });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = clockIn.isPending || clockOut.isPending || detecting;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-64 bg-muted rounded-md" />
        <div className="h-4 w-72 bg-muted rounded-md" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-6">
          {[1, 2, 3, 4].map(i => <Card key={i} className="h-28 bg-muted" />)}
        </div>
        <div className="h-64 w-full bg-muted rounded-xl mt-6" />
      </div>
    );
  }

  const user = summary?.user;
  const attendanceToday = summary?.attendance_today;
  const myStats = summary?.my_stats;
  const holidays = summary?.upcoming_holidays ?? [];
  const orgStats = summary?.org_stats;
  const pendingActions = summary?.pending_actions ?? [];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {getGreeting()}, {user?.full_name || "Employee"}!
          </h1>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="w-fit self-start sm:self-auto cursor-pointer shadow-soft">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh Data
        </Button>
      </div>

      {/* Role-Based Overview Grid */}
      {isAdminOrHr && orgStats ? (
        // MANAGER/ADMIN VIEW STATS
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            icon={Users} 
            title="Total Headcount" 
            value={String(orgStats.total_employees)} 
            subtitle="Active employees" 
            href="/employees" 
          />
          <StatCard 
            icon={UserCheck} 
            title="Active Attendance" 
            value={`${Math.round((orgStats.clocked_in_today / (orgStats.total_employees || 1)) * 100)}%`} 
            subtitle={`${orgStats.clocked_in_today} clocked in today`} 
            href="/attendance" 
            accent 
          />
          <StatCard 
            icon={Calendar} 
            title="Pending Leaves" 
            value={String(orgStats.pending_leaves)} 
            subtitle="Awaiting review" 
            href="/leaves" 
          />
          <StatCard 
            icon={Coins} 
            title="Pending Expenses" 
            value={String(orgStats.pending_reimbursements)} 
            subtitle="Pending reimbursement" 
            href="/settings" // Or appropriate route
          />
        </div>
      ) : (
        // STANDARD EMPLOYEE VIEW STATS
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border border-border/50 bg-card shadow-soft h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">My Attendance</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-col">
                <span className="text-2xl font-bold tracking-tight">
                  {isClockedIn ? "Clocked In" : "Clocked Out"}
                </span>
                {attendanceToday?.clock_in_at && (
                  <span className="text-xs text-muted-foreground mt-1">
                    Since {formatTime(attendanceToday.clock_in_at)} Today
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <StatCard 
            icon={Calendar} 
            title="Annual Leave Balance" 
            value={`${myStats?.annual_leave_remaining ?? 0} days`} 
            subtitle="Remaining entitled" 
            href="/leaves" 
            accent
          />
          
          <StatCard 
            icon={ListTodo} 
            title="My Tasks" 
            value={String(myStats?.tasks_count ?? 0)} 
            subtitle="Active tasks pending" 
            href="/tasks" 
          />

          <StatCard 
            icon={FolderKanban} 
            title="Projects" 
            value={String(myStats?.projects_count ?? 0)} 
            subtitle="Active project teams" 
            href="/projects" 
          />
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns (Col Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Actionable approvals panel for Managers/Admin */}
          {isAdminOrHr && (
            <Card className="border border-border/50 bg-card shadow-soft">
              <CardHeader className="border-b border-border/40 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold">Action Needed</CardTitle>
                    <CardDescription>Review and approve pending employee requests.</CardDescription>
                  </div>
                  <Badge variant={pendingActions.length > 0 ? "destructive" : "secondary"} className="rounded-full">
                    {pendingActions.length} Pending
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {pendingActions.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
                    <UserCheck className="h-8 w-8 text-muted-foreground/50" />
                    <span>Fantastic! You're completely caught up on approvals.</span>
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {pendingActions.map((action: any) => (
                      <div key={action.id} className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-muted/5 transition-colors">
                        <div className="space-y-1 max-w-md">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{action.employee_name}</span>
                            <Badge variant="outline" className="capitalize text-[10px] py-0 font-bold">
                              {action.type}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {action.details}
                          </p>
                          {action.date_info && (
                            <div className="text-[10px] text-primary/70 font-semibold">
                              Period/Date: {action.date_info}
                            </div>
                          )}
                          {action.amount && (
                            <div className="text-sm font-extrabold text-foreground">
                              Amount: {action.amount.toLocaleString()} {currencySymbol}
                            </div>
                          )}
                          {/* Quick comment input */}
                          <input 
                            type="text" 
                            placeholder="Add a quick note/reason..." 
                            value={commentText[action.id] || ""}
                            onChange={(e) => setCommentText({ ...commentText, [action.id]: e.target.value })}
                            className="w-full mt-2 border border-border/60 rounded px-2.5 py-1 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
                          />
                        </div>

                        <div className="flex gap-2 self-end sm:self-auto shrink-0">
                          <Button 
                            onClick={() => rejectAction.mutate({ id: action.id, type: action.type })}
                            disabled={rejectAction.isPending || approveAction.isPending}
                            variant="outline" 
                            size="sm" 
                            className="h-8 w-8 p-0 cursor-pointer border-destructive/20 text-destructive hover:bg-destructive/5"
                            title="Reject Request"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button 
                            onClick={() => approveAction.mutate({ id: action.id, type: action.type })}
                            disabled={rejectAction.isPending || approveAction.isPending}
                            size="sm" 
                            className="h-8 gap-1.5 cursor-pointer font-bold"
                            style={{ background: "var(--gradient-brand)" }}
                          >
                            <Check className="h-4 w-4" /> Approve
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick Actions & Navigation Cards */}
          <Card className="border border-border/50 bg-card shadow-soft">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Quick Access</CardTitle>
              <CardDescription>Perform common tasks and navigate direct modules.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <QuickActionCard 
                to="/attendance" 
                icon={Clock} 
                title="Clock Controls" 
                desc="Punch in/out & history" 
              />
              <QuickActionCard 
                to="/leaves" 
                icon={CalendarDays} 
                title="Apply Leave" 
                desc="Leave applications & balance" 
              />
              <QuickActionCard 
                to="/tasks" 
                icon={ListTodo} 
                title="My Tasks" 
                desc="Assignee list & details" 
              />
              {isAdminOrHr ? (
                <QuickActionCard 
                  to="/employees" 
                  icon={Users} 
                  title="Directory" 
                  desc="Employee profiles & files" 
                />
              ) : (
                <QuickActionCard 
                  to="/settings" 
                  icon={UserCheck} 
                  title="My Profile" 
                  desc="Update contact & security" 
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Attendance Widget & Holidays */}
        <div className="space-y-6">
          {/* Quick Clock Puncher for Employees */}
          {!isAdminOrHr && (
            <Card className="border border-border/50 bg-card shadow-soft overflow-hidden">
              <CardHeader className="bg-muted/15 border-b border-border/40 pb-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary animate-pulse" /> Punch Status Controls
                </CardTitle>
                <CardDescription className="text-xs">Punch attendance directly from home screen.</CardDescription>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                <div className="flex items-center gap-3">
                  <Badge variant={isClockedIn ? "default" : "secondary"} className={isClockedIn ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20" : ""}>
                    {isClockedIn ? "Currently In" : "Currently Out"}
                  </Badge>
                  {isClockedIn && attendanceToday?.clock_in_at && (
                    <span className="text-xs text-muted-foreground font-semibold">
                      In since {formatTime(attendanceToday.clock_in_at)}
                    </span>
                  )}
                </div>

                <div className="text-xs flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {coords ? (
                    <span>Coordinates detected</span>
                  ) : (
                    <span>Location not detected</span>
                  )}
                  <button 
                    onClick={() => detectLocation().catch(() => {})}
                    disabled={detecting}
                    className="ml-auto text-primary hover:underline font-bold flex items-center gap-1 text-[10px] cursor-pointer"
                  >
                    <RefreshCw className={detecting ? "h-3 w-3 animate-spin" : "h-3 w-3"} /> Detect
                  </button>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => clockIn.mutate()}
                    disabled={busy || isClockedIn}
                    className="flex-1 font-semibold cursor-pointer shadow-sm text-xs"
                    style={{ background: isClockedIn ? "var(--border)" : "var(--gradient-brand)" }}
                  >
                    Clock In
                  </Button>
                  <Button
                    onClick={() => clockOut.mutate()}
                    disabled={busy || !isClockedIn}
                    variant="secondary"
                    className="flex-1 font-semibold cursor-pointer border border-border/60 text-xs"
                  >
                    Clock Out
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upcoming Holidays widget */}
          <Card className="border border-border/50 bg-card shadow-soft">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" /> Upcoming Holidays
              </CardTitle>
              <CardDescription className="text-xs">Next official organization public holidays.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 p-0">
              {holidays.length === 0 ? (
                <p className="p-6 text-xs text-muted-foreground text-center">No upcoming holidays scheduled.</p>
              ) : (
                <div className="divide-y divide-border/40">
                  {holidays.map((h: any, idx: number) => (
                    <div key={idx} className="px-5 py-3.5 flex items-center justify-between text-sm hover:bg-muted/5 transition-colors">
                      <div className="space-y-0.5">
                        <span className="font-bold text-xs text-foreground block tracking-tight">{h.name}</span>
                        <span className="text-[10px] text-muted-foreground font-semibold">
                          {new Date(h.date).toLocaleDateString("en-US", { weekday: "long" })}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md">
                        {new Date(h.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}

// Subcomponents
function StatCard({
  icon: Icon,
  title,
  value,
  subtitle,
  href,
  accent
}: {
  icon: any;
  title: string;
  value: string;
  subtitle?: string;
  href: string;
  accent?: boolean;
}) {
  return (
    <Link to={href} className="block h-full">
      <Card className="border-border/50 shadow-soft bg-card hover:-translate-y-0.5 hover:shadow-md hover:border-primary/20 transition-all duration-300 h-full">
        <CardContent className="p-5 flex items-center gap-4">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
            style={accent ? { background: "var(--gradient-brand)" } : { background: "var(--gradient-subtle)", border: "1px solid var(--border)" }}
          >
            <Icon className={"h-4.5 w-4.5 " + (accent ? "text-white" : "text-primary")} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold tracking-tight mt-0.5">{value}</p>
            {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{subtitle}</p>}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function QuickActionCard({
  to,
  icon: Icon,
  title,
  desc
}: {
  to: string;
  icon: any;
  title: string;
  desc: string;
}) {
  return (
    <Link to={to} className="block group">
      <div className="p-4 rounded-xl border border-border/50 bg-muted/15 group-hover:bg-primary/5 group-hover:border-primary/20 transition-all duration-300 text-center h-full flex flex-col items-center justify-center">
        <div className="h-10 w-10 rounded-lg bg-card border border-border/60 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
          <Icon className="h-4.5 w-4.5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <span className="font-bold text-xs block text-foreground tracking-tight">{title}</span>
        <span className="text-[10px] text-muted-foreground mt-0.5 font-medium leading-tight block">
          {desc}
        </span>
      </div>
    </Link>
  );
}