import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Shield, Users, Pencil, Trash2, ShieldAlert, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { getRoleFromToken, getToken, getPermissionsFromToken } from "@/lib/auth";

const AVAILABLE_PERMISSIONS = [
  { id: "manage_employees", label: "Manage Employees" },
  { id: "manage_roles", label: "Manage Roles" },
  { id: "manage_departments", label: "Manage Departments" },
  { id: "manage_leaves", label: "Manage Leaves" },
  { id: "manage_payroll", label: "Manage Payroll" },
  { id: "manage_policies", label: "Manage Policies" },
  { id: "manage_recruitment", label: "Manage Recruitment" },
];

export const Route = createFileRoute("/_authenticated/roles")({
  head: () => ({ meta: [{ title: "Roles — HRMS" }] }),
  beforeLoad: () => {
    const token = getToken();
    const role = getRoleFromToken(token)?.toLowerCase().trim();
    const permissions = getPermissionsFromToken(token);
    if (role !== "admin" && !permissions.includes("manage_roles")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: RolesPage,
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

const SYSTEM_ROLES = ["admin", "hr", "employee", "line_manager", "cfo"];

function RolesPage() {
  const qc = useQueryClient();

  // Dialog States
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Search & Filter
  const [search, setSearch] = useState("");

  // Form States
  const [form, setForm] = useState<{ name: string; description: string; permissions: string[] }>({
    name: "",
    description: "",
    permissions: [],
  });
  const [editingRole, setEditingRole] = useState<any>(null); // { id, name, description, permissions }
  const [deletingRole, setDeletingRole] = useState<any>(null); // { id, name }

  // Queries
  const { data: roleData, isLoading: isLoadingRoles } = useQuery({
    queryKey: ["roles"],
    queryFn: () => api<any>("/roles/list"),
  });

  const { data: empsData } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api<any>("/employees/list"),
  });

  // Data Mappers
  const items: any[] = useMemo(() => {
    if (!roleData) return [];
    return Array.isArray(roleData) ? roleData : (roleData.roles ?? roleData.items ?? []);
  }, [roleData]);

  const employees: any[] = useMemo(() => {
    if (!empsData) return [];
    return Array.isArray(empsData) ? empsData : (empsData.employees ?? empsData.items ?? []);
  }, [empsData]);

  // Compute stats and headcounts
  const roleHeadcounts = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach((emp) => {
      if (emp.role) {
        const rName = emp.role.toLowerCase().trim();
        counts[rName] = (counts[rName] || 0) + 1;
      }
    });
    return counts;
  }, [employees]);

  const totalAssignedEmployees = useMemo(() => {
    return employees.filter((e) => e.role && e.is_active !== false).length;
  }, [employees]);

  const customRolesCount = useMemo(() => {
    return items.filter((r) => r.name && !SYSTEM_ROLES.includes(r.name.toLowerCase().trim()))
      .length;
  }, [items]);

  // Mutations
  const create = useMutation({
    mutationFn: () => api("/roles/create", { method: "POST", body: form }),
    onSuccess: () => {
      toast.success("Role created successfully");
      qc.invalidateQueries({ queryKey: ["roles"] });
      setOpen(false);
      setForm({ name: "", description: "", permissions: [] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: () => {
      const payload = {
        role_id: editingRole.id,
        name: editingRole.name || undefined,
        description: editingRole.description || "",
        permissions: editingRole.permissions || [],
      };
      return api("/roles/update", { method: "PUT", body: payload });
    },
    onSuccess: () => {
      toast.success("Role updated successfully");
      qc.invalidateQueries({ queryKey: ["roles"] });
      setEditOpen(false);
      setEditingRole(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/roles/${id}`, { method: "DELETE" }),
    onSuccess: (res: any) => {
      toast.success(res?.message ?? "Role deleted successfully");
      qc.invalidateQueries({ queryKey: ["roles"] });
      setDeleteOpen(false);
      setDeletingRole(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Filtered List
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((r) => {
      if (!q) return true;
      return (
        (r.name ?? "").toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  const openEdit = (role: any) => {
    setEditingRole({
      id: role.id ?? role.role_id,
      name: role.name ?? "",
      description: role.description ?? "",
      permissions: role.permissions ?? [],
    });
    setEditOpen(true);
  };

  const openDelete = (role: any) => {
    const rName = (role.name ?? "").toLowerCase().trim();
    setDeletingRole({
      id: role.id ?? role.role_id,
      name: role.name ?? "",
      headcount: roleHeadcounts[rName] || 0,
      isSystem: SYSTEM_ROLES.includes(rName),
    });
    setDeleteOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roles</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Directory of system authorization levels and employee role scopes.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              className="shadow-[var(--shadow-brand)] cursor-pointer"
              style={{ background: "var(--gradient-brand)" }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add role
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Role</DialogTitle>
              <DialogDescription>Create a system role with distinct scopes.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3.5 my-2">
              <div className="space-y-1">
                <Label htmlFor="name">
                  Role Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="e.g. Technical Lead"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="description">
                  Description <span className="text-muted-foreground text-xs">(Optional)</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe the scope and responsibilities..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="space-y-3 pt-2">
                <Label>Permissions</Label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_PERMISSIONS.map((perm) => (
                    <div key={perm.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`perm-${perm.id}`}
                        checked={form.permissions.includes(perm.id)}
                        onCheckedChange={(checked) => {
                          setForm((prev) => ({
                            ...prev,
                            permissions: checked
                              ? [...prev.permissions, perm.id]
                              : prev.permissions.filter((p) => p !== perm.id),
                          }));
                        }}
                      />
                      <label
                        htmlFor={`perm-${perm.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {perm.label}
                      </label>
                    </div>
                  ))}
                </div>
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
                {create.isPending ? "Creating…" : "Create role"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Shield} label="Total System Roles" value={items.length} />
        <StatCard icon={Users} label="Assigned Employees" value={totalAssignedEmployees} accent />
        <StatCard icon={UserCheck} label="Custom Roles" value={customRolesCount} />
      </div>

      {/* Search Filter Card */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search roles by name or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Roles Table list */}
      {isLoadingRoles ? (
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
            No roles match your filters.
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-border/60 overflow-hidden bg-card shadow-soft">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/5 border-b border-border/40">
                <TableRow>
                  <TableHead className="w-[30%] text-[10px] font-bold uppercase tracking-wider text-muted-foreground pl-6">
                    Role Name
                  </TableHead>
                  <TableHead className="w-[35%] text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Description
                  </TableHead>
                  <TableHead className="w-[10%] text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Permissions
                  </TableHead>
                  <TableHead className="w-[15%] text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Headcount
                  </TableHead>
                  <TableHead className="w-[10%] text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right pr-6">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r, i) => {
                  const id = r.id ?? r.role_id ?? `role-${i}`;
                  const rName = (r.name ?? "").toLowerCase().trim();
                  const count = roleHeadcounts[rName] || 0;
                  const isSystem = SYSTEM_ROLES.includes(rName);

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
                            {initials(r.name)}
                          </div>
                          <div>
                            <span className="font-bold text-sm text-foreground block tracking-tight">
                              {r.name ?? "—"}
                            </span>
                            {isSystem && (
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.2 rounded-md font-medium mt-1 inline-block">
                                System Default
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="align-middle text-sm text-muted-foreground max-w-sm truncate">
                        {r.description ? (
                          <span>{r.description}</span>
                        ) : (
                          <span className="text-muted-foreground/60 italic text-xs">
                            No description provided
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="align-middle">
                        <Badge variant="outline" className="text-xs font-normal">
                          {r.permissions?.length || 0} permissions
                        </Badge>
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
                            title="Edit Role"
                            onClick={() => openEdit(r)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                            title="Delete Role"
                            onClick={() => openDelete(r)}
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

      {/* EDIT ROLE DIALOG */}
      {editingRole && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Role Details</DialogTitle>
              <DialogDescription>Update role configuration and scopes.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3.5 my-2">
              <div className="space-y-1">
                <Label htmlFor="edit_name">
                  Role Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit_name"
                  value={editingRole.name}
                  onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit_description">Description</Label>
                <Textarea
                  id="edit_description"
                  value={editingRole.description}
                  onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })}
                />
              </div>
              <div className="space-y-3 pt-2">
                <Label>Permissions</Label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_PERMISSIONS.map((perm) => (
                    <div key={perm.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-perm-${perm.id}`}
                        checked={editingRole.permissions?.includes(perm.id)}
                        onCheckedChange={(checked) => {
                          setEditingRole((prev: any) => ({
                            ...prev,
                            permissions: checked
                              ? [...(prev.permissions || []), perm.id]
                              : (prev.permissions || []).filter((p: string) => p !== perm.id),
                          }));
                        }}
                      />
                      <label
                        htmlFor={`edit-perm-${perm.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {perm.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEditOpen(false);
                  setEditingRole(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => update.mutate()}
                disabled={!editingRole.name || update.isPending}
                style={{ background: "var(--gradient-brand)" }}
              >
                {update.isPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* DELETE ROLE CONFIRMATION */}
      {deletingRole && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="max-w-md border-destructive/20 bg-card">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-5 w-5 shrink-0" /> Delete Role
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the role{" "}
                <strong className="text-foreground">"{deletingRole.name}"</strong>?
              </DialogDescription>
            </DialogHeader>

            <div className="my-2 space-y-3.5 text-sm">
              {deletingRole.isSystem ? (
                <div className="p-3.5 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-xs font-semibold leading-relaxed flex gap-2">
                  <ShieldAlert className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <div>
                    Cannot delete this role:{" "}
                    <strong className="underline">"{deletingRole.name}"</strong> is a protected
                    system default role. These roles are critical for core HRMS workflow
                    authentication.
                  </div>
                </div>
              ) : deletingRole.headcount > 0 ? (
                <div className="p-3.5 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-xs font-semibold leading-relaxed flex gap-2">
                  <ShieldAlert className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <div>
                    Cannot delete this role: There are currently{" "}
                    <strong className="underline">{deletingRole.headcount}</strong> employees
                    assigned to it. You must re-assign them first.
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  This action is permanent and cannot be undone. This will delete the role
                  configuration records.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeletingRole(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deletingRole.isSystem || deletingRole.headcount > 0 || remove.isPending}
                onClick={() => remove.mutate(deletingRole.id)}
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
