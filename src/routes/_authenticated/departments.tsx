import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  Building2,
  Pencil,
  Trash2,
  Users,
  ShieldAlert,
  FolderOpen,
  Mail,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { getRoleFromToken, getToken, getPermissionsFromToken } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/departments")({
  head: () => ({ meta: [{ title: "Departments — HRMS" }] }),
  beforeLoad: () => {
    const token = getToken();
    const role = getRoleFromToken(token)?.toLowerCase().trim();
    const permissions = getPermissionsFromToken(token);
    if (role !== "admin" && !permissions.includes("manage_departments")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: DepartmentsPage,
});

function initials(name?: string) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function DepartmentsPage() {
  const qc = useQueryClient();

  // Dialog States
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Search & Filter
  const [search, setSearch] = useState("");

  // Form States
  const [form, setForm] = useState({ name: "", manager_email: "", hr_email: "" });
  const [editingDept, setEditingDept] = useState<any>(null); // { id, name, manager_email, hr_email }
  const [deletingDept, setDeletingDept] = useState<any>(null); // { id, name }

  // Queries
  const { data: deptData, isLoading: isLoadingDepts } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api<any>("/departments/list"),
  });

  const { data: empsData } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api<any>("/employees/list"),
  });

  const { data: projectsData } = useQuery({
    queryKey: ["projects", true], // Load all to count department projects
    queryFn: () => api<any>("/projects", { query: { include_archived: "true" } }),
  });

  // Data Mappers
  const items: any[] = useMemo(() => {
    if (!deptData) return [];
    return Array.isArray(deptData) ? deptData : (deptData.departments ?? deptData.items ?? []);
  }, [deptData]);

  const employees: any[] = useMemo(() => {
    if (!empsData) return [];
    return Array.isArray(empsData) ? empsData : (empsData.employees ?? empsData.items ?? []);
  }, [empsData]);

  const projects: any[] = useMemo(() => {
    if (!projectsData) return [];
    return Array.isArray(projectsData)
      ? projectsData
      : (projectsData.projects ?? projectsData.items ?? []);
  }, [projectsData]);

  // Compute stats and headcounts
  const departmentHeadcounts = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach((emp) => {
      if (emp.department) {
        counts[emp.department] = (counts[emp.department] || 0) + 1;
      }
    });
    return counts;
  }, [employees]);

  const departmentProjectsCount = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach((proj) => {
      if (proj.department) {
        counts[proj.department] = (counts[proj.department] || 0) + 1;
      } else if (proj.department_name) {
        counts[proj.department_name] = (counts[proj.department_name] || 0) + 1;
      }
    });
    return counts;
  }, [projects]);

  const activeEmployees = useMemo(() => {
    return employees.filter((e) => e.is_active !== false);
  }, [employees]);

  // Mutations
  const create = useMutation({
    mutationFn: () => {
      // Clean empty strings to undefined
      const payload = {
        name: form.name,
        manager_email: form.manager_email || undefined,
        hr_email: form.hr_email || undefined,
      };
      return api("/departments/create", { method: "POST", body: payload });
    },
    onSuccess: () => {
      toast.success("Department created successfully");
      qc.invalidateQueries({ queryKey: ["departments"] });
      setOpen(false);
      setForm({ name: "", manager_email: "", hr_email: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: () => {
      const payload = {
        department_id: editingDept.id,
        name: editingDept.name || undefined,
        manager_email: editingDept.manager_email || null, // allow null clearing
        hr_email: editingDept.hr_email || null,
      };
      return api("/departments/update", { method: "PUT", body: payload });
    },
    onSuccess: () => {
      toast.success("Department updated successfully");
      qc.invalidateQueries({ queryKey: ["departments"] });
      setEditOpen(false);
      setEditingDept(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/departments/${id}`, { method: "DELETE" }),
    onSuccess: (res: any) => {
      toast.success(res?.message ?? "Department deleted successfully");
      qc.invalidateQueries({ queryKey: ["departments"] });
      setDeleteOpen(false);
      setDeletingDept(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Filtered List
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((d) => {
      if (!q) return true;
      return (
        (d.name ?? "").toLowerCase().includes(q) ||
        (d.manager_email ?? "").toLowerCase().includes(q) ||
        (d.hr_email ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  const openEdit = (dept: any) => {
    setEditingDept({
      id: dept.id ?? dept.department_id,
      name: dept.name ?? "",
      manager_email: dept.manager_email ?? "",
      hr_email: dept.hr_email ?? "",
    });
    setEditOpen(true);
  };

  const openDelete = (dept: any) => {
    setDeletingDept({
      id: dept.id ?? dept.department_id,
      name: dept.name ?? "",
      headcount: departmentHeadcounts[dept.name] || 0,
      projectsCount: departmentProjectsCount[dept.name] || 0,
    });
    setDeleteOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Departments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Directory of all operational units, designated line managers, and HR partners.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              className="shadow-[var(--shadow-brand)] cursor-pointer"
              style={{ background: "var(--gradient-brand)" }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add department
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Department</DialogTitle>
              <DialogDescription>
                Create a department with assigned manager and HR partners.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3.5 my-2">
              <div className="space-y-1">
                <Label htmlFor="name">
                  Department Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="e.g. Technology"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="manager_email">
                  Line Manager <span className="text-muted-foreground text-xs">(Optional)</span>
                </Label>
                <select
                  id="manager_email"
                  value={form.manager_email}
                  onChange={(e) => setForm({ ...form, manager_email: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background dark:bg-zinc-950 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select Manager</option>
                  {activeEmployees.map((e) => (
                    <option key={e.email} value={e.email}>
                      {e.full_name ?? e.name} ({e.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="hr_email">
                  HR Partner <span className="text-muted-foreground text-xs">(Optional)</span>
                </Label>
                <select
                  id="hr_email"
                  value={form.hr_email}
                  onChange={(e) => setForm({ ...form, hr_email: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background dark:bg-zinc-950 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select HR Partner</option>
                  {activeEmployees.map((e) => (
                    <option key={e.email} value={e.email}>
                      {e.full_name ?? e.name} ({e.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => create.mutate()}
                disabled={!form.name || create.isPending}
                style={{ background: "var(--gradient-brand)" }}
              >
                {create.isPending ? "Creating…" : "Create department"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Building2} label="Total Departments" value={items.length} />
        <StatCard icon={Users} label="Total Headcount" value={employees.length} accent />
        <StatCard
          icon={FolderOpen}
          label="Total Active Projects"
          value={projects.filter((p) => !p.is_archived).length}
        />
      </div>

      {/* Search Filter Card */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, manager or HR partner…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Departments Table list */}
      {isLoadingDepts ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-16" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border border-border/60">
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            No departments match your filters.
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-border/60 overflow-hidden bg-card shadow-soft">
          <CardContent className="p-0">
            <Table className="min-w-[650px]">
              <TableHeader className="bg-muted/5 border-b border-border/40">
                <TableRow>
                  <TableHead className="w-[30%] text-[10px] font-bold uppercase tracking-wider text-muted-foreground pl-6">
                    Department Name
                  </TableHead>
                  <TableHead className="w-[25%] text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Line Manager
                  </TableHead>
                  <TableHead className="w-[25%] text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    HR Partner
                  </TableHead>
                  <TableHead className="w-[10%] text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Headcount
                  </TableHead>
                  <TableHead className="w-[10%] text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right pr-6">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d, i) => {
                  const id = d.id ?? d.department_id ?? `dept-${i}`;
                  const count = departmentHeadcounts[d.name] || 0;
                  const projectsCount = departmentProjectsCount[d.name] || 0;

                  // Find Manager Name
                  const managerEmp = employees.find((e) => e.email === d.manager_email);
                  const managerName = managerEmp ? (managerEmp.full_name ?? managerEmp.name) : null;

                  // Find HR Name
                  const hrEmp = employees.find((e) => e.email === d.hr_email);
                  const hrName = hrEmp ? (hrEmp.full_name ?? hrEmp.name) : null;

                  return (
                    <TableRow
                      key={id}
                      className="hover:bg-muted/15 transition-colors group border-b border-border/40 last:border-b-0"
                    >
                      <TableCell className="align-middle py-4 pl-6">
                        <div className="flex items-center gap-3.5">
                          <div
                            className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-semibold text-sm shrink-0 shadow-sm"
                            style={{ background: "var(--gradient-brand)" }}
                          >
                            {initials(d.name)}
                          </div>
                          <div>
                            <span className="font-bold text-sm text-foreground block tracking-tight">
                              {d.name ?? "—"}
                            </span>
                            {projectsCount > 0 && (
                              <span className="text-[10px] text-primary bg-primary/5 border border-primary/10 px-2 py-0.5 rounded-full font-medium mt-1 inline-flex items-center gap-1 shadow-sm">
                                <FolderOpen className="h-3 w-3" /> {projectsCount}{" "}
                                {projectsCount === 1 ? "project" : "projects"}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="align-middle text-xs">
                        {d.manager_email ? (
                          <div className="min-w-0">
                            <span className="font-semibold block text-foreground text-sm">
                              {managerName ?? "Manager"}
                            </span>
                            <span className="text-muted-foreground truncate block text-xs mt-0.5">
                              {d.manager_email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60 italic text-xs">
                            Unassigned
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="align-middle text-xs">
                        {d.hr_email ? (
                          <div className="min-w-0">
                            <span className="font-semibold block text-foreground text-sm">
                              {hrName ?? "HR Partner"}
                            </span>
                            <span className="text-muted-foreground truncate block text-xs mt-0.5">
                              {d.hr_email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60 italic text-xs">
                            Unassigned
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="align-middle">
                        <Badge
                          variant={count > 0 ? "secondary" : "outline"}
                          className="gap-1 font-medium text-xs rounded-full"
                        >
                          <Users className="h-3 w-3 text-muted-foreground" />
                          {count} {count === 1 ? "member" : "members"}
                        </Badge>
                      </TableCell>

                      <TableCell className="align-middle text-right pr-6">
                        <div className="inline-flex gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Edit Department"
                            onClick={() => openEdit(d)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                            title="Delete Department"
                            onClick={() => openDelete(d)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* EDIT DEPARTMENT DIALOG */}
      {editingDept && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Department Details</DialogTitle>
              <DialogDescription>Update department configuration details.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3.5 my-2">
              <div className="space-y-1">
                <Label htmlFor="edit_name">
                  Department Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit_name"
                  value={editingDept.name}
                  onChange={(e) => setEditingDept({ ...editingDept, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit_manager_email">Line Manager</Label>
                <select
                  id="edit_manager_email"
                  value={editingDept.manager_email}
                  onChange={(e) =>
                    setEditingDept({ ...editingDept, manager_email: e.target.value })
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background dark:bg-zinc-950 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">No Manager Assigned</option>
                  {activeEmployees.map((e) => (
                    <option key={e.email} value={e.email}>
                      {e.full_name ?? e.name} ({e.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit_hr_email">HR Partner</Label>
                <select
                  id="edit_hr_email"
                  value={editingDept.hr_email}
                  onChange={(e) => setEditingDept({ ...editingDept, hr_email: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background dark:bg-zinc-950 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">No HR Partner Assigned</option>
                  {activeEmployees.map((e) => (
                    <option key={e.email} value={e.email}>
                      {e.full_name ?? e.name} ({e.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEditOpen(false);
                  setEditingDept(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => update.mutate()}
                disabled={!editingDept.name || update.isPending}
                style={{ background: "var(--gradient-brand)" }}
              >
                {update.isPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* DELETE DEPARTMENT CONFIRMATION */}
      {deletingDept && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="max-w-md border-destructive/20 bg-card">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-5 w-5 shrink-0" /> Delete Department
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the department{" "}
                <strong className="text-foreground">"{deletingDept.name}"</strong>?
              </DialogDescription>
            </DialogHeader>

            <div className="my-2 space-y-3.5 text-sm">
              {deletingDept.headcount > 0 ? (
                <div className="p-3.5 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-xs font-semibold leading-relaxed flex gap-2">
                  <ShieldAlert className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <div>
                    Cannot delete this department directly: There are currently{" "}
                    <strong className="underline">{deletingDept.headcount}</strong> employees
                    assigned to it. You must re-assign them first.
                  </div>
                </div>
              ) : deletingDept.projectsCount > 0 ? (
                <div className="p-3.5 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-xs font-semibold leading-relaxed flex gap-2">
                  <ShieldAlert className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <div>
                    Cannot delete this department directly: There are currently{" "}
                    <strong className="underline">{deletingDept.projectsCount}</strong> projects
                    assigned to it. You must re-assign or delete those projects first.
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  This action is permanent and cannot be undone. This will delete the department
                  configuration records.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeletingDept(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={
                  deletingDept.headcount > 0 || deletingDept.projectsCount > 0 || remove.isPending
                }
                onClick={() => remove.mutate(deletingDept.id)}
              >
                {remove.isPending ? "Deleting…" : "Confirm delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <Card className="border-border/60 shadow-soft bg-card hover:-translate-y-0.5 hover:shadow-md hover:border-primary/20 transition-all duration-300">
      <CardContent className="p-5 flex items-center gap-4">
        <div
          className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
          style={
            accent
              ? { background: "var(--gradient-brand)" }
              : { background: "var(--gradient-subtle)", border: "1px solid var(--border)" }
          }
        >
          <Icon className={"h-5 w-5 " + (accent ? "text-white" : "text-primary")} />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          <p className="text-3xl font-bold tracking-tight mt-1">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
