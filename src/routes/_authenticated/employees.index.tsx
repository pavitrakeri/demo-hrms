import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useRef } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus,
  Search,
  Users as UsersIcon,
  Building2,
  Briefcase,
  ChevronRight,
  Mail,
  Download,
  Upload,
  LayoutGrid,
  List,
  Calendar,
  DollarSign,
  Fingerprint,
  UserCheck
} from "lucide-react";
import { toast } from "sonner";
import { getRoleFromToken, getToken, getPermissionsFromToken } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/employees/")({
  head: () => ({ meta: [{ title: "Employees — HRMS" }] }),
  beforeLoad: () => {
    const token = getToken();
    const role = getRoleFromToken(token)?.toLowerCase().trim();
    const permissions = getPermissionsFromToken(token);
    if (role !== "admin" && !permissions.includes("manage_employees")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: EmployeesPage,
});

function initials(name?: string) {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

const CSV_COLS = ["full_name", "email", "role", "department", "manager_email", "is_active"] as const;

function toCSV(rows: any[]): string {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = CSV_COLS.join(",");
  const body = rows.map((r) => CSV_COLS.map((c) => esc(r[c] ?? (c === "full_name" ? r.name : ""))).join(",")).join("\n");
  return header + "\n" + body;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else {
        if (ch === ',') { out.push(cur); cur = ""; }
        else if (ch === '"') inQ = true;
        else cur += ch;
      }
    }
    out.push(cur);
    return out;
  };
  const headers = parseLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((l) => {
    const cells = parseLine(l);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? "").trim(); });
    return row;
  });
}

function EmployeesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list"); // Defaults to professional list table
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const downloadTemplate = () => {
    const header = "full_name,email,role,department,manager_email,is_active\n";
    const sample = "John Doe,john.doe@company.com,employee,Technology,manager@company.com,true\n";
    const blob = new Blob([header + sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employees_import_template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Template CSV downloaded");
  };

  // Expanded Form State to match full database schema
  const emptyForm = {
    // Basic / Required info
    full_name: "",
    email: "",
    password: "",
    role: "employee", // Defaults to employee
    department: "",
    manager_email: "",
    hr_email: "", // Default fallback HR
    joining_date: new Date().toISOString().split("T")[0],
    is_active: true,

    // Work / Designation details
    designation: "",
    office_location: "HQ - Abu Dhabi",
    employment_status: "probation",
    status: "active",

    // Personal details
    gender: "Male",
    date_of_birth: "",
    marital_status: "Single",
    nationality: "",
    contact_number: "",
    personal_email: "",
    work_email: "",

    // Legal / Identity
    aadhaar_card_number: "",
    pan_card_number: "",
    pf_account_number: "",
    esi_number: "",
    bank_account_number: "",
    ifsc_code: "",
    emergency_contact_name: "",
    emergency_contact_number: "",

    // Financial
    basic_salary: 0,
    hra: 0,
    mobile: 0,
    transportation: 0,
    other: 0,
    wps_unique_id: "",
    wps: "",
    flight_ticket: "Annual",
    medical_insurance_category: "Standard",
  };

  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [activeTab, setActiveTab] = useState("basic");

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api<any>("/employees/list"),
  });

  const { data: deptsData } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api<any>("/departments/list"),
  });

  const { data: company } = useQuery({
    queryKey: ["settings-company"],
    queryFn: () => api<any>("/settings/company"),
  });
  const currencySymbol = company?.currency ?? "";

  const addEmployee = useMutation({
    mutationFn: () => {
      const payload: Record<string, any> = { ...form };
      // Format optional dates
      if (!payload.date_of_birth) delete payload.date_of_birth;

      // Handle numbers
      payload.basic_salary = Number(payload.basic_salary) || 0;
      payload.hra = Number(payload.hra) || 0;
      payload.mobile = Number(payload.mobile) || 0;
      payload.transportation = Number(payload.transportation) || 0;
      payload.other = Number(payload.other) || 0;
      payload.total_salary = payload.basic_salary + payload.hra + payload.mobile + payload.transportation + payload.other;

      // Convert empty strings to null so Pydantic/FastAPI parses them as None/null
      Object.keys(payload).forEach((key) => {
        if (payload[key] === "") {
          payload[key] = null;
        }
      });

      return api("/employees/add", { method: "POST", body: payload });
    },
    onSuccess: () => {
      toast.success("Employee added successfully");
      qc.invalidateQueries({ queryKey: ["employees"] });
      setOpen(false);
      setForm(emptyForm);
      setActiveTab("basic");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const employees: any[] = useMemo(() => {
    if (!data) return [];
    return Array.isArray(data) ? data : data.employees ?? data.items ?? [];
  }, [data]);

  const apiDepartments: any[] = useMemo(() => {
    if (!deptsData) return [];
    return Array.isArray(deptsData) ? deptsData : deptsData.departments ?? deptsData.items ?? [];
  }, [deptsData]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => e.department && set.add(e.department));
    apiDepartments.forEach((d) => d.name && set.add(d.name));
    return Array.from(set).sort();
  }, [employees, apiDepartments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (deptFilter !== "all" && e.department !== deptFilter) return false;
      if (!q) return true;
      return [e.full_name, e.name, e.email, e.role, e.department]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(q));
    });
  }, [employees, search, deptFilter]);

  const activeCount = employees.filter((e) => e.is_active !== false).length;

  const handleExport = () => {
    if (filtered.length === 0) { toast.error("No employees to export"); return; }
    const csv = toCSV(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `employees-${deptFilter !== "all" ? deptFilter + "-" : ""}${stamp}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} employee(s)`);
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) { toast.error("CSV is empty"); return; }
      let ok = 0, fail = 0;
      for (const r of rows) {
        // Fallback fields for basic CSV imports to satisfy AddEmployeeRequest
        const payload: Record<string, unknown> = {
          full_name: r.full_name || r.name || "",
          email: r.email || "",
          password: "DefaultPassword123!",
          role: r.role || "employee",
          department: r.department || "Unassigned",
          joining_date: new Date().toISOString().split("T")[0],
          manager_email: r.manager_email || "manager@aimploy.com",
          hr_email: "",
          is_active: r.is_active ? !/^(false|0|no)$/i.test(r.is_active) : true,
        };
        if (!payload.email || !payload.full_name) { fail++; continue; }
        try {
          await api("/employees/add", { method: "POST", body: payload });
          ok++;
        } catch { fail++; }
      }
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success(`Imported ${ok} employee(s)${fail ? `, ${fail} failed` : ""}`);
      setImportOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to import CSV");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Directory of all team members across departments.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }}
            />
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} disabled={importing}>
              <Upload className="h-4 w-4 mr-2" />{importing ? "Importing…" : "Import CSV"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />Export CSV
            </Button>

            {/* Import CSV Explanation & Formatting Dialog */}
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-primary" /> Import Employees from CSV
                  </DialogTitle>
                  <DialogDescription>
                    Upload a CSV file containing your employee records.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 my-3 text-sm">
                  <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                    <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Required CSV Columns:</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <span className="font-mono font-bold text-foreground">full_name</span> <span className="text-muted-foreground">e.g. John Doe</span>
                      <span className="font-mono font-bold text-foreground">email</span> <span className="text-muted-foreground">e.g. john@company.com</span>
                      <span className="font-mono font-bold text-foreground">role</span> <span className="text-muted-foreground">employee, line_manager, hr, admin</span>
                      <span className="font-mono font-bold text-foreground">department</span> <span className="text-muted-foreground">e.g. Engineering</span>
                      <span className="font-mono font-bold text-foreground">manager_email</span> <span className="text-muted-foreground">e.g. manager@company.com</span>
                      <span className="font-mono font-bold text-foreground">is_active</span> <span className="text-muted-foreground">true / false</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-b py-3">
                    <div>
                      <p className="font-bold text-xs">Need the correct format?</p>
                      <p className="text-xs text-muted-foreground">Download our pre-formatted template.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={downloadTemplate} className="cursor-pointer">
                      <Download className="h-3.5 w-3.5 mr-1.5" /> Template
                    </Button>
                  </div>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors rounded-xl p-8 text-center cursor-pointer bg-muted/5 hover:bg-muted/10 flex flex-col items-center justify-center gap-3"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Click to select CSV file</p>
                      <p className="text-xs text-muted-foreground mt-1">Make sure it matches the format columns</p>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="ghost" onClick={() => setImportOpen(false)}>Cancel</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="shadow-[var(--shadow-brand)]" style={{ background: "var(--gradient-brand)" }}>
                  <Plus className="h-4 w-4 mr-2" />Add employee
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Employee</DialogTitle>
                  <DialogDescription>Create a new employee profile with full organizational and payroll setup.</DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid grid-cols-4 w-full text-xs">
                    <TabsTrigger value="basic" className="text-[11px] gap-1">
                      <UserCheck className="h-3 w-3 shrink-0" /> Basic
                    </TabsTrigger>
                    <TabsTrigger value="personal" className="text-[11px] gap-1">
                      <UsersIcon className="h-3 w-3 shrink-0" /> Personal
                    </TabsTrigger>
                    <TabsTrigger value="visa" className="text-[11px] gap-1">
                      <Fingerprint className="h-3 w-3 shrink-0" /> Legal/ID
                    </TabsTrigger>
                    <TabsTrigger value="financial" className="text-[11px] gap-1">
                      <DollarSign className="h-3 w-3 shrink-0" /> Financial
                    </TabsTrigger>
                  </TabsList>

                  {/* 1. Basic Info Tab */}
                  <TabsContent value="basic" className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 max-h-[50vh] overflow-y-auto pr-1">
                    <div className="space-y-1">
                      <Label htmlFor="full_name">Full Name <span className="text-destructive">*</span></Label>
                      <Input id="full_name" placeholder="John Doe" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="email">Login Email <span className="text-destructive">*</span></Label>
                      <Input id="email" type="email" placeholder="john.doe@aimploy.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="password">Temporary Password <span className="text-destructive">*</span></Label>
                      <Input id="password" type="password" placeholder="Min. 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="role">System Role <span className="text-destructive">*</span></Label>
                      <select id="role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background dark:bg-zinc-950 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <option value="employee">Employee</option>
                        <option value="line_manager">Line Manager</option>
                        <option value="hr">HR Personnel</option>
                        <option value="cfo">CFO</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="employment_status">Employment Status</Label>
                      <select id="employment_status" value={form.employment_status || "Full Time"} onChange={(e) => setForm({ ...form, employment_status: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background dark:bg-zinc-950 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <option value="Full Time">Full Time</option>
                        <option value="Part Time">Part Time</option>
                        <option value="Contract">Contract</option>
                        <option value="Probation">Probation</option>
                        <option value="Intern">Intern</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="designation">Designation</Label>
                      <Input id="designation" placeholder="e.g. Software Engineer" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="department">Department</Label>
                      <Input
                        id="department"
                        list="depts-list"
                        placeholder="e.g. Technology"
                        value={form.department}
                        onChange={(e) => setForm({ ...form, department: e.target.value })}
                      />
                      <datalist id="depts-list">
                        {departments.map((d) => (
                          <option key={d} value={d} />
                        ))}
                      </datalist>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="manager_email">Manager Email</Label>
                      <select
                        id="manager_email"
                        value={form.manager_email}
                        onChange={(e) => setForm({ ...form, manager_email: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-background dark:bg-zinc-950 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">Select Manager</option>
                        {employees.map((e) => (
                          <option key={e.email} value={e.email}>
                            {e.full_name ?? e.name ?? "Employee"} ({e.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="hr_email">HR Email</Label>
                      <select
                        id="hr_email"
                        value={form.hr_email}
                        onChange={(e) => setForm({ ...form, hr_email: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-background dark:bg-zinc-950 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">Select HR Partner</option>
                        {employees.map((e) => (
                          <option key={e.email} value={e.email}>
                            {e.full_name ?? e.name ?? "HR"} ({e.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="joining_date">Joining Date <span className="text-destructive">*</span></Label>
                      <Input id="joining_date" type="date" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="office_location">Office Location</Label>
                      <Input id="office_location" value={form.office_location} onChange={(e) => setForm({ ...form, office_location: e.target.value })} />
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-3.5 sm:col-span-2">
                      <div>
                        <Label htmlFor="is_active" className="cursor-pointer text-sm font-semibold">Active Status</Label>
                        <p className="text-[10px] text-muted-foreground">Inactive employees cannot log in or participate in schedules.</p>
                      </div>
                      <Switch id="is_active" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                    </div>
                  </TabsContent>

                  {/* 2. Personal Info Tab */}
                  <TabsContent value="personal" className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 max-h-[50vh] overflow-y-auto pr-1">
                    <div className="space-y-1">
                      <Label htmlFor="gender">Gender</Label>
                      <select id="gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="date_of_birth">Date of Birth</Label>
                      <Input id="date_of_birth" type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="marital_status">Marital Status</Label>
                      <select id="marital_status" value={form.marital_status} onChange={(e) => setForm({ ...form, marital_status: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="nationality">Nationality</Label>
                      <Input id="nationality" placeholder="e.g. United Arab Emirates" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="contact_number">Contact Number</Label>
                      <Input id="contact_number" placeholder="e.g. +971 50 123 4567" value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="personal_email">Personal Email</Label>
                      <Input id="personal_email" type="email" placeholder="personal@email.com" value={form.personal_email} onChange={(e) => setForm({ ...form, personal_email: e.target.value })} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="work_email">Secondary Work Email</Label>
                      <Input id="work_email" type="email" placeholder="work.alt@company.com" value={form.work_email} onChange={(e) => setForm({ ...form, work_email: e.target.value })} />
                    </div>
                  </TabsContent>

                  {/* 3. Legal & Identity Tab */}
                  <TabsContent value="visa" className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 max-h-[50vh] overflow-y-auto pr-1">
                    <div className="space-y-1">
                      <Label htmlFor="aadhaar_card_number">Aadhaar Card Number</Label>
                      <Input id="aadhaar_card_number" placeholder="Aadhaar Card Number" value={form.aadhaar_card_number} onChange={(e) => setForm({ ...form, aadhaar_card_number: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="pan_card_number">PAN Card Number</Label>
                      <Input id="pan_card_number" placeholder="PAN Card Number" value={form.pan_card_number} onChange={(e) => setForm({ ...form, pan_card_number: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="pf_account_number">PF / EPF Account Number</Label>
                      <Input id="pf_account_number" placeholder="PF / EPF Account Number" value={form.pf_account_number} onChange={(e) => setForm({ ...form, pf_account_number: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="esi_number">ESI Number</Label>
                      <Input id="esi_number" placeholder="ESI Number" value={form.esi_number} onChange={(e) => setForm({ ...form, esi_number: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="bank_account_number">Bank Account Number</Label>
                      <Input id="bank_account_number" placeholder="Bank Account Number" value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ifsc_code">Bank IFSC Code</Label>
                      <Input id="ifsc_code" placeholder="Bank IFSC Code" value={form.ifsc_code} onChange={(e) => setForm({ ...form, ifsc_code: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
                      <Input id="emergency_contact_name" placeholder="Emergency Contact Name" value={form.emergency_contact_name} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="emergency_contact_number">Emergency Contact Number</Label>
                      <Input id="emergency_contact_number" placeholder="Emergency Contact Number" value={form.emergency_contact_number} onChange={(e) => setForm({ ...form, emergency_contact_number: e.target.value })} />
                    </div>
                  </TabsContent>

                  {/* 4. Financial & Payroll Tab */}
                  <TabsContent value="financial" className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 max-h-[50vh] overflow-y-auto pr-1">
                    <div className="space-y-1">
                      <Label htmlFor="basic_salary">Basic Salary {currencySymbol ? `(${currencySymbol})` : ""}</Label>
                      <Input id="basic_salary" type="number" min="0" value={form.basic_salary} onChange={(e) => setForm({ ...form, basic_salary: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="hra">Housing Allowance (HRA) {currencySymbol ? `(${currencySymbol})` : ""}</Label>
                      <Input id="hra" type="number" min="0" value={form.hra} onChange={(e) => setForm({ ...form, hra: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="mobile_allowance">Mobile Allowance {currencySymbol ? `(${currencySymbol})` : ""}</Label>
                      <Input id="mobile_allowance" type="number" min="0" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="trans_allowance">Transportation Allowance {currencySymbol ? `(${currencySymbol})` : ""}</Label>
                      <Input id="trans_allowance" type="number" min="0" value={form.transportation} onChange={(e) => setForm({ ...form, transportation: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="other_allowance">Other Allowance {currencySymbol ? `(${currencySymbol})` : ""}</Label>
                      <Input id="other_allowance" type="number" min="0" value={form.other} onChange={(e) => setForm({ ...form, other: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="wps">WPS Payment Status</Label>
                      <Input id="wps" placeholder="e.g. Yes / No / Exempt" value={form.wps} onChange={(e) => setForm({ ...form, wps: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="wps_unique_id">WPS Unique ID</Label>
                      <Input id="wps_unique_id" placeholder="WPS unique identification code" value={form.wps_unique_id} onChange={(e) => setForm({ ...form, wps_unique_id: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="flight_ticket">Flight Ticket Benefits</Label>
                      <Input id="flight_ticket" placeholder="e.g. Annual / Bi-annual" value={form.flight_ticket} onChange={(e) => setForm({ ...form, flight_ticket: e.target.value })} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="med_insurance">Medical Insurance Category</Label>
                      <Input id="med_insurance" placeholder="e.g. VIP, Standard, Enhanced" value={form.medical_insurance_category} onChange={(e) => setForm({ ...form, medical_insurance_category: e.target.value })} />
                    </div>
                  </TabsContent>
                </Tabs>

                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => addEmployee.mutate()} disabled={!form.email || !form.full_name || !form.password || addEmployee.isPending} style={{ background: "var(--gradient-brand)" }}>
                    {addEmployee.isPending ? "Creating…" : "Add employee"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats banner */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard icon={UsersIcon} label="Total" value={employees.length} />
          <StatCard icon={Briefcase} label="Active" value={activeCount} accent />
          <StatCard icon={Building2} label="Departments" value={departments.length} />
        </div>

        {/* Filters and Grid/List view toggle banner */}
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, role…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="all">All departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Grid / List view toggler */}
            <div className="flex items-center rounded-lg border bg-muted/30 p-1 self-start md:self-center shrink-0">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-3 text-xs gap-1.5"
                onClick={() => setViewMode("list")}
              >
                <List className="h-3.5 w-3.5" />
                List
              </Button>
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-3 text-xs gap-1.5"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Grid
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Employees Listing Grid/Table */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse"><CardContent className="h-32" /></Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-sm text-muted-foreground">
            No employees match your filters.
          </CardContent></Card>
        ) : viewMode === "list" ? (
          /* List View (Table layout) */
          <Card className="border border-border/60 overflow-hidden bg-card shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow>
                    <TableHead className="w-[30%]">Employee</TableHead>
                    <TableHead className="w-[20%]">Department</TableHead>
                    <TableHead className="w-[18%]">Role</TableHead>
                    <TableHead className="w-[20%]">Manager</TableHead>
                    <TableHead className="w-[10%]">Status</TableHead>
                    <TableHead className="w-[2%] text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => {
                    const id = String(e.id ?? e.employee_id ?? e._id ?? e.email);
                    const name = e.full_name ?? e.name ?? "—";
                    const active = e.is_active !== false;

                    return (
                      <TableRow key={id} className="hover:bg-muted/10 transition-colors group">
                        <TableCell className="align-middle py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm"
                              style={{ background: "var(--gradient-brand)" }}
                            >
                              {initials(name)}
                            </div>
                            <div className="min-w-0">
                              <Link
                                to="/employees/$employeeId"
                                params={{ employeeId: id }}
                                className="font-bold text-sm text-foreground hover:underline group-hover:text-primary transition-colors block truncate"
                              >
                                {name}
                              </Link>
                              <span className="text-xs text-muted-foreground block truncate">{e.email ?? "—"}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="align-middle text-xs">
                          {e.department ? (
                            <span className="flex items-center gap-1.5 font-medium">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                              {e.department}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="align-middle text-xs">
                          {e.role ? (
                            <span className="flex items-center gap-1.5 font-medium">
                              <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                              {e.role}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="align-middle text-xs text-muted-foreground truncate max-w-[150px]">
                          {e.manager_email ?? "—"}
                        </TableCell>
                        <TableCell className="align-middle">
                          <Badge
                            className="font-normal text-[10px] px-1.5 py-0"
                            style={active ? { background: "color-mix(in oklab, var(--success) 15%, transparent)", color: "var(--success)" } : undefined}
                            variant={active ? "secondary" : "outline"}
                          >
                            <span className={"h-1.5 w-1.5 rounded-full mr-1.5 " + (active ? "bg-emerald-500" : "bg-muted-foreground")} />
                            {active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-middle text-right pr-4">
                          <Link
                            to="/employees/$employeeId"
                            params={{ employeeId: id }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-primary transition-all"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          /* Grid View (Enhanced Cards layout) */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e) => {
              const id = String(e.id ?? e.employee_id ?? e._id ?? e.email);
              const name = e.full_name ?? e.name ?? "—";
              const active = e.is_active !== false;
              return (
                <Link
                  key={id}
                  to="/employees/$employeeId"
                  params={{ employeeId: id }}
                  className="group block"
                >
                  <Card className="h-full transition-all hover:shadow-[var(--shadow-brand)] hover:-translate-y-0.5 hover:border-primary/30 bg-card border border-border/60">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <div
                          className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-semibold text-sm shrink-0 shadow-sm"
                          style={{ background: "var(--gradient-brand)" }}
                        >
                          {initials(name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">{name}</p>
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3" /> {e.email ?? "—"}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/40">
                        {e.role && <Badge variant="secondary" className="font-normal text-[10px]"><Briefcase className="h-3 w-3 mr-1 text-muted-foreground" />{e.role}</Badge>}
                        {e.department && <Badge variant="outline" className="font-normal text-[10px]"><Building2 className="h-3 w-3 mr-1 text-muted-foreground" />{e.department}</Badge>}
                        <Badge
                          className="font-normal text-[10px] ml-auto"
                          style={active ? { background: "color-mix(in oklab, var(--success) 15%, transparent)", color: "var(--success)" } : undefined}
                          variant={active ? "secondary" : "outline"}
                        >
                          <span className={"h-1.5 w-1.5 rounded-full mr-1.5 " + (active ? "bg-emerald-500" : "bg-muted-foreground")} />
                          {active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent?: boolean }) {
  return (
    <Card className="border-border/60 shadow-sm bg-card">
      <CardContent className="p-4 flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
          style={accent ? { background: "var(--gradient-brand)" } : { background: "var(--accent)" }}
        >
          <Icon className={"h-5 w-5 " + (accent ? "text-white" : "text-accent-foreground")} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold leading-none mt-1">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}