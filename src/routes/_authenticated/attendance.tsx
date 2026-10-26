import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  MapPin,
  Clock,
  LogIn,
  LogOut,
  RefreshCw,
  FileCheck2,
  FileText,
  CalendarDays,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

type AttendanceRecord = {
  id: string;
  user_id: string;
  employee_email: string;
  employee_name?: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  total_seconds: number | null;
  location?: string | null;
  is_regularised?: boolean;
  created_at: string;
};

type LatestResponse = { records: AttendanceRecord[] };

type RegularisationItem = {
  id: string;
  user_id: string;
  employee_name: string;
  employee_email: string;
  request_date: string;
  requested_clock_in: string;
  requested_clock_out: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  attendance_id: string | null;
  rejection_reason: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "Attendance & Login History — HRMS" }] }),
  component: AttendancePage,
});

function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string | null | undefined | Date) {
  if (!iso) return "—";
  const d = iso instanceof Date ? iso : new Date(iso);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function dayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayKeyFromIso(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : dayKey(d);
}

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

function AttendancePage() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const userRole = (role ?? "").toLowerCase().trim();
  const isAdminOrHr = userRole === "admin" || userRole === "hr";

  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Regularisation Modal State
  const [regModalOpen, setRegModalOpen] = useState(false);
  const [regDate, setRegDate] = useState<string>(dayKey(new Date()));
  const [regClockIn, setRegClockIn] = useState<string>("09:30");
  const [regClockOut, setRegClockOut] = useState<string>("18:30");
  const [regReason, setRegReason] = useState<string>("");

  // Query personal attendance records (scope="me" ensures accurate personal history)
  const latest = useQuery({
    queryKey: ["attendance", "latest", "me"],
    queryFn: () =>
      api<LatestResponse>("/attendance/latest", {
        query: { limit: 200, scope: "me" },
      }),
  });

  // Query personal regularisation requests
  const myRegsQuery = useQuery({
    queryKey: ["attendance-regularisations", "my"],
    queryFn: () => api<{ requests: RegularisationItem[] }>("/attendance/regularisation/my"),
  });

  const records = latest.data?.records ?? [];
  const sorted = useMemo(
    () =>
      [...records].sort(
        (a, b) =>
          new Date(b.clock_in_at ?? b.created_at).getTime() -
          new Date(a.clock_in_at ?? a.created_at).getTime(),
      ),
    [records],
  );
  const current = sorted[0];
  const isClockedIn = !!(current?.clock_in_at && !current?.clock_out_at);

  const grouped = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>();
    for (const r of records) {
      const k = dayKeyFromIso(r.clock_in_at ?? r.created_at);
      if (!k) continue;
      const arr = map.get(k) ?? [];
      arr.push(r);
      map.set(k, arr);
    }
    return map;
  }, [records]);

  const todayKey = dayKey(new Date());
  const todaySessions = grouped.get(todayKey) ?? [];
  const todaySeconds = todaySessions.reduce((s, r) => s + (r.total_seconds ?? 0), 0);

  const markedDays = useMemo(
    () =>
      Array.from(grouped.keys()).map((k) => {
        const [y, m, d] = k.split("-").map(Number);
        return new Date(y, m - 1, d);
      }),
    [grouped],
  );
  const selectedKey = dayKey(selectedDate);
  const selectedSessions = grouped.get(selectedKey) ?? [];

  const detectLocation = async () => {
    setDetecting(true);
    setLocationName(null);
    try {
      const c = await getLocation();
      setCoords(c);

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${c.lat}&lon=${c.lon}`,
        );
        const data = await res.json();
        if (data && data.address) {
          const { road, neighbourhood, suburb, city, town, village, state, postcode } =
            data.address;
          const street = road || neighbourhood;
          const locality = city || town || village || suburb;
          const parts = [street, locality, state, postcode].filter(Boolean);
          if (parts.length > 0) {
            setLocationName(parts.join(", "));
          } else {
            setLocationName(data.display_name || null);
          }
        }
      } catch (err) {
        // Fallback to coordinates
      }

      return c;
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    } finally {
      setDetecting(false);
    }
  };

  const clockIn = useMutation({
    mutationFn: async () => {
      const c = await detectLocation();
      return api("/attendance/clockin", {
        method: "POST",
        body: { lat: c.lat, lon: c.lon, device: navigator.userAgent },
      });
    },
    onSuccess: () => {
      toast.success("Clock-in recorded successfully!");
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
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
        body: { lat: c.lat, lon: c.lon, device: navigator.userAgent },
      });
    },
    onSuccess: () => {
      toast.success("Clock-out recorded successfully!");
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (e: Error) => {
      if (!detecting) toast.error(e.message);
    },
  });

  // Regularisation Apply Mutation
  const applyRegularisation = useMutation({
    mutationFn: async () => {
      if (!regDate) throw new Error("Please select a date.");
      if (!regClockIn || !regClockOut) throw new Error("Please specify check-in and check-out times.");
      if (!regReason.trim()) throw new Error("Please provide a reason for regularisation.");

      const inDateTime = new Date(`${regDate}T${regClockIn}:00`);
      const outDateTime = new Date(`${regDate}T${regClockOut}:00`);

      if (outDateTime <= inDateTime) {
        throw new Error("Check-out time must be after check-in time.");
      }

      return api("/attendance/regularisation/apply", {
        method: "POST",
        body: {
          request_date: regDate,
          requested_clock_in: inDateTime.toISOString(),
          requested_clock_out: outDateTime.toISOString(),
          reason: regReason.trim(),
        },
      });
    },
    onSuccess: () => {
      toast.success("Attendance regularisation request submitted for approval!");
      qc.invalidateQueries({ queryKey: ["attendance-regularisations"] });
      setRegModalOpen(false);
      setRegReason("");
    },
    onError: (e: any) => {
      toast.error(e.message || "Failed to submit regularisation request.");
    },
  });

  const busy = clockIn.isPending || clockOut.isPending || detecting;
  const myRegs = myRegsQuery.data?.requests ?? [];

  return (
    <div className="space-y-6">
      {/* Header with Title and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance & Work Sessions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Clock in and out, track your daily check-in history, and submit attendance regularisations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => {
              setRegDate(dayKey(new Date()));
              setRegModalOpen(true);
            }}
            variant="outline"
            size="sm"
            className="cursor-pointer shadow-2xs font-semibold gap-1.5"
          >
            <PlusCircle className="h-4 w-4 text-primary" />
            Request Regularisation
          </Button>

          {isAdminOrHr && (
            <Link to="/attendance-report">
              <Button size="sm" className="cursor-pointer shadow-2xs font-semibold gap-1.5">
                <FileText className="h-4 w-4" />
                Attendance Report Module
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Status & Today Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Clock In / Out Controller Card */}
        <Card className="shadow-2xs">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Clock className="size-4 text-primary" /> Current Session Status
            </CardTitle>
            <CardDescription className="text-xs">Your live attendance punch status for today.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              {isClockedIn ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs px-2.5 py-1">
                  <span className="mr-1.5 inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
                  Clocked In Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs px-2.5 py-1">
                  Clocked Out
                </Badge>
              )}
              {current && (
                <span className="text-xs text-muted-foreground">
                  {isClockedIn ? "Checked in at " : "Last out at "}
                  <strong className="text-foreground">
                    {formatTime(isClockedIn ? current.clock_in_at : current.clock_out_at)}
                  </strong>{" "}
                  · {formatDate(current.clock_in_at ?? current.created_at)}
                </span>
              )}
            </div>

            <div className="text-xs flex items-center gap-2 text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/50">
              <MapPin className="size-4 shrink-0 text-primary" />
              {coords ? (
                <span
                  className="truncate"
                  title={locationName || `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`}
                >
                  {locationName || `Lat: ${coords.lat.toFixed(4)}, Lon: ${coords.lon.toFixed(4)}`}
                </span>
              ) : (
                <span>Location ready to detect on punch</span>
              )}
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer disabled:opacity-50"
                onClick={() => detectLocation().catch(() => {})}
                disabled={detecting}
              >
                <RefreshCw className={detecting ? "size-3 animate-spin" : "size-3"} />
                {detecting ? "Locating…" : "Detect Location"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-1">
              <Button
                onClick={() => clockIn.mutate()}
                disabled={busy || isClockedIn}
                className="font-semibold text-xs h-9 px-4 cursor-pointer"
              >
                <LogIn className="size-4 mr-1" />
                {clockIn.isPending
                  ? "Clocking in…"
                  : detecting && !clockOut.isPending
                    ? "Verifying GPS…"
                    : "Clock In"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => clockOut.mutate()}
                disabled={busy || !isClockedIn}
                className="font-semibold text-xs h-9 px-4 cursor-pointer"
              >
                <LogOut className="size-4 mr-1" />
                {clockOut.isPending ? "Clocking out…" : "Clock Out"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Today's Working Hours Card */}
        <Card className="shadow-2xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">Today's Summary</CardTitle>
            <CardDescription className="text-xs">
              Recorded work hours for {formatDate(new Date())}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/40 p-3 rounded-lg border border-border/40">
                <div className="text-2xl font-black text-foreground">
                  {formatDuration(todaySeconds)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 font-medium">Hours Logged</div>
              </div>
              <div className="bg-muted/40 p-3 rounded-lg border border-border/40">
                <div className="text-2xl font-black text-foreground">{todaySessions.length}</div>
                <div className="text-xs text-muted-foreground mt-0.5 font-medium">Punch Sessions</div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground border-t border-border/60 pt-2.5 flex items-center justify-between">
              <span>
                {current?.clock_in_at ? (
                  <>
                    First punch: <strong>{formatTime(todaySessions[todaySessions.length - 1]?.clock_in_at)}</strong>
                  </>
                ) : (
                  "No punch recorded yet today."
                )}
              </span>
              <span className="text-[11px] text-primary font-semibold">Standard shift: 9h</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Calendar & Logs vs My Regularisation Requests */}
      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList className="bg-muted/70 p-1 rounded-lg">
          <TabsTrigger value="calendar" className="text-xs font-bold gap-2">
            <CalendarDays className="h-3.5 w-3.5" />
            Attendance Calendar & History
          </TabsTrigger>
          <TabsTrigger value="regularisations" className="text-xs font-bold gap-2">
            <FileCheck2 className="h-3.5 w-3.5" />
            My Regularisation Requests ({myRegs.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Calendar and Recent Punch Activity */}
        <TabsContent value="calendar" className="space-y-4">
          <Card className="shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Attendance Calendar</CardTitle>
              <CardDescription className="text-xs">
                Days with attendance are indicated. Click any date to view individual session timestamps.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[auto_1fr]">
              <div className="rounded-md border bg-card p-2 w-fit">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  modifiers={{ hasRecord: markedDays }}
                  modifiersClassNames={{
                    hasRecord:
                      "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:size-1 after:rounded-full after:bg-primary",
                  }}
                  className="pointer-events-auto"
                />
              </div>

              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Sessions on{" "}
                  {selectedDate.toLocaleDateString("en-GB", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>

                {selectedSessions.length === 0 ? (
                  <div className="text-xs text-muted-foreground rounded-lg border border-dashed p-6 text-center space-y-2">
                    <Clock className="h-6 w-6 text-muted-foreground/40 mx-auto" />
                    <p className="font-semibold text-foreground">No attendance punches for this date</p>
                    <p>Missed clocking in or out? Submit a regularisation request to reconcile this day.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs mt-2"
                      onClick={() => {
                        setRegDate(dayKey(selectedDate));
                        setRegModalOpen(true);
                      }}
                    >
                      Regularise This Day
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedSessions.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between rounded-lg border bg-card p-3 shadow-2xs"
                      >
                        <div className="text-xs">
                          <span className="font-bold text-foreground">{formatTime(r.clock_in_at)}</span>
                          <span className="text-muted-foreground"> → </span>
                          <span className="font-bold text-foreground">{formatTime(r.clock_out_at)}</span>
                          {r.location && (
                            <span className="block text-[11px] text-muted-foreground truncate max-w-[260px] mt-0.5">
                              {r.location}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">
                            {formatDuration(r.total_seconds)}
                          </span>
                          {r.clock_out_at ? (
                            <Badge variant="secondary" className="text-[10px]">
                              Completed
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px]">
                              In Progress
                            </Badge>
                          )}
                          {r.is_regularised && (
                            <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 text-[10px]">
                              Regularised
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Activity Log Table */}
          <Card className="shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-base font-bold">Personal Login & Logout History</CardTitle>
              <CardDescription className="text-xs">
                Your past clock-in and clock-out activity records.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {latest.isLoading ? (
                <p className="text-xs text-muted-foreground p-6">Loading records…</p>
              ) : sorted.length === 0 ? (
                <p className="text-xs text-muted-foreground p-6">No attendance records found yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs font-bold">Date</TableHead>
                        <TableHead className="text-xs font-bold">Clock In (Login)</TableHead>
                        <TableHead className="text-xs font-bold">Clock Out (Logout)</TableHead>
                        <TableHead className="text-xs font-bold">Duration</TableHead>
                        <TableHead className="text-xs font-bold">Punch Location</TableHead>
                        <TableHead className="text-xs font-bold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sorted.slice(0, 50).map((r) => (
                        <TableRow key={r.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="text-xs font-medium">
                            {formatDate(r.clock_in_at ?? r.created_at)}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            {formatTime(r.clock_in_at)}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-amber-700 dark:text-amber-400">
                            {formatTime(r.clock_out_at)}
                          </TableCell>
                          <TableCell className="text-xs font-bold">
                            {formatDuration(r.total_seconds)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={r.location || ""}>
                            {r.location || "Standard"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {r.clock_out_at ? (
                                <Badge variant="secondary" className="text-[10px]">
                                  Completed
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px]">
                                  <span className="mr-1 inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Active
                                </Badge>
                              )}
                              {r.is_regularised && (
                                <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 text-[10px]">
                                  Regularised
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: My Regularisation Requests */}
        <TabsContent value="regularisations">
          <Card className="shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">My Attendance Regularisations</CardTitle>
                  <CardDescription className="text-xs">
                    Submitted requests to correct missed clock-ins or clock-outs.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setRegDate(dayKey(new Date()));
                    setRegModalOpen(true);
                  }}
                  className="text-xs font-semibold"
                >
                  <PlusCircle className="h-3.5 w-3.5 mr-1" />
                  New Request
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {myRegsQuery.isLoading ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Loading regularisation requests...
                </div>
              ) : myRegs.length === 0 ? (
                <div className="p-10 text-center text-xs text-muted-foreground space-y-2">
                  <FileCheck2 className="mx-auto h-7 w-7 text-muted-foreground/40" />
                  <p className="font-semibold text-foreground">No regularisation requests submitted</p>
                  <p>If you missed clocking in or out on any day, submit a regularisation request.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs font-bold">Target Date</TableHead>
                        <TableHead className="text-xs font-bold">Requested Shift</TableHead>
                        <TableHead className="text-xs font-bold">Reason</TableHead>
                        <TableHead className="text-xs font-bold">Submitted On</TableHead>
                        <TableHead className="text-xs font-bold">Review Status</TableHead>
                        <TableHead className="text-xs font-bold">Review Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myRegs.map((reg) => (
                        <TableRow key={reg.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="text-xs font-bold text-foreground">
                            {formatDate(reg.request_date)}
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {formatTime(reg.requested_clock_in)} → {formatTime(reg.requested_clock_out)}
                          </TableCell>
                          <TableCell className="text-xs text-foreground max-w-[220px]">
                            {reg.reason}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(reg.created_at)}
                          </TableCell>
                          <TableCell>
                            {reg.status === "approved" ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px]">
                                Approved
                              </Badge>
                            ) : reg.status === "rejected" ? (
                              <Badge variant="destructive" className="text-[10px]">
                                Rejected
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px]">
                                Pending Approval
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {reg.rejection_reason || (reg.status === "approved" ? "Approved by Manager" : "Under review")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Regularisation Request Modal */}
      <Dialog open={regModalOpen} onOpenChange={setRegModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Request Attendance Regularisation
            </DialogTitle>
            <DialogDescription className="text-xs">
              Submit your actual check-in and check-out timings if you missed logging in or out.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Date of Attendance</Label>
              <Input
                type="date"
                value={regDate}
                max={dayKey(new Date())}
                onChange={(e) => setRegDate(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Requested Clock In</Label>
                <Input
                  type="time"
                  value={regClockIn}
                  onChange={(e) => setRegClockIn(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Requested Clock Out</Label>
                <Input
                  type="time"
                  value={regClockOut}
                  onChange={(e) => setRegClockOut(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Reason for Regularisation</Label>
              <Textarea
                placeholder="e.g. Forgot to clock in upon arrival, client location visit, or biometric device offline."
                value={regReason}
                onChange={(e) => setRegReason(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRegModalOpen(false)}
              disabled={applyRegularisation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={applyRegularisation.isPending || !regReason.trim()}
              onClick={() => applyRegularisation.mutate()}
            >
              {applyRegularisation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AttendancePage;
