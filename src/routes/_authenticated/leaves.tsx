import { useMemo, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  Info,
  CalendarDays,
  UserCheck
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/leaves")({
  head: () => ({ meta: [{ title: "Leaves — HRMS" }] }),
  component: LeavesPage,
});

function LeavesPage() {
  const qc = useQueryClient();
  const { role } = useAuth();
  
  const userRole = (role ?? "").toLowerCase().trim();
  const canApprove = ["admin", "hr", "cfo"].includes(userRole);

  const [activeTab, setActiveTab] = useState("my_leaves");

  // Leave Form State
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState(""); // Managed dynamically from fetched leave types
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [halfDay, setHalfDay] = useState(false);
  const [halfDaySlot, setHalfDaySlot] = useState("first_half");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Approval/Rejection Dialog States
  const [actingLeaveId, setActingLeaveId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [comment, setComment] = useState("");

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });

  // Queries
  const { data: myLeavesData, isLoading: isLoadingMyLeaves } = useQuery({
    queryKey: ["leaves", "my"],
    queryFn: () => api<any[]>("/leaves/my"),
  });

  const { data: balanceData, isLoading: isLoadingBalance } = useQuery({
    queryKey: ["leaves", "balance"],
    queryFn: () => api<any>("/leaves/balance"),
  });

  const { data: approvalsData, isLoading: isLoadingApprovals } = useQuery({
    queryKey: ["leaves", "approvals"],
    queryFn: () => api<any[]>("/approvals/my"),
    enabled: canApprove,
  });

  const { data: calendarData, isLoading: isLoadingCalendar } = useQuery({
    queryKey: ["leaves", "calendar", currentMonth],
    queryFn: () => api<any>("/leave/calendar", { query: { month: currentMonth } }),
  });

  const { data: leaveTypes, isLoading: isLoadingLeaveTypes } = useQuery({
    queryKey: ["leave-types"],
    queryFn: () => api<any[]>("/settings/leave-types"),
  });

  useEffect(() => {
    if (leaveTypes && leaveTypes.length > 0 && !leaveTypeId) {
      setLeaveTypeId(String(leaveTypes[0].id));
    }
  }, [leaveTypes, leaveTypeId]);

  // Memos & Data Parsers
  const myLeaves = myLeavesData ?? [];
  const approvals = approvalsData ?? [];
  const calendar = calendarData ?? { holidays: [], approved_leaves: [] };

  const balancesList = useMemo(() => {
    if (!balanceData) return [];
    return Array.isArray(balanceData) 
      ? balanceData 
      : (balanceData.balances ?? balanceData.items ?? []);
  }, [balanceData]);

  // Date span calculator
  const daysCount = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diffTime = e.getTime() - s.getTime();
    if (diffTime < 0) return 0;
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    if (halfDay) {
      return Math.max(0.5, days - 0.5);
    }
    return days;
  }, [startDate, endDate, halfDay]);

  const selectedLeaveType = leaveTypes?.find((lt: any) => String(lt.id) === leaveTypeId);
  const showFileWarning = selectedLeaveType?.name?.toLowerCase() === "sick" && daysCount > 1;

  // Mutations
  const applyLeave = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("leave_type_id", leaveTypeId);
      fd.append("start_date", startDate);
      fd.append("end_date", endDate);
      fd.append("half_day", String(halfDay));
      if (halfDay && halfDaySlot) {
        fd.append("half_day_slot", halfDaySlot);
      }
      if (reason) {
        fd.append("reason", reason);
      }
      if (file) {
        fd.append("file", file);
      }

      return api("/leaves/apply", {
        method: "POST",
        formData: fd,
      });
    },
    onSuccess: () => {
      toast.success("Leave application submitted successfully");
      qc.invalidateQueries({ queryKey: ["leaves"] });
      setIsApplyOpen(false);
      // Reset form
      setStartDate("");
      setEndDate("");
      setHalfDay(false);
      setReason("");
      setFile(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelLeave = useMutation({
    mutationFn: (leaveId: string) => api(`/leaves/${leaveId}/cancel`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Leave cancelled successfully");
      qc.invalidateQueries({ queryKey: ["leaves"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMutation = useMutation({
    mutationFn: ({ leaveId, comment }: { leaveId: string; comment: string }) =>
      api(`/leaves/${leaveId}/approve`, {
        method: "POST",
        body: { comment },
      }),
    onSuccess: () => {
      toast.success("Leave request approved");
      qc.invalidateQueries({ queryKey: ["leaves"] });
      setActingLeaveId(null);
      setActionType(null);
      setComment("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ leaveId, comment }: { leaveId: string; comment: string }) =>
      api(`/leaves/${leaveId}/reject`, {
        method: "POST",
        body: { comment },
      }),
    onSuccess: () => {
      toast.success("Leave request rejected");
      qc.invalidateQueries({ queryKey: ["leaves"] });
      setActingLeaveId(null);
      setActionType(null);
      setComment("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Action decision dispatch
  const handleDecisionSubmit = () => {
    if (!actingLeaveId || !actionType) return;
    if (actionType === "approve") {
      approveMutation.mutate({ leaveId: actingLeaveId, comment });
    } else {
      rejectMutation.mutate({ leaveId: actingLeaveId, comment });
    }
  };

  // Calendar Helpers
  const handlePrevMonth = () => {
    const [y, m] = currentMonth.split("-").map(Number);
    const prev = new Date(y, m - 2, 1);
    const prevY = prev.getFullYear();
    const prevM = String(prev.getMonth() + 1).padStart(2, "0");
    setCurrentMonth(`${prevY}-${prevM}`);
  };

  const handleNextMonth = () => {
    const [y, m] = currentMonth.split("-").map(Number);
    const next = new Date(y, m, 1);
    const nextY = next.getFullYear();
    const nextM = String(next.getMonth() + 1).padStart(2, "0");
    setCurrentMonth(`${nextY}-${nextM}`);
  };

  // Render status badges
  const getStatusBadge = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1" variant="outline">
            <CheckCircle2 className="size-3.5" /> Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-rose-50 text-rose-700 border-rose-200 gap-1" variant="outline">
            <XCircle className="size-3.5" /> Rejected
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-slate-50 text-slate-600 border-slate-200 gap-1" variant="outline">
            <Clock className="size-3.5" /> Cancelled
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-50 text-amber-700 border-amber-200 gap-1" variant="outline">
            <Clock className="size-3.5" /> Pending
          </Badge>
        );
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Leaves</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Apply for leave, track approval trails, and view team schedules.
            </p>
          </div>

          <Dialog open={isApplyOpen} onOpenChange={setIsApplyOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-[var(--shadow-brand)] cursor-pointer" style={{ background: "var(--gradient-brand)" }}>
                <Plus className="h-4 w-4 mr-2" /> Apply Leave
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Apply for Leave</DialogTitle>
                <DialogDescription>Submit a new leave request for authorization.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="leave-type">Leave Type <span className="text-destructive">*</span></Label>
                  <select
                    id="leave-type"
                    value={leaveTypeId}
                    onChange={(e) => setLeaveTypeId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground dark:text-zinc-50"
                  >
                    {isLoadingLeaveTypes ? (
                      <option value="" className="text-black bg-background">Loading leave types...</option>
                    ) : (
                      leaveTypes?.map((lt: any) => (
                        <option key={lt.id} value={String(lt.id)} className="text-black bg-background">
                          {lt.name.charAt(0).toUpperCase() + lt.name.slice(1)} Leave
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="start-date">Start Date <span className="text-destructive">*</span></Label>
                    <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="end-date">End Date <span className="text-destructive">*</span></Label>
                    <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>

                {startDate && endDate && (
                  <div className="flex items-center space-x-2 border rounded-md p-2 bg-muted/20">
                    <Info className="size-4 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground font-medium">
                      Duration: <strong className="text-foreground">{daysCount}</strong> {daysCount === 1 ? "day" : "days"}
                    </span>
                  </div>
                )}

                <div className="space-y-2 border rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="half-day" className="cursor-pointer text-sm font-semibold">Half Day Application</Label>
                    <input
                      id="half-day"
                      type="checkbox"
                      checked={halfDay}
                      onChange={(e) => setHalfDay(e.target.checked)}
                      className="h-4.5 w-4.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                  {halfDay && (
                    <div className="space-y-1.5 pt-2 border-t mt-2">
                      <Label htmlFor="half-day-slot">Slot Selection</Label>
                      <select
                        id="half-day-slot"
                        value={halfDaySlot}
                        onChange={(e) => setHalfDaySlot(e.target.value)}
                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-2.5 py-0.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground dark:text-zinc-50"
                      >
                        <option value="first_half" className="text-black bg-background">First Half (Morning)</option>
                        <option value="second_half" className="text-black bg-background">Second Half (Afternoon)</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reason">Reason for Leave</Label>
                  <Textarea
                    id="reason"
                    placeholder="Briefly state the reason for requesting leave..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>



                {showFileWarning && (
                  <div className="space-y-2 border border-blue-200/50 bg-blue-50/10 rounded-md p-3">
                    <div className="flex gap-2">
                      <FileText className="size-4.5 text-blue-500 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <p className="font-semibold text-blue-600 dark:text-blue-500">Medical Document Required</p>
                        <p className="text-muted-foreground">Since sick leave exceeds 1 day, please attach a medical certificate.</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-blue-200/30 flex items-center justify-between gap-4">
                      <Label
                        htmlFor="med-doc"
                        className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline cursor-pointer"
                      >
                        <UploadCloud className="size-4" />
                        {file ? "Change File" : "Choose Certificate"}
                      </Label>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                        {file ? file.name : "No file chosen"}
                      </span>
                      <input
                        id="med-doc"
                        type="file"
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={(e) => {
                          const files = e.target.files;
                          if (files && files.length > 0) setFile(files[0]);
                        }}
                        className="hidden"
                      />
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setIsApplyOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => applyLeave.mutate()}
                  disabled={
                    !startDate || 
                    !endDate || 
                    (showFileWarning && !file) || 
                    applyLeave.isPending
                  }
                  style={{ background: "var(--gradient-brand)" }}
                >
                  {applyLeave.isPending ? "Submitting…" : "Apply Leave"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabs Control */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <TabsList className={`grid w-full h-11 p-1 bg-muted/40 rounded-xl border border-border/40 ${canApprove ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <TabsTrigger value="my_leaves" className="text-xs font-semibold rounded-lg gap-2">
              <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
              My Leaves
            </TabsTrigger>
            {canApprove && (
              <TabsTrigger value="approvals" className="text-xs font-semibold rounded-lg gap-2">
                <UserCheck className="h-3.5 w-3.5 shrink-0" />
                Leave Approvals
              </TabsTrigger>
            )}
            <TabsTrigger value="calendar" className="text-xs font-semibold rounded-lg gap-2">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              Leave Calendar
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: MY LEAVES */}
          <TabsContent value="my_leaves" className="space-y-6 outline-none">
            {/* Balances Dashboard Grid */}
            <div className="grid gap-4 md:grid-cols-2 max-w-4xl">
              {balancesList.map((b: any) => {
                const leaveTypeName = b.leave_type?.toLowerCase();
                const displayName = leaveTypeName === "sick" ? "Sick Leave" : leaveTypeName === "casual" ? "Casual Leave" : b.leave_type;
                
                return (
                  <Card key={b.leave_type} className="border border-border/60 shadow-sm relative overflow-hidden bg-card">
                    <div className="absolute right-0 top-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full opacity-5 blur-xl" style={{ background: "var(--gradient-brand)" }} />
                    <CardHeader className="pb-3 border-b border-border/40 py-4">
                      <CardTitle className="text-sm font-semibold flex items-center justify-between">
                        <span className="capitalize">{displayName}</span>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {b.remaining} Left
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-center text-xs">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Entitled</p>
                          <p className="text-sm font-bold mt-0.5">{b.total_entitled}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Used</p>
                          <p className="text-sm font-bold mt-0.5 text-rose-500">{b.used_days}</p>
                        </div>
                      </div>
                      {/* Progress visualization */}
                      {Number(b.total_entitled) > 0 && (
                        <div className="space-y-1 pt-1">
                          <Progress
                            value={(Number(b.used_days) / Number(b.total_entitled)) * 100}
                            className="h-1 bg-muted"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Leave Requests Log */}
            <Card className="border border-border/60 overflow-hidden bg-card shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-base font-bold">Leave Application History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingMyLeaves ? (
                  <p className="p-6 text-sm text-muted-foreground animate-pulse text-center">Loading leave logs…</p>
                ) : myLeaves.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground space-y-2">
                    <CalendarIcon className="size-8 text-muted-foreground/60 mx-auto" />
                    <p className="font-medium text-foreground">No leave history</p>
                    <p className="text-xs">Your submitted leaves will appear here.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/10">
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Approvers workflow</TableHead>
                        <TableHead className="w-[10%] text-right pr-6">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myLeaves.map((l: any) => (
                        <TableRow key={l.leave_id} className="hover:bg-muted/10 transition-colors">
                          <TableCell className="font-bold text-xs uppercase tracking-wider align-middle">
                            {l.leave_type}
                          </TableCell>
                          <TableCell className="align-middle text-xs font-semibold whitespace-nowrap text-muted-foreground">
                            {l.start_date} <span className="mx-1 font-normal">to</span> {l.end_date}
                          </TableCell>
                          <TableCell className="align-middle text-xs max-w-[200px] truncate" title={l.reason}>
                            {l.reason || "—"}
                          </TableCell>
                          <TableCell className="align-middle">
                            {getStatusBadge(l.status)}
                          </TableCell>
                          <TableCell className="align-middle">
                            {l.approvals && l.approvals.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {l.approvals.map((ap: any, idx: number) => {
                                  let color = "bg-muted text-muted-foreground";
                                  if (ap.decision === "approved") color = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
                                  if (ap.decision === "rejected") color = "bg-rose-500/10 text-rose-700 dark:text-rose-400";
                                  
                                  return (
                                    <Tooltip key={idx}>
                                      <TooltipTrigger asChild>
                                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border border-border/20 uppercase tracking-wide cursor-help ${color}`}>
                                          {ap.approver_role}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-[220px] text-xs">
                                        <p className="font-bold">{ap.approver_email}</p>
                                        <p className="text-muted-foreground text-[10px] mt-0.5 capitalize">Decision: {ap.decision}</p>
                                        {ap.decided_at && (
                                          <p className="text-muted-foreground text-[9px] mt-0.5">Time: {new Date(ap.decided_at).toLocaleString()}</p>
                                        )}
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Auto-approved</span>
                            )}
                          </TableCell>
                          <TableCell className="align-middle text-right pr-6">
                            {(l.status === "pending" || l.status === "approved") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  if (window.confirm("Are you sure you want to cancel this leave application?")) {
                                    cancelLeave.mutate(l.leave_id);
                                  }
                                }}
                                disabled={cancelLeave.isPending}
                              >
                                Cancel
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: LEAVE APPROVALS */}
          {canApprove && (
            <TabsContent value="approvals" className="space-y-6 outline-none">
              <Card className="border border-border/60 overflow-hidden bg-card shadow-sm">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="text-base font-bold">Leave Requests Queue</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoadingApprovals ? (
                    <p className="p-6 text-sm text-muted-foreground animate-pulse text-center">Loading approvals…</p>
                  ) : approvals.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground space-y-2">
                      <CheckCircle2 className="size-8 text-emerald-500 mx-auto" />
                      <p className="font-medium text-foreground">You are all caught up!</p>
                      <p className="text-xs">No pending leave requests require your review.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader className="bg-muted/10">
                        <TableRow>
                          <TableHead>Applicant</TableHead>
                          <TableHead>Leave Type</TableHead>
                          <TableHead>Dates</TableHead>
                          <TableHead>Overall Status</TableHead>
                          <TableHead>Your Decision</TableHead>
                          <TableHead className="w-[20%] text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {approvals.map((ap: any) => (
                          <TableRow key={ap.leave_id} className="hover:bg-muted/10 transition-colors">
                            <TableCell className="font-semibold text-xs align-middle">
                              {ap.applicant_email}
                            </TableCell>
                            <TableCell className="font-bold text-xs uppercase tracking-wider align-middle">
                              {ap.leave_type}
                            </TableCell>
                            <TableCell className="align-middle text-xs font-semibold whitespace-nowrap text-muted-foreground">
                              {ap.start_date} <span className="mx-1 font-normal">to</span> {ap.end_date}
                            </TableCell>
                            <TableCell className="align-middle">
                              {getStatusBadge(ap.status)}
                            </TableCell>
                            <TableCell className="align-middle">
                              <Badge variant={ap.my_decision === "pending" ? "outline" : "secondary"} className="capitalize font-medium text-[10px]">
                                {ap.my_decision}
                              </Badge>
                            </TableCell>
                            <TableCell className="align-middle text-right pr-6">
                              {ap.my_decision === "pending" && ap.status === "pending" && (
                                <div className="flex justify-end gap-1.5">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer border-emerald-200"
                                    onClick={() => {
                                      setActingLeaveId(ap.leave_id);
                                      setActionType("approve");
                                      setComment("");
                                    }}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer border-rose-200"
                                    onClick={() => {
                                      setActingLeaveId(ap.leave_id);
                                      setActionType("reject");
                                      setComment("");
                                    }}
                                  >
                                    Reject
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Action Dialog Form */}
              {actingLeaveId && (
                <Dialog open={!!actingLeaveId} onOpenChange={(open) => !open && setActingLeaveId(null)}>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle className="capitalize">{actionType} Leave Request</DialogTitle>
                      <DialogDescription>Submit your review comment for this leave application.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 pt-2">
                      <Label htmlFor="review-comment">Approver Comment</Label>
                      <Textarea
                        id="review-comment"
                        placeholder="Write comments or notes regarding this decision..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="min-h-[80px]"
                      />
                    </div>
                    <DialogFooter className="mt-4">
                      <Button variant="outline" onClick={() => { setActingLeaveId(null); setActionType(null); }}>Cancel</Button>
                      <Button
                        onClick={handleDecisionSubmit}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        className={actionType === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}
                      >
                        {approveMutation.isPending || rejectMutation.isPending ? "Submitting…" : `Confirm ${actionType}`}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </TabsContent>
          )}

          {/* TAB 3: LEAVE CALENDAR */}
          <TabsContent value="calendar" className="space-y-6 outline-none">
            <Card className="border border-border/60 bg-card shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between space-y-0 py-4">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <CalendarIcon className="size-4.5" /> Team Schedule & Holidays
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrevMonth}>
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-xs font-bold font-mono px-2 select-none">
                    {currentMonth}
                  </span>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNextMonth}>
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border/40">
                {isLoadingCalendar ? (
                  <p className="p-6 text-sm text-muted-foreground animate-pulse text-center">Loading schedule…</p>
                ) : (
                  <div className="grid gap-0 md:grid-cols-2 divide-x divide-border/40 min-h-[220px]">
                    {/* Public Holidays Column */}
                    <div className="p-5 space-y-3">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-blue-500" /> Public Holidays ({calendar.holidays?.length ?? 0})
                      </h3>
                      {calendar.holidays?.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-4">No holidays declared for this month.</p>
                      ) : (
                        <div className="space-y-2.5">
                          {calendar.holidays.map((h: any, i: number) => (
                            <div key={i} className="flex justify-between items-center text-xs border p-2.5 rounded-lg bg-muted/10 hover:bg-muted/20 transition-all select-none">
                              <span className="font-semibold">{h.name}</span>
                              <span className="font-mono text-muted-foreground">{h.date}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Approved Leaves Column */}
                    <div className="p-5 space-y-3">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-emerald-500 animate-pulse" /> Team on Leave ({calendar.approved_leaves?.length ?? 0})
                      </h3>
                      {calendar.approved_leaves?.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-4">Nobody is scheduled for leave this month.</p>
                      ) : (
                        <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                          {calendar.approved_leaves.map((al: any, i: number) => (
                            <div key={i} className="flex justify-between items-center text-xs border p-2.5 rounded-lg bg-card hover:bg-muted/10 transition-all">
                              <div className="space-y-0.5">
                                <p className="font-semibold">{al.employee}</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{al.leave_type} Leave</p>
                              </div>
                              <span className="font-mono text-[11px] text-muted-foreground shrink-0 ml-4">
                                {al.start_date} → {al.end_date}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
