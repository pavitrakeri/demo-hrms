import { useState, useMemo } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Clock,
  Users,
  Building2,
  Calendar,
  Search,
  Download,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  ShieldAlert,
  ArrowRight,
  FileCheck2,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/attendance-report")({
  head: () => ({ meta: [{ title: "Attendance Report — Aimwear HRMS" }] }),
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getToken()) {
      throw redirect({ to: "/login" });
    }
  },
  component: AttendanceReportPage,
});

type ReportRow = {
  id: string;
  user_id: string;
  employee_name: string;
  employee_email: string;
  department_id: string | null;
  department_name: string;
  date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  total_seconds: number | null;
  location: string | null;
  is_regularised: boolean;
  status: "completed" | "in_progress";
  created_at: string | null;
};

type ReportSummary = {
  total_records: number;
  completed_sessions: number;
  in_progress_sessions: number;
  total_seconds: number;
  average_seconds: number;
  unique_employees_present: number;
  pending_regularisations: number;
};

type ReportResponse = {
  summary: ReportSummary;
  records: ReportRow[];
  total_count: number;
};

type RegularisationItem = {
  id: string;
  user_id: string;
  employee_name: string;
  employee_email: string;
  department_name: string;
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

function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function AttendanceReportPage() {
  const qc = useQueryClient();
  const { role, permissions } = useAuth();
  const userRole = (role ?? "").toLowerCase().trim();
  const isAuthorized =
    userRole === "admin" ||
    userRole === "hr" ||
    permissions.includes("manage_attendance") ||
    permissions.includes("manage_employees");

  // Filters State
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [employeeId, setEmployeeId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("logs");

  // Action Dialog State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedRegId, setSelectedRegId] = useState<string | null>(null);

  // Quick Preset Handlers
  const handlePreset = (type: "today" | "yesterday" | "this_week" | "this_month" | "clear") => {
    const today = new Date();
    if (type === "today") {
      const s = toISODate(today);
      setFromDate(s);
      setToDate(s);
    } else if (type === "yesterday") {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      const s = toISODate(y);
      setFromDate(s);
      setToDate(s);
    } else if (type === "this_week") {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const start = new Date(today.setDate(diff));
      setFromDate(toISODate(start));
      setToDate(toISODate(new Date()));
    } else if (type === "this_month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setFromDate(toISODate(start));
      setToDate(toISODate(new Date()));
    } else {
      setFromDate("");
      setToDate("");
      setDepartmentId("all");
      setEmployeeId("all");
      setStatusFilter("all");
      setSearchQuery("");
    }
  };

  // Queries
  const reportQuery = useQuery({
    queryKey: [
      "attendance-report",
      fromDate,
      toDate,
      departmentId,
      employeeId,
      statusFilter,
      searchQuery,
    ],
    queryFn: () => {
      const query: Record<string, string | number | undefined> = { limit: 500 };
      if (fromDate) query.from_date = fromDate;
      if (toDate) query.to_date = toDate;
      if (departmentId && departmentId !== "all") query.department_id = departmentId;
      if (employeeId && employeeId !== "all") query.employee_id = employeeId;
      if (statusFilter && statusFilter !== "all") query.status = statusFilter;
      if (searchQuery.trim()) query.search = searchQuery.trim();
      return api<ReportResponse>("/attendance/report", { query });
    },
    enabled: isAuthorized,
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments", "list"],
    queryFn: () => api<{ departments: { id: string; name: string }[] }>("/departments/list"),
    enabled: isAuthorized,
  });

  const employeesQuery = useQuery({
    queryKey: ["employees", "list"],
    queryFn: () => api<{ employees: { id: string; full_name: string; email: string }[] }>("/employees/list"),
    enabled: isAuthorized,
  });

  const regularisationsQuery = useQuery({
    queryKey: ["attendance-regularisations", "all"],
    queryFn: () => api<{ requests: RegularisationItem[] }>("/attendance/regularisation/all"),
    enabled: isAuthorized,
  });

  // Action Mutation
  const regularisationAction = useMutation({
    mutationFn: async ({
      id,
      action,
      rejection_reason,
    }: {
      id: string;
      action: "approve" | "reject";
      rejection_reason?: string;
    }) => {
      return api(`/attendance/regularisation/${id}/action`, {
        method: "POST",
        body: { action, rejection_reason },
      });
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.action === "approve"
          ? "Regularisation request approved successfully"
          : "Regularisation request rejected",
      );
      qc.invalidateQueries({ queryKey: ["attendance-regularisations"] });
      qc.invalidateQueries({ queryKey: ["attendance-report"] });
      setRejectModalOpen(false);
      setRejectReason("");
      setSelectedRegId(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to process request");
    },
  });

  const summary = reportQuery.data?.summary;
  const records = reportQuery.data?.records ?? [];
  const departments = departmentsQuery.data?.departments ?? [];
  const employees = employeesQuery.data?.employees ?? [];
  const regularisations = regularisationsQuery.data?.requests ?? [];
  const pendingRegsCount = regularisations.filter((r) => r.status === "pending").length;

  // CSV Export Function
  const exportToCSV = () => {
    if (records.length === 0) {
      toast.info("No records to export.");
      return;
    }

    const headers = [
      "Employee Name",
      "Email",
      "Department",
      "Date",
      "Clock In",
      "Clock Out",
      "Duration (Hours)",
      "Location",
      "Status",
      "Regularised",
    ];

    const csvRows = [headers.join(",")];

    for (const r of records) {
      const row = [
        `"${(r.employee_name || "").replace(/"/g, '""')}"`,
        `"${r.employee_email || ""}"`,
        `"${(r.department_name || "").replace(/"/g, '""')}"`,
        r.date,
        formatTime(r.clock_in_at),
        formatTime(r.clock_out_at),
        formatDuration(r.total_seconds),
        `"${(r.location || "").replace(/"/g, '""')}"`,
        r.status,
        r.is_regularised ? "Yes" : "No",
      ];
      csvRows.push(row.join(","));
    }

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `attendance_report_${fromDate || "all"}_to_${toDate || "latest"}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Attendance report downloaded successfully!");
  };

  // Unauthorized screen protection
  if (!isAuthorized) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-border/80 shadow-lg text-center p-6 space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Access Restricted</h2>
            <p className="text-sm text-muted-foreground mt-1">
              The Attendance Report module is exclusively available to System Administrators and HR
              Managers.
            </p>
          </div>
          <Link to="/attendance">
            <Button className="w-full mt-2" variant="outline">
              Go to My Attendance <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Title and CSV Export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">Attendance Report</h1>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs">
              Admin & HR Module
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            View employee check-in/out records, filter history by department, and review regularisations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Button
            onClick={exportToCSV}
            variant="outline"
            size="sm"
            className="cursor-pointer shadow-2xs font-semibold gap-1.5"
            disabled={reportQuery.isLoading || records.length === 0}
          >
            <Download className="h-4 w-4 text-primary" />
            Export CSV
          </Button>
          <Button
            onClick={() => {
              reportQuery.refetch();
              regularisationsQuery.refetch();
            }}
            variant="outline"
            size="sm"
            className="cursor-pointer shadow-2xs font-semibold gap-1.5"
          >
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        <Card className="shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Sessions</p>
              <h3 className="text-2xl font-bold tracking-tight mt-0.5">
                {summary ? summary.total_records : "—"}
              </h3>
            </div>
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active Clocked In</p>
              <h3 className="text-2xl font-bold tracking-tight mt-0.5 text-emerald-600">
                {summary ? summary.in_progress_sessions : "—"}
              </h3>
            </div>
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <span className="size-3 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Employees Present</p>
              <h3 className="text-2xl font-bold tracking-tight mt-0.5">
                {summary ? summary.unique_employees_present : "—"}
              </h3>
            </div>
            <div className="h-9 w-9 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Avg Hours / Day</p>
              <h3 className="text-2xl font-bold tracking-tight mt-0.5">
                {summary ? formatDuration(summary.average_seconds) : "—"}
              </h3>
            </div>
            <div className="h-9 w-9 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`shadow-2xs cursor-pointer transition-all ${
            pendingRegsCount > 0 ? "border-amber-300 bg-amber-50/40 dark:bg-amber-950/20" : ""
          }`}
          onClick={() => setActiveTab("regularisations")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Pending Regularisations</p>
              <h3 className="text-2xl font-bold tracking-tight mt-0.5 text-amber-600">
                {pendingRegsCount}
              </h3>
            </div>
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <FileCheck2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Filter Section */}
      <Card className="shadow-2xs border-border/80">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Filter Attendance Records
              </span>
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePreset("today")}
                className="h-7 text-xs font-medium px-2.5"
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePreset("yesterday")}
                className="h-7 text-xs font-medium px-2.5"
              >
                Yesterday
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePreset("this_week")}
                className="h-7 text-xs font-medium px-2.5"
              >
                This Week
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePreset("this_month")}
                className="h-7 text-xs font-medium px-2.5"
              >
                This Month
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePreset("clear")}
                className="h-7 text-xs font-medium text-muted-foreground hover:text-foreground px-2"
              >
                Clear Filters
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Search Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Search Employee</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-8 text-xs rounded-md"
                />
              </div>
            </div>

            {/* Department Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Employee Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Specific Employee</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Session Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed Punch</SelectItem>
                  <SelectItem value="in_progress">Clocked In (Active)</SelectItem>
                  <SelectItem value="regularised">Regularised Entry</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Inputs */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Date Range</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-9 text-xs px-2"
                  title="From date"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-9 text-xs px-2"
                  title="To date"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Detailed Log vs Regularisation Approvals */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/70 p-1 rounded-lg">
          <TabsTrigger value="logs" className="text-xs font-bold gap-2">
            <Clock className="h-3.5 w-3.5" />
            Attendance Logs ({records.length})
          </TabsTrigger>
          <TabsTrigger value="regularisations" className="text-xs font-bold gap-2">
            <FileCheck2 className="h-3.5 w-3.5" />
            Regularisation Approvals
            {pendingRegsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-bold">
                {pendingRegsCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Attendance Log Table */}
        <TabsContent value="logs">
          <Card className="shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-base font-bold">Attendance Records</CardTitle>
              <CardDescription className="text-xs">
                Showing {records.length} punch records matching your filter criteria.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {reportQuery.isLoading ? (
                <div className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span>Loading attendance logs...</span>
                </div>
              ) : records.length === 0 ? (
                <div className="p-12 text-center text-sm text-muted-foreground space-y-2">
                  <Clock className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="font-semibold text-foreground">No attendance records found</p>
                  <p className="text-xs">Try clearing filters or selecting another date range.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs font-bold">Employee</TableHead>
                        <TableHead className="text-xs font-bold">Department</TableHead>
                        <TableHead className="text-xs font-bold">Date</TableHead>
                        <TableHead className="text-xs font-bold">Clock In</TableHead>
                        <TableHead className="text-xs font-bold">Clock Out</TableHead>
                        <TableHead className="text-xs font-bold">Duration</TableHead>
                        <TableHead className="text-xs font-bold">Location / Device</TableHead>
                        <TableHead className="text-xs font-bold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((r) => (
                        <TableRow key={r.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-foreground">
                                {r.employee_name}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {r.employee_email}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[11px] font-normal">
                              {r.department_name}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {formatDate(r.date)}
                          </TableCell>
                          <TableCell className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            {formatTime(r.clock_in_at)}
                          </TableCell>
                          <TableCell className="text-xs font-medium text-amber-700 dark:text-amber-400">
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
                              {r.status === "completed" ? (
                                <Badge variant="secondary" className="text-[10px]">
                                  Completed
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px]">
                                  <span className="mr-1 inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Clocked In
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

        {/* TAB 2: Regularisation Approvals */}
        <TabsContent value="regularisations">
          <Card className="shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold">
                    Attendance Regularisation Requests
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Employees submit regularisation requests when they miss punching in or out.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="w-fit text-xs font-semibold">
                  {pendingRegsCount} Pending Approval
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {regularisationsQuery.isLoading ? (
                <div className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span>Loading regularisation requests...</span>
                </div>
              ) : regularisations.length === 0 ? (
                <div className="p-12 text-center text-sm text-muted-foreground space-y-2">
                  <FileCheck2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="font-semibold text-foreground">No regularisation requests</p>
                  <p className="text-xs">All attendance records are currently reconciled.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs font-bold">Employee</TableHead>
                        <TableHead className="text-xs font-bold">Department</TableHead>
                        <TableHead className="text-xs font-bold">Target Date</TableHead>
                        <TableHead className="text-xs font-bold">Requested Timings</TableHead>
                        <TableHead className="text-xs font-bold">Reason</TableHead>
                        <TableHead className="text-xs font-bold">Submitted</TableHead>
                        <TableHead className="text-xs font-bold">Status</TableHead>
                        <TableHead className="text-xs font-bold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {regularisations.map((reg) => (
                        <TableRow key={reg.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-foreground">
                                {reg.employee_name}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {reg.employee_email}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[11px] font-normal">
                              {reg.department_name}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {formatDate(reg.request_date)}
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            <div className="flex flex-col">
                              <span>
                                {formatTime(reg.requested_clock_in)} → {formatTime(reg.requested_clock_out)}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                Total:{" "}
                                {formatDuration(
                                  Math.max(
                                    0,
                                    Math.floor(
                                      (new Date(reg.requested_clock_out).getTime() -
                                        new Date(reg.requested_clock_in).getTime()) /
                                        1000,
                                    ),
                                  ),
                                )}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px]">
                            <p className="line-clamp-2 text-foreground font-medium">{reg.reason}</p>
                            {reg.rejection_reason && (
                              <p className="text-[10px] text-destructive mt-0.5">
                                Remark: {reg.rejection_reason}
                              </p>
                            )}
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
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {reg.status === "pending" ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 cursor-pointer"
                                  disabled={regularisationAction.isPending}
                                  onClick={() =>
                                    regularisationAction.mutate({ id: reg.id, action: "approve" })
                                  }
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs bg-destructive/5 text-destructive border-destructive/20 hover:bg-destructive/15 cursor-pointer"
                                  disabled={regularisationAction.isPending}
                                  onClick={() => {
                                    setSelectedRegId(reg.id);
                                    setRejectModalOpen(true);
                                  }}
                                >
                                  <XCircle className="h-3.5 w-3.5 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">
                                {reg.reviewer_name ? `By ${reg.reviewer_name}` : "Processed"}
                              </span>
                            )}
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

      {/* Reject Reason Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" /> Reject Regularisation Request
            </DialogTitle>
            <DialogDescription className="text-xs">
              Provide a reason for rejecting this attendance regularisation request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs font-semibold">Rejection Reason</Label>
            <Textarea
              placeholder="e.g. Times specified do not align with biometric records or supervisor confirmation."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="text-xs"
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectModalOpen(false)}
              disabled={regularisationAction.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={regularisationAction.isPending || !rejectReason.trim()}
              onClick={() => {
                if (selectedRegId) {
                  regularisationAction.mutate({
                    id: selectedRegId,
                    action: "reject",
                    rejection_reason: rejectReason.trim(),
                  });
                }
              }}
            >
              {regularisationAction.isPending ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AttendanceReportPage;
