import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { api } from "@/lib/api";
import { getPermissionsFromToken, getToken, getRoleFromToken } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileText, Download, Play, Wallet, ShieldCheck, FileClock } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({ meta: [{ title: "Payroll — HRMS" }] }),
  component: PayrollPage,
});

function PayrollPage() {
  const qc = useQueryClient();
  const token = getToken();
  const permissions = getPermissionsFromToken(token);
  const role = getRoleFromToken(token)?.toLowerCase().trim();
  const isFinanceOrAdmin = role === "admin" || role === "finance" || role === "cfo" || permissions.includes("manage_payroll");
  const isManager = role === "line_manager" || isFinanceOrAdmin;

  const [activeTab, setActiveTab] = useState("my-payslips");
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({ request_type: "advance", amount: "", purpose: "" });
  
  const [runPayrollMonth, setRunPayrollMonth] = useState(format(new Date(), "yyyy-MM-01"));

  // Fetch Current Payslip
  const { data: currentPayslip, isLoading: currentLoading } = useQuery({
    queryKey: ["payslip-current"],
    queryFn: () => api<any>("/payroll/me/payslip-current"),
  });

  // Fetch My Payslips
  const { data: myPayslipsData, isLoading: payslipsLoading } = useQuery({
    queryKey: ["payslips-my"],
    queryFn: () => api<any>("/payroll/me/payslips"),
  });

  // Fetch My Requests
  const { data: myRequestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ["payroll-requests-my"],
    queryFn: () => api<any>("/payroll/my"),
  });

  const myPayslips = myPayslipsData?.payslips || [];
  const myRequests = myRequestsData || [];

  // Mutations
  const applyRequestMutation = useMutation({
    mutationFn: (data: any) => {
      const formData = new FormData();
      formData.append("request_type", data.request_type);
      if (data.amount) formData.append("amount", data.amount);
      if (data.purpose) formData.append("purpose", data.purpose);
      return api("/payroll/apply", { method: "POST", body: formData, headers: {} }); // Let browser set multipart content-type
    },
    onSuccess: () => {
      toast.success("Payroll request submitted successfully");
      setApplyOpen(false);
      qc.invalidateQueries({ queryKey: ["payroll-requests-my"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const runPayrollMutation = useMutation({
    mutationFn: (month: string) => {
      return api(`/payroll/admin/run-payroll?month=${month}`, { method: "POST" });
    },
    onSuccess: (data: any) => {
      toast.success(data.message || "Payroll run successfully");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payroll</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your payslips, requests, and financial information.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="my-payslips">My Payslips</TabsTrigger>
          <TabsTrigger value="my-requests">My Requests</TabsTrigger>
          {isFinanceOrAdmin && <TabsTrigger value="administration">Administration</TabsTrigger>}
        </TabsList>

        <TabsContent value="my-payslips" className="space-y-6">
          <Card className="border-border/60 shadow-soft">
            <CardHeader className="bg-muted/30 pb-4 border-b">
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" /> Current Cycle ({currentPayslip?.month || "Loading..."})
                {currentPayslip?.provisional && (
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full border border-amber-500/20">Provisional</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {currentLoading ? (
                <div className="animate-pulse h-20 bg-muted rounded-md" />
              ) : currentPayslip ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Basic Pay</p>
                    <p className="text-2xl font-bold">{currentPayslip.basic?.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">AED</span></p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Gross Pay</p>
                    <p className="text-2xl font-bold">{currentPayslip.gross_pay?.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">AED</span></p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Deductions</p>
                    <p className="text-2xl font-bold text-destructive">{currentPayslip.total_deductions?.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">AED</span></p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Net Pay</p>
                    <p className="text-3xl font-black text-primary">{currentPayslip.net_pay?.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">AED</span></p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No current payslip data available.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle>Payslip History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="pl-6">Month</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Net Pay</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Document</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myPayslips.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No historical payslips found.</TableCell>
                    </TableRow>
                  ) : (
                    myPayslips.map((p: any) => (
                      <TableRow key={p.payslip_id}>
                        <TableCell className="pl-6 font-medium">{p.month}</TableCell>
                        <TableCell>{p.gross_pay?.toLocaleString()}</TableCell>
                        <TableCell className="text-destructive">{p.total_deductions?.toLocaleString()}</TableCell>
                        <TableCell className="font-bold">{p.net_pay?.toLocaleString()}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${p.status === 'paid' ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                            {p.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          {p.file_url ? (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={p.file_url} target="_blank" rel="noreferrer"><Download className="h-4 w-4 mr-2" /> Download</a>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-requests" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">My Payroll Requests</h2>
            <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
              <DialogTrigger asChild>
                <Button style={{ background: "var(--gradient-brand)" }}>Apply for Request</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Payroll Request</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 my-4">
                  <div className="space-y-1">
                    <Label>Request Type</Label>
                    <select 
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                      value={applyForm.request_type}
                      onChange={(e) => setApplyForm({...applyForm, request_type: e.target.value})}
                    >
                      <option value="advance">Salary Advance</option>
                      <option value="certificate">Salary Certificate</option>
                      <option value="query">Payroll Query</option>
                      <option value="schedule_change">Schedule Change</option>
                    </select>
                  </div>
                  {applyForm.request_type === "advance" && (
                    <div className="space-y-1">
                      <Label>Amount (AED)</Label>
                      <Input type="number" value={applyForm.amount} onChange={(e) => setApplyForm({...applyForm, amount: e.target.value})} />
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label>Purpose / Description</Label>
                    <Input value={applyForm.purpose} onChange={(e) => setApplyForm({...applyForm, purpose: e.target.value})} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setApplyOpen(false)}>Cancel</Button>
                  <Button onClick={() => applyRequestMutation.mutate(applyForm)} disabled={applyRequestMutation.isPending} style={{ background: "var(--gradient-brand)" }}>
                    Submit Request
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          
          <Card className="border-border/60 shadow-soft">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="pl-6">Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Waiting On</TableHead>
                    <TableHead className="text-right pr-6">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No requests found.</TableCell>
                    </TableRow>
                  ) : (
                    myRequests.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="pl-6 capitalize font-medium">{r.request_type}</TableCell>
                        <TableCell>{r.amount ? `${r.amount} AED` : "-"}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${r.status === 'approved' ? 'bg-green-500/10 text-green-600' : r.status === 'rejected' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-600'}`}>
                            {r.status}
                          </span>
                        </TableCell>
                        <TableCell className="capitalize">{r.current_approver_role || "-"}</TableCell>
                        <TableCell className="text-right pr-6 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {isFinanceOrAdmin && (
          <TabsContent value="administration" className="space-y-6">
            <Card className="border-border/60 shadow-soft border-primary/20">
              <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Play className="h-5 w-5" /> Execute Monthly Payroll
                </CardTitle>
                <CardDescription>Calculate payroll for all employees for a specific month.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex items-end gap-4 max-w-md">
                  <div className="space-y-2 flex-1">
                    <Label>Payroll Month (YYYY-MM-DD)</Label>
                    <Input type="date" value={runPayrollMonth} onChange={e => setRunPayrollMonth(e.target.value)} />
                  </div>
                  <Button 
                    onClick={() => runPayrollMutation.mutate(runPayrollMonth)} 
                    disabled={runPayrollMutation.isPending}
                    className="shadow-md"
                    style={{ background: "var(--gradient-brand)" }}
                  >
                    {runPayrollMutation.isPending ? "Processing..." : "Run Payroll"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Note: This action recalculates basic pay, leaves, deductions, and generates final payslips for the entire company.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
