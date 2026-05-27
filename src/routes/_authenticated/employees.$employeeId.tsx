import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  ArrowLeft,
  Mail,
  Building2,
  Briefcase,
  UserCircle2,
  Calendar,
  Phone,
  MapPin,
  IdCard,
  Copy,
  Check,
  Fingerprint,
  DollarSign,
  User,
  Heart,
  Plane,
  ShieldAlert,
  Wallet,
  Globe,
  FileText,
  Pencil
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/employees/$employeeId")({
  head: () => ({ meta: [{ title: "Employee Details — HRMS" }] }),
  component: EmployeeDetail,
});

function formatDate(d?: string | null) {
  if (!d) return "—";
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return String(d);
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatCurrency(val?: number | null) {
  if (val == null || isNaN(val)) return "—";
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(val);
}

function initials(name?: string) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function isExpiringSoon(dateStr?: string | null) {
  if (!dateStr) return false;
  const expiry = new Date(dateStr);
  if (isNaN(expiry.getTime())) return false;
  const diffTime = expiry.getTime() - Date.now();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 && diffDays <= 60; // 60 days warning window
}

function EmployeeDetail() {
  const { employeeId } = Route.useParams();
  const qc = useQueryClient();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState("basic");

  // Queries
  const { data: detail, isLoading, error } = useQuery({
    queryKey: ["employee", employeeId],
    queryFn: () => api<any>(`/employees/${employeeId}`),
  });

  const { data: list } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api<any>("/employees/list"),
  });

  const { data: deptsData } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api<any>("/departments/list"),
  });

  const listEmployees: any[] = Array.isArray(list) ? list : list?.employees ?? list?.items ?? [];
  const fromList = listEmployees.find(
    (e) => String(e.id ?? e.employee_id ?? e.email) === String(employeeId)
  );

  const detailObj: any =
    typeof detail === "string" || detail == null
      ? {}
      : (detail.employee ?? detail.data ?? detail);
  
  const emp: any = { ...(fromList ?? {}), ...detailObj };

  // Form State
  const [form, setForm] = useState<any>(null);

  const apiDepartments: any[] = Array.isArray(deptsData) ? deptsData : deptsData?.departments ?? deptsData?.items ?? [];
  const departments = Array.from(new Set([
    ...listEmployees.map((e) => e.department).filter(Boolean),
    ...apiDepartments.map((d) => d.name).filter(Boolean)
  ])).sort();

  const openEditDialog = () => {
    setForm({
      full_name: emp.full_name ?? emp.name ?? "",
      email: emp.email ?? "",
      role: emp.role ?? "employee",
      department: emp.department ?? "",
      manager_email: emp.manager_email ?? "",
      hr_email: emp.hr_email ?? "hr@aimploy.com",
      joining_date: emp.joining_date ? emp.joining_date.split("T")[0] : new Date().toISOString().split("T")[0],
      is_active: emp.is_active !== false,

      // Work / Designation details
      designation: emp.designation ?? "",
      office_location: emp.office_location ?? "HQ - Abu Dhabi",
      employment_status: emp.employment_status ?? "probation",
      status: emp.status ?? "active",

      // Personal details
      gender: emp.gender ?? "Male",
      date_of_birth: emp.date_of_birth ? emp.date_of_birth.split("T")[0] : "",
      marital_status: emp.marital_status ?? "Single",
      nationality: emp.nationality ?? "",
      contact_number: emp.contact_number ?? "",
      personal_email: emp.personal_email ?? "",
      work_email: emp.work_email ?? "",

      // Legal / Identity
      passport_number: emp.passport_number ?? "",
      emirates_id_number: emp.emirates_id_number ?? "",
      uid_number: emp.uid_number ?? "",
      file_number: emp.file_number ?? "",
      contract_type: emp.contract_type ?? "Limited",
      labour_card_number: emp.labour_card_number ?? "",
      labour_card_expiry: emp.labour_card_expiry ? emp.labour_card_expiry.split("T")[0] : "",
      visa_sponsorship: emp.visa_sponsorship ?? "Company Sponsored",
      residence_visa_expiry: emp.residence_visa_expiry ? emp.residence_visa_expiry.split("T")[0] : "",

      // Financial
      basic_salary: emp.basic_salary ?? 0,
      hra: emp.hra ?? 0,
      mobile: emp.mobile ?? 0,
      transportation: emp.transportation ?? 0,
      other: emp.other ?? 0,
      wps_unique_id: emp.wps_unique_id ?? "",
      wps: emp.wps ?? "",
      flight_ticket: emp.flight_ticket ?? "Annual",
      medical_insurance_category: emp.medical_insurance_category ?? "Standard",
    });
    setActiveFormTab("basic");
    setEditOpen(true);
  };

  const updateEmployee = useMutation({
    mutationFn: () => {
      const payload: Record<string, any> = { ...form };
      // Format optional dates
      if (!payload.date_of_birth) delete payload.date_of_birth;
      if (!payload.labour_card_expiry) delete payload.labour_card_expiry;
      if (!payload.residence_visa_expiry) delete payload.residence_visa_expiry;

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

      return api(`/employees/${employeeId}`, { method: "PUT", body: payload });
    },
    onSuccess: () => {
      toast.success("Employee details updated successfully");
      qc.invalidateQueries({ queryKey: ["employee", employeeId] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      setEditOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Copy helper
  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const name = emp.full_name ?? emp.name ?? emp.username ?? "Employee";
  const email = emp.email ?? "—";
  const role = emp.role ?? "—";
  const designation = emp.designation ?? role ?? "—";
  const department = emp.department ?? emp.dept ?? "—";
  
  const is_active = emp.is_active !== false;
  const statusStr = emp.status ?? (is_active ? "Active" : "Inactive");

  const phone = emp.contact_number ?? emp.phone ?? emp.mobile ?? null;
  const officeLocation = emp.office_location ?? emp.location ?? emp.address ?? "—";
  const reportsTo = emp.manager_email ?? emp.reports_to ?? emp.manager ?? null;
  const hrEmail = emp.hr_email ?? "—";
  const joined = emp.joining_date ?? emp.joined_at ?? emp.created_at ?? null;
  const employmentStatus = emp.employment_status ?? "probation";
  const contractType = emp.contract_type ?? "Limited";

  // Financial fields
  const basicSalary = parseFloat(emp.basic_salary) || 0;
  const hra = parseFloat(emp.hra) || 0;
  const mobileAllowance = parseFloat(emp.mobile) || 0;
  const transportationAllowance = parseFloat(emp.transportation) || 0;
  const otherAllowance = parseFloat(emp.other) || 0;
  const totalSalary = emp.total_salary || (basicSalary + hra + mobileAllowance + transportationAllowance + otherAllowance);

  return (
    <div className="space-y-6">
      <Link to="/employees" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to employees
      </Link>

      {isLoading ? (
        <Card className="border border-border/60 shadow-sm">
          <CardContent className="p-8 text-sm text-muted-foreground flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Loading employee details…
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/30 shadow-sm bg-destructive/5">
          <CardContent className="p-8 text-sm text-destructive font-medium">
            Error fetching details: {(error as Error).message}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          
          {/* Professional Hero Card */}
          <Card className="overflow-hidden border border-border/60 shadow-[var(--shadow-brand)] bg-card">
            <div className="h-12 opacity-90" style={{ background: "var(--gradient-brand)" }} />
            <CardContent className="pt-0 -mt-6 pb-6 px-6 relative z-10">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-left">
                  <div
                    className="h-24 w-24 rounded-2xl border-4 border-background flex items-center justify-center text-3xl font-extrabold text-white shadow-xl select-none"
                    style={{ background: "var(--gradient-brand)" }}
                  >
                    {initials(name)}
                  </div>
                  <div className="sm:pb-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                      <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
                      <Badge
                        variant={is_active ? "secondary" : "outline"}
                        className="font-semibold text-xs px-2.5 py-0.5 rounded-full"
                        style={is_active ? { background: "color-mix(in oklab, var(--success) 12%, transparent)", color: "var(--success)" } : undefined}
                      >
                        <span className={"h-1.5 w-1.5 rounded-full mr-1.5 " + (is_active ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground")} />
                        {statusStr}
                      </Badge>
                      <Badge variant="outline" className="capitalize text-xs font-medium px-2 py-0.5 border-border">
                        {employmentStatus}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1.5 font-medium">
                      {designation} · {department}
                    </p>
                  </div>
                </div>

                {/* Quick actions panel */}
                <div className="flex flex-wrap items-center justify-center md:justify-end gap-2.5 self-center md:self-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs font-semibold px-4 cursor-pointer hover:bg-muted"
                    onClick={openEditDialog}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /> Edit details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs font-semibold px-4 cursor-pointer hover:bg-muted"
                    onClick={() => copyToClipboard(emp.id ?? employeeId, "empId")}
                  >
                    {copiedKey === "empId" ? (
                      <><Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> Copied ID</>
                    ) : (
                      <><Copy className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /> Copy Profile ID</>
                    )}
                  </Button>
                  {phone && (
                    <Button variant="outline" size="sm" asChild className="h-9 text-xs font-semibold px-4">
                      <a href={`tel:${phone}`}><Phone className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /> Call</a>
                    </Button>
                  )}
                  <Button size="sm" asChild className="h-9 text-xs font-semibold px-4 shadow-sm" style={{ background: "var(--gradient-brand)" }}>
                    <a href={`mailto:${email}`}><Mail className="h-3.5 w-3.5 mr-1.5" /> Email employee</a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Edit Employee Details Dialog */}
          {form && (
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Edit Employee Details</DialogTitle>
                  <DialogDescription>Update employee profile details, legal documents, and compensation.</DialogDescription>
                </DialogHeader>

                <Tabs value={activeFormTab} onValueChange={setActiveFormTab} className="w-full">
                  <TabsList className="grid grid-cols-4 w-full text-xs">
                    <TabsTrigger value="basic" className="text-[11px] gap-1">
                      Basic Info
                    </TabsTrigger>
                    <TabsTrigger value="personal" className="text-[11px] gap-1">
                      Personal
                    </TabsTrigger>
                    <TabsTrigger value="visa" className="text-[11px] gap-1">
                      Legal/ID
                    </TabsTrigger>
                    <TabsTrigger value="financial" className="text-[11px] gap-1">
                      Financials
                    </TabsTrigger>
                  </TabsList>

                  {/* 1. Basic Info Tab */}
                  <TabsContent value="basic" className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 max-h-[50vh] overflow-y-auto pr-1">
                    <div className="space-y-1">
                      <Label htmlFor="edit_full_name">Full Name <span className="text-destructive">*</span></Label>
                      <Input id="edit_full_name" placeholder="John Doe" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_email">Login Email <span className="text-destructive">*</span></Label>
                      <Input id="edit_email" type="email" placeholder="john.doe@aimploy.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_role">System Role <span className="text-destructive">*</span></Label>
                      <select id="edit_role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background dark:bg-zinc-950 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <option value="employee">Employee</option>
                        <option value="line_manager">Line Manager</option>
                        <option value="hr">HR Personnel</option>
                        <option value="cfo">CFO</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_designation">Designation</Label>
                      <Input id="edit_designation" placeholder="e.g. Software Engineer" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_department">Department <span className="text-destructive">*</span></Label>
                      <Input
                        id="edit_department"
                        list="edit-depts-list"
                        placeholder="e.g. Technology"
                        value={form.department}
                        onChange={(e) => setForm({ ...form, department: e.target.value })}
                      />
                      <datalist id="edit-depts-list">
                        {departments.map((d) => (
                          <option key={d} value={d} />
                        ))}
                      </datalist>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_manager_email">Manager Email <span className="text-destructive">*</span></Label>
                      <select
                        id="edit_manager_email"
                        value={form.manager_email}
                        onChange={(e) => setForm({ ...form, manager_email: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-background dark:bg-zinc-950 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">Select Manager</option>
                        {listEmployees.map((e) => (
                          <option key={e.email} value={e.email}>
                            {e.full_name ?? e.name ?? "Employee"} ({e.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_hr_email">HR Email <span className="text-destructive">*</span></Label>
                      <select
                        id="edit_hr_email"
                        value={form.hr_email}
                        onChange={(e) => setForm({ ...form, hr_email: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-background dark:bg-zinc-950 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">Select HR Partner</option>
                        {listEmployees.map((e) => (
                          <option key={e.email} value={e.email}>
                            {e.full_name ?? e.name ?? "HR"} ({e.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_joining_date">Joining Date <span className="text-destructive">*</span></Label>
                      <Input id="edit_joining_date" type="date" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_office_location">Office Location</Label>
                      <Input id="edit_office_location" value={form.office_location} onChange={(e) => setForm({ ...form, office_location: e.target.value })} />
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-3.5 sm:col-span-2">
                      <div>
                        <Label htmlFor="edit_is_active" className="cursor-pointer text-sm font-semibold">Active Status</Label>
                        <p className="text-[10px] text-muted-foreground">Inactive employees cannot log in.</p>
                      </div>
                      <Switch id="edit_is_active" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                    </div>
                  </TabsContent>

                  {/* 2. Personal Info Tab */}
                  <TabsContent value="personal" className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 max-h-[50vh] overflow-y-auto pr-1">
                    <div className="space-y-1">
                      <Label htmlFor="edit_gender">Gender</Label>
                      <select id="edit_gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background dark:bg-zinc-950 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_date_of_birth">Date of Birth</Label>
                      <Input id="edit_date_of_birth" type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_marital_status">Marital Status</Label>
                      <select id="edit_marital_status" value={form.marital_status} onChange={(e) => setForm({ ...form, marital_status: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background dark:bg-zinc-950 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_nationality">Nationality</Label>
                      <Input id="edit_nationality" placeholder="e.g. United Arab Emirates" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_contact_number">Contact Number</Label>
                      <Input id="edit_contact_number" placeholder="e.g. +971 50 123 4567" value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_personal_email">Personal Email</Label>
                      <Input id="edit_personal_email" type="email" placeholder="personal@email.com" value={form.personal_email} onChange={(e) => setForm({ ...form, personal_email: e.target.value })} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="edit_work_email">Secondary Work Email</Label>
                      <Input id="edit_work_email" type="email" placeholder="work.alt@company.com" value={form.work_email} onChange={(e) => setForm({ ...form, work_email: e.target.value })} />
                    </div>
                  </TabsContent>

                  {/* 3. Legal & Identity Tab */}
                  <TabsContent value="visa" className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 max-h-[50vh] overflow-y-auto pr-1">
                    <div className="space-y-1">
                      <Label htmlFor="edit_passport_number">Passport Number</Label>
                      <Input id="edit_passport_number" placeholder="e.g. N1234567" value={form.passport_number} onChange={(e) => setForm({ ...form, passport_number: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_emirates_id_number">Emirates ID Number</Label>
                      <Input id="edit_emirates_id_number" placeholder="784-YYYY-XXXXXXX-Z" value={form.emirates_id_number} onChange={(e) => setForm({ ...form, emirates_id_number: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_uid_number">Unified ID (UID) Number</Label>
                      <Input id="edit_uid_number" placeholder="Unified ID number" value={form.uid_number} onChange={(e) => setForm({ ...form, uid_number: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_file_number">Visa File Number</Label>
                      <Input id="edit_file_number" placeholder="Visa File number" value={form.file_number} onChange={(e) => setForm({ ...form, file_number: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_visa_sponsorship">Visa Sponsorship</Label>
                      <Input id="edit_visa_sponsorship" placeholder="e.g. Company Sponsored" value={form.visa_sponsorship} onChange={(e) => setForm({ ...form, visa_sponsorship: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_residence_visa_expiry">Residence Visa Expiry</Label>
                      <Input id="edit_residence_visa_expiry" type="date" value={form.residence_visa_expiry} onChange={(e) => setForm({ ...form, residence_visa_expiry: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_labour_card_number">Labour Card Number</Label>
                      <Input id="edit_labour_card_number" value={form.labour_card_number} onChange={(e) => setForm({ ...form, labour_card_number: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_labour_card_expiry">Labour Card Expiry</Label>
                      <Input id="edit_labour_card_expiry" type="date" value={form.labour_card_expiry} onChange={(e) => setForm({ ...form, labour_card_expiry: e.target.value })} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="edit_contract_type">Contract Type</Label>
                      <select id="edit_contract_type" value={form.contract_type} onChange={(e) => setForm({ ...form, contract_type: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background dark:bg-zinc-950 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <option value="Limited">Limited Term</option>
                        <option value="Unlimited">Unlimited Term</option>
                      </select>
                    </div>
                  </TabsContent>

                  {/* 4. Financial & Payroll Tab */}
                  <TabsContent value="financial" className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 max-h-[50vh] overflow-y-auto pr-1">
                    <div className="space-y-1">
                      <Label htmlFor="edit_basic_salary">Basic Salary (AED)</Label>
                      <Input id="edit_basic_salary" type="number" min="0" value={form.basic_salary} onChange={(e) => setForm({ ...form, basic_salary: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_hra">Housing Allowance (HRA) (AED)</Label>
                      <Input id="edit_hra" type="number" min="0" value={form.hra} onChange={(e) => setForm({ ...form, hra: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_mobile_allowance">Mobile Allowance (AED)</Label>
                      <Input id="edit_mobile_allowance" type="number" min="0" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_trans_allowance">Transportation Allowance (AED)</Label>
                      <Input id="edit_trans_allowance" type="number" min="0" value={form.transportation} onChange={(e) => setForm({ ...form, transportation: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_other_allowance">Other Allowance (AED)</Label>
                      <Input id="edit_other_allowance" type="number" min="0" value={form.other} onChange={(e) => setForm({ ...form, other: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_wps">WPS Payment Status</Label>
                      <Input id="edit_wps" placeholder="e.g. Yes / No / Exempt" value={form.wps} onChange={(e) => setForm({ ...form, wps: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_wps_unique_id">WPS Unique ID</Label>
                      <Input id="edit_wps_unique_id" placeholder="WPS unique identification code" value={form.wps_unique_id} onChange={(e) => setForm({ ...form, wps_unique_id: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit_flight_ticket">Flight Ticket Benefits</Label>
                      <Input id="edit_flight_ticket" placeholder="e.g. Annual / Bi-annual" value={form.flight_ticket} onChange={(e) => setForm({ ...form, flight_ticket: e.target.value })} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="edit_med_insurance">Medical Insurance Category</Label>
                      <Input id="edit_med_insurance" placeholder="e.g. VIP, Standard, Enhanced" value={form.medical_insurance_category} onChange={(e) => setForm({ ...form, medical_insurance_category: e.target.value })} />
                    </div>
                  </TabsContent>
                </Tabs>

                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                  <Button onClick={() => updateEmployee.mutate()} disabled={!form.email || !form.full_name || !form.manager_email || updateEmployee.isPending} style={{ background: "var(--gradient-brand)" }}>
                    {updateEmployee.isPending ? "Saving…" : "Save changes"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {/* Details Dashboard Tabs */}
          <Tabs defaultValue="overview" className="w-full space-y-6">
            <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full h-11 p-1 bg-muted/40 rounded-xl border border-border/40">
              <TabsTrigger value="overview" className="text-xs font-semibold rounded-lg gap-2">
                <Briefcase className="h-3.5 w-3.5 shrink-0" />
                Work Details
              </TabsTrigger>
              <TabsTrigger value="personal" className="text-xs font-semibold rounded-lg gap-2">
                <User className="h-3.5 w-3.5 shrink-0" />
                Personal Profile
              </TabsTrigger>
              <TabsTrigger value="legal" className="text-xs font-semibold rounded-lg gap-2">
                <Fingerprint className="h-3.5 w-3.5 shrink-0" />
                Legal & ID
              </TabsTrigger>
              <TabsTrigger value="financials" className="text-xs font-semibold rounded-lg gap-2">
                <DollarSign className="h-3.5 w-3.5 shrink-0" />
                Compensation
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: OVERVIEW & WORK */}
            <TabsContent value="overview" className="outline-none space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <DetailCard title="Organization Context" icon={Building2}>
                  <DetailRow label="Department" value={department} />
                  <DetailRow label="Reports To (Manager)" value={reportsTo} isEmail copyKey="mgrEmail" onCopy={(v) => copyToClipboard(v, "mgrEmail")} copied={copiedKey === "mgrEmail"} />
                  <DetailRow label="HR Partner" value={hrEmail} isEmail copyKey="hrEmail" onCopy={(v) => copyToClipboard(v, "hrEmail")} copied={copiedKey === "hrEmail"} />
                </DetailCard>

                <DetailCard title="Position Details" icon={Briefcase}>
                  <DetailRow label="Designation" value={designation} />
                  <DetailRow label="System Role" value={role} className="uppercase font-semibold text-xs tracking-wider" />
                  <DetailRow label="Office Location" value={officeLocation} />
                </DetailCard>

                <DetailCard title="Tenure & Status" icon={Calendar}>
                  <DetailRow label="Employment Status" value={employmentStatus} className="capitalize" />
                  <DetailRow label="Contract Type" value={contractType} />
                  <DetailRow label="Joining Date" value={formatDate(joined)} />
                </DetailCard>
              </div>
            </TabsContent>

            {/* TAB 2: PERSONAL PROFILE */}
            <TabsContent value="personal" className="outline-none space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                <DetailCard title="Demographics" icon={User}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DetailRow label="Date of Birth" value={formatDate(emp.date_of_birth)} />
                    <DetailRow label="Gender" value={emp.gender || "—"} />
                    <DetailRow label="Marital Status" value={emp.marital_status || "—"} />
                    <DetailRow label="Nationality" value={emp.nationality || "—"} />
                  </div>
                </DetailCard>

                <DetailCard title="Contact Information" icon={Phone}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DetailRow label="Login Email" value={email} isEmail copyKey="loginEmail" onCopy={(v) => copyToClipboard(v, "loginEmail")} copied={copiedKey === "loginEmail"} />
                    <DetailRow label="Personal Email" value={emp.personal_email} isEmail copyKey="personalEmail" onCopy={(v) => copyToClipboard(v, "personalEmail")} copied={copiedKey === "personalEmail"} />
                    <DetailRow label="Secondary Work Email" value={emp.work_email} isEmail copyKey="workEmail" onCopy={(v) => copyToClipboard(v, "workEmail")} copied={copiedKey === "workEmail"} />
                    <DetailRow label="Contact Number" value={phone} />
                  </div>
                </DetailCard>
              </div>
            </TabsContent>

            {/* TAB 3: LEGAL & IDENTITY */}
            <TabsContent value="legal" className="outline-none space-y-4">
              {/* Alert Warning if documents are expiring soon */}
              {(isExpiringSoon(emp.residence_visa_expiry) || isExpiringSoon(emp.labour_card_expiry)) && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm">
                  <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Document Expiry Alert:</span> Some of the employee's visa or labour cards are expiring in the next 60 days. Please verify and initiate renewals.
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <DetailCard title="Primary Identification" icon={Fingerprint}>
                  <DetailRow
                    label="Emirates ID Number"
                    value={emp.emirates_id_number}
                    copyKey="emiratesId"
                    onCopy={(v) => copyToClipboard(v, "emiratesId")}
                    copied={copiedKey === "emiratesId"}
                    className="font-mono text-sm tracking-wide"
                  />
                  <DetailRow
                    label="Passport Number"
                    value={emp.passport_number}
                    copyKey="passportNum"
                    onCopy={(v) => copyToClipboard(v, "passportNum")}
                    copied={copiedKey === "passportNum"}
                    className="font-mono text-sm tracking-wide"
                  />
                  <DetailRow
                    label="Unified ID (UID) Number"
                    value={emp.uid_number}
                    copyKey="uidNum"
                    onCopy={(v) => copyToClipboard(v, "uidNum")}
                    copied={copiedKey === "uidNum"}
                    className="font-mono text-sm"
                  />
                </DetailCard>

                <DetailCard title="Visa & Work Authorisation" icon={FileText}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DetailRow label="Visa File Number" value={emp.file_number} />
                    <DetailRow label="Visa Sponsorship" value={emp.visa_sponsorship || "—"} />
                    <DetailRow
                      label="Residence Visa Expiry"
                      value={formatDate(emp.residence_visa_expiry)}
                      badge={
                        isExpiringSoon(emp.residence_visa_expiry) ? (
                          <Badge variant="destructive" className="ml-2 px-1.5 py-0 text-[10px] animate-pulse">Expiring Soon</Badge>
                        ) : undefined
                      }
                    />
                    <DetailRow label="Labour Card Number" value={emp.labour_card_number} />
                    <div className="sm:col-span-2">
                      <DetailRow
                        label="Labour Card Expiry"
                        value={formatDate(emp.labour_card_expiry)}
                        badge={
                          isExpiringSoon(emp.labour_card_expiry) ? (
                            <Badge variant="destructive" className="ml-2 px-1.5 py-0 text-[10px] animate-pulse">Expiring Soon</Badge>
                          ) : undefined
                        }
                      />
                    </div>
                  </div>
                </DetailCard>
              </div>
            </TabsContent>

            {/* TAB 4: COMPENSATION & WPS */}
            <TabsContent value="financials" className="outline-none space-y-4">
              <div className="grid gap-4 lg:grid-cols-3">
                {/* Total Salary Summary Block */}
                <Card className="lg:col-span-1 border border-border/60 shadow-sm relative overflow-hidden bg-card flex flex-col justify-between">
                  <div className="absolute right-0 top-0 h-32 w-32 translate-x-10 -translate-y-10 rounded-full opacity-10 blur-xl" style={{ background: "var(--gradient-brand)" }} />
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Wallet className="h-4 w-4 text-muted-foreground" /> Total Monthly Package
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-6">
                    <p className="text-4xl font-extrabold tracking-tight mt-1" style={{ color: "var(--foreground)" }}>
                      {formatCurrency(totalSalary)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-2.5">
                      Combined sum of basic salary and all recurring allowances.
                    </p>
                  </CardContent>
                </Card>

                {/* Allowance Breakdown */}
                <Card className="lg:col-span-2 border border-border/60 shadow-sm bg-card">
                  <CardHeader className="pb-3 border-b border-border/40">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <DollarSign className="h-4.5 w-4.5 text-muted-foreground" /> Compensation Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 px-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DetailRow label="Basic Salary" value={formatCurrency(basicSalary)} className="font-semibold" />
                    <DetailRow label="Housing Allowance (HRA)" value={formatCurrency(hra)} />
                    <DetailRow label="Mobile Allowance" value={formatCurrency(mobileAllowance)} />
                    <DetailRow label="Transportation Allowance" value={formatCurrency(transportationAllowance)} />
                    <div className="sm:col-span-2">
                      <DetailRow label="Other Allowances" value={formatCurrency(otherAllowance)} />
                    </div>
                  </CardContent>
                </Card>

                {/* WPS & Benefits */}
                <Card className="lg:col-span-3 border border-border/60 shadow-sm bg-card">
                  <CardHeader className="pb-3 border-b border-border/40">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Globe className="h-4.5 w-4.5 text-muted-foreground" /> WPS & Benefits Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                    <DetailRow label="WPS Payment Status" value={emp.wps || "—"} />
                    <DetailRow label="WPS Unique ID" value={emp.wps_unique_id} />
                    <DetailRow label="Flight Ticket Benefits" value={emp.flight_ticket || "—"} badge={<Plane className="h-3.5 w-3.5 text-muted-foreground ml-1.5" />} />
                    <DetailRow label="Medical Insurance Category" value={emp.medical_insurance_category || "—"} badge={<Heart className="h-3.5 w-3.5 text-muted-foreground ml-1.5" />} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}

// Subcomponents to keep code clean and modular

function DetailCard({
  title,
  icon: Icon,
  children
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Card className="border border-border/60 shadow-sm bg-card h-full">
      <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center gap-2.5 space-y-0 py-4">
        <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 px-5 space-y-4">{children}</CardContent>
    </Card>
  );
}

function DetailRow({
  label,
  value,
  isEmail,
  copyKey,
  onCopy,
  copied,
  className,
  badge
}: {
  label: string;
  value?: string | number | null;
  isEmail?: boolean;
  copyKey?: string;
  onCopy?: (val: string) => void;
  copied?: boolean;
  className?: string;
  badge?: React.ReactNode;
}) {
  const displayVal = value !== undefined && value !== null && String(value).trim() !== "" ? String(value) : "—";
  const hasValue = displayVal !== "—";

  return (
    <div className="group min-w-0">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-1.5 mt-1">
        {isEmail && hasValue ? (
          <a
            href={`mailto:${displayVal}`}
            className={`text-sm font-medium text-primary hover:underline truncate ${className ?? ""}`}
          >
            {displayVal}
          </a>
        ) : (
          <span className={`text-sm font-medium text-foreground truncate ${className ?? ""}`}>
            {displayVal}
          </span>
        )}
        {badge}
        {copyKey && hasValue && onCopy && (
          <button
            onClick={() => onCopy(displayVal)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
            title={`Copy ${label}`}
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}