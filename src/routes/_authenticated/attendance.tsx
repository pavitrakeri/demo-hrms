import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { MapPin, Clock, LogIn, LogOut, RefreshCw } from "lucide-react";

type AttendanceRecord = {
  id: string;
  user_id: string;
  employee_email: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  total_seconds: number | null;
  created_at: string;
};

type LatestResponse = { records: AttendanceRecord[] };

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "Attendance — HRMS" }] }),
  component: AttendancePage,
});

function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds < 0) return "—";
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
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const latest = useQuery({
    queryKey: ["attendance", "latest", 200],
    queryFn: () => api<LatestResponse>("/attendance/latest", { query: { limit: 200 } }),
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
        // Silently fail, it will fallback to coords
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
      toast.success("Clocked in");
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (e: Error) => {
      // detect errors already toasted; only toast API errors
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
      toast.success("Clocked out");
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (e: Error) => {
      if (!detecting) toast.error(e.message);
    },
  });

  const busy = clockIn.isPending || clockOut.isPending || detecting;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          Clock in and out, and review your attendance history.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4" /> Current status
            </CardTitle>
            <CardDescription>Your most recent attendance entry.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              {isClockedIn ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  <span className="mr-1.5 inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
                  Clocked in
                </Badge>
              ) : (
                <Badge variant="secondary">Clocked out</Badge>
              )}
              {current && (
                <span className="text-sm text-muted-foreground">
                  {isClockedIn ? "Since " : "Last out "}
                  {formatTime(isClockedIn ? current.clock_in_at : current.clock_out_at)} ·{" "}
                  {formatDate(current.clock_in_at ?? current.created_at)}
                </span>
              )}
            </div>

            <div className="text-sm flex items-center gap-2 text-muted-foreground">
              <MapPin className="size-4 shrink-0" />
              {coords ? (
                <span
                  className="truncate"
                  title={locationName || `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`}
                >
                  {locationName
                    ? locationName
                    : `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`}
                </span>
              ) : (
                <span>Location not detected yet</span>
              )}
              <button
                type="button"
                className="ml-2 inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                onClick={() => detectLocation().catch(() => {})}
                disabled={detecting}
              >
                <RefreshCw className={detecting ? "size-3 animate-spin" : "size-3"} />
                {detecting ? "Detecting…" : "Refresh"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={() => clockIn.mutate()} disabled={busy || isClockedIn}>
                <LogIn className="size-4" />
                {clockIn.isPending
                  ? "Clocking in…"
                  : detecting && !clockOut.isPending
                    ? "Detecting location…"
                    : "Clock in"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => clockOut.mutate()}
                disabled={busy || !isClockedIn}
              >
                <LogOut className="size-4" />
                {clockOut.isPending ? "Clocking out…" : "Clock out"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today</CardTitle>
            <CardDescription>Summary for {formatDate(new Date())}.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-semibold">{formatDuration(todaySeconds)}</div>
              <div className="text-xs text-muted-foreground mt-1">Hours worked</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">{todaySessions.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Sessions</div>
            </div>
            <div className="col-span-2 text-sm text-muted-foreground border-t pt-3">
              {current ? (
                <>
                  Latest: {formatTime(current.clock_in_at)} → {formatTime(current.clock_out_at)} ·{" "}
                  {formatDuration(current.total_seconds)}
                </>
              ) : (
                <>No attendance yet.</>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance calendar</CardTitle>
          <CardDescription>
            Days with attendance are highlighted. Select a date to see its sessions.
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
            <div className="text-sm font-medium mb-3">
              {selectedDate.toLocaleDateString("en-GB", {
                weekday: "long",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
            {selectedSessions.length === 0 ? (
              <div className="text-sm text-muted-foreground rounded-md border border-dashed p-6 text-center">
                No attendance records for this day.
              </div>
            ) : (
              <div className="space-y-2">
                {selectedSessions.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-md border bg-card p-3"
                  >
                    <div className="text-sm">
                      <span className="font-medium">{formatTime(r.clock_in_at)}</span>
                      <span className="text-muted-foreground"> → </span>
                      <span className="font-medium">{formatTime(r.clock_out_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {formatDuration(r.total_seconds)}
                      </span>
                      {r.clock_out_at ? (
                        <Badge variant="secondary">Completed</Badge>
                      ) : (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          In progress
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

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Your latest attendance records.</CardDescription>
        </CardHeader>
        <CardContent>
          {latest.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attendance records yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock in</TableHead>
                  <TableHead>Clock out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.slice(0, 30).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.clock_in_at ?? r.created_at)}</TableCell>
                    <TableCell>{formatTime(r.clock_in_at)}</TableCell>
                    <TableCell>{formatTime(r.clock_out_at)}</TableCell>
                    <TableCell>{formatDuration(r.total_seconds)}</TableCell>
                    <TableCell>
                      {r.clock_out_at ? (
                        <Badge variant="secondary">Completed</Badge>
                      ) : (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          In progress
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
