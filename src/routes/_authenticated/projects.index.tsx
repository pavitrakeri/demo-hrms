import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus,
  FolderKanban,
  Calendar,
  Users,
  ListTodo,
  Search,
  ArrowRight,
  Building,
  LayoutGrid,
  List,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({ meta: [{ title: "Projects — HRMS" }] }),
  component: ProjectsPage,
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

function ProjectsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list"); // Defaults to List View for professional alignment

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");

  // Queries
  const { data: projectsData, isLoading: isLoadingProjects } = useQuery({
    queryKey: ["projects", includeArchived],
    queryFn: () => api<any>("/projects", { query: { include_archived: includeArchived } }),
  });

  const { data: deptsData } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api<any>("/departments/list"),
  });

  const { data: empsData } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api<any>("/employees/list"),
  });

  // Data helpers
  const projects: any[] = useMemo(() => {
    if (!projectsData) return [];
    return Array.isArray(projectsData)
      ? projectsData
      : (projectsData.projects ?? projectsData.items ?? []);
  }, [projectsData]);

  const departments: any[] = useMemo(() => {
    if (!deptsData) return [];
    return Array.isArray(deptsData) ? deptsData : (deptsData.departments ?? deptsData.items ?? []);
  }, [deptsData]);

  const employees: any[] = useMemo(() => {
    if (!empsData) return [];
    const list = Array.isArray(empsData) ? empsData : (empsData.employees ?? empsData.items ?? []);
    return list.filter((e: any) => e.is_active !== false);
  }, [empsData]);

  const filteredEmployees = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        (e.full_name ?? e.name ?? "").toLowerCase().includes(q) ||
        (e.email ?? "").toLowerCase().includes(q),
    );
  }, [employees, memberSearch]);

  const createProject = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        description: description || undefined,
        department_id: departmentId || undefined,
        start_date: startDate || undefined,
        deadline: deadline || undefined,
        member_ids: memberIds.length > 0 ? memberIds : undefined,
      };
      return api("/projects", { method: "POST", body: payload });
    },
    onSuccess: () => {
      toast.success("Project created successfully");
      qc.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
      // Reset Form
      setName("");
      setDescription("");
      setDepartmentId("");
      setStartDate("");
      setDeadline("");
      setMemberIds([]);
      setMemberSearch("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeProjectsCount = projects.filter((p) => p.status === "active").length;
  const archivedProjectsCount = projects.filter((p) => p.status === "archived").length;

  // Split assigned members string into array
  const getMemberNames = (assignedToStr?: string) => {
    if (!assignedToStr) return [];
    return assignedToStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Plan, monitor, and coordinate team projects and tasks.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                className="shadow-[var(--shadow-brand)]"
                style={{ background: "var(--gradient-brand)" }}
              >
                <Plus className="h-4 w-4 mr-2" />
                New project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Create Project</DialogTitle>
                <DialogDescription>Add a new team project and assign members.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="p-name">
                    Project Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="p-name"
                    placeholder="e.g. Website Redesign"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="p-desc">Description</Label>
                  <Textarea
                    id="p-desc"
                    placeholder="Describe the project scope and deliverables..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="p-dept">Department</Label>
                  <select
                    id="p-dept"
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="" className="text-black bg-background">
                      Select a department...
                    </option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id} className="text-black bg-background">
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-start">Start Date</Label>
                  <Input
                    id="p-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-deadline">Deadline</Label>
                  <Input
                    id="p-deadline"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2 border-t pt-3 mt-1">
                  <Label className="text-base font-semibold">Assign Project Members</Label>
                  <div className="relative mt-2 mb-2">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search employees to add..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="pl-9 h-8 text-xs"
                    />
                  </div>
                  <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2 bg-muted/20">
                    {filteredEmployees.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No employees found.
                      </p>
                    ) : (
                      filteredEmployees.map((emp) => {
                        const empId = String(emp.id ?? emp.employee_id ?? emp._id);
                        return (
                          <div key={empId} className="flex items-center space-x-2">
                            <Checkbox
                              id={`emp-${empId}`}
                              checked={memberIds.includes(empId)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setMemberIds([...memberIds, empId]);
                                } else {
                                  setMemberIds(memberIds.filter((id) => id !== empId));
                                }
                              }}
                            />
                            <Label
                              htmlFor={`emp-${empId}`}
                              className="text-xs cursor-pointer flex flex-col"
                            >
                              <span className="font-medium">{emp.full_name ?? emp.name}</span>
                              <span className="text-muted-foreground text-[10px]">{emp.email}</span>
                            </Label>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {memberIds.length > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      Selected {memberIds.length} member(s).
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createProject.mutate()}
                  disabled={!name || createProject.isPending}
                  style={{ background: "var(--gradient-brand)" }}
                >
                  {createProject.isPending ? "Creating…" : "Create project"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats & Layout Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border rounded-xl bg-card">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-sm font-medium">{activeProjectsCount} Active</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
              <span className="text-sm font-medium">{archivedProjectsCount} Archived</span>
            </div>
            <div className="flex items-center space-x-2 pl-2 border-l border-border/80">
              <Switch
                id="include-archived"
                checked={includeArchived}
                onCheckedChange={setIncludeArchived}
              />
              <Label
                htmlFor="include-archived"
                className="text-xs font-medium cursor-pointer text-muted-foreground"
              >
                Include archived
              </Label>
            </div>
          </div>

          {/* Toggle buttons for Grid/List View */}
          <div className="flex items-center rounded-lg border bg-muted/30 p-1 self-start sm:self-center">
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
        </div>

        {/* Projects Render Section */}
        {isLoadingProjects ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="h-20" />
              </Card>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-16 text-center flex flex-col items-center justify-center space-y-3">
              <FolderKanban className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="font-semibold text-lg">No projects found</p>
                <p className="text-sm text-muted-foreground">
                  Create a new project to start scheduling tasks and assigning team members.
                </p>
              </div>
              <Button onClick={() => setOpen(true)} className="mt-2">
                <Plus className="h-4 w-4 mr-2" />
                New project
              </Button>
            </CardContent>
          </Card>
        ) : viewMode === "list" ? (
          /* List View Mode (Professional Table) */
          <Card className="border border-border/60 overflow-hidden bg-card shadow-sm">
            <CardContent className="p-0">
              <Table className="min-w-[650px]">
                <TableHeader className="bg-muted/10">
                  <TableRow>
                    <TableHead className="w-[30%]">Project</TableHead>
                    <TableHead className="w-[18%]">Department</TableHead>
                    <TableHead className="w-[20%]">Timeline</TableHead>
                    <TableHead className="w-[15%]">Team Members</TableHead>
                    <TableHead className="w-[15%]">Task Progress</TableHead>
                    <TableHead className="w-[2%] text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => {
                    const id = p.id ?? p.project_id ?? p._id;
                    const isActive = p.status !== "archived";
                    const memberNames = getMemberNames(p.assigned_to);

                    // Task calculations
                    const taskPercentage =
                      p.task_count > 0
                        ? Math.round(((p.task_count - p.open_task_count) / p.task_count) * 100)
                        : 0;

                    return (
                      <TableRow key={id} className="hover:bg-muted/10 transition-colors group">
                        <TableCell className="align-middle py-3.5">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <Link
                                to="/projects/$projectId"
                                params={{ projectId: String(id) }}
                                className="font-bold text-sm text-foreground hover:underline group-hover:text-primary transition-colors"
                              >
                                {p.name ?? "Untitled Project"}
                              </Link>
                              <Badge
                                variant={isActive ? "secondary" : "outline"}
                                className={`text-[9px] px-1.5 py-0 rounded ${
                                  isActive
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-slate-50 text-slate-600 border-slate-200"
                                }`}
                              >
                                {isActive ? "Active" : "Archived"}
                              </Badge>
                            </div>
                            {p.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1 max-w-[320px]">
                                {p.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="align-middle text-xs">
                          {p.department_name ? (
                            <span className="flex items-center gap-1.5 font-medium">
                              <Building className="h-3.5 w-3.5 text-muted-foreground" />
                              {p.department_name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="align-middle text-xs">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              {p.start_date ?? "—"} <span className="text-[10px] mx-0.5">to</span>{" "}
                              {p.deadline ?? "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="align-middle">
                          {memberNames.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Unassigned</span>
                          ) : (
                            /* Circular avatar stack */
                            <div className="flex -space-x-2 overflow-hidden">
                              {memberNames.slice(0, 4).map((name, idx) => (
                                <Tooltip key={idx}>
                                  <TooltipTrigger asChild>
                                    <div className="inline-flex h-6 w-6 rounded-full ring-2 ring-background bg-gradient-to-tr from-slate-200 to-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-bold cursor-help">
                                      {initials(name)}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs font-semibold">{name}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ))}
                              {memberNames.length > 4 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="inline-flex h-6 w-6 rounded-full ring-2 ring-background bg-slate-800 text-white flex items-center justify-center text-[9px] font-bold cursor-help">
                                      +{memberNames.length - 4}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs font-semibold">
                                      {memberNames.slice(4).join(", ")}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="align-middle text-xs">
                          <div className="space-y-1.5 max-w-[120px]">
                            <div className="flex justify-between items-center text-[10px] font-semibold">
                              <span>{taskPercentage}%</span>
                              <span className="text-muted-foreground font-normal">
                                {p.task_count - p.open_task_count}/{p.task_count}
                              </span>
                            </div>
                            <Progress value={taskPercentage} className="h-1.5 bg-muted" />
                          </div>
                        </TableCell>
                        <TableCell className="align-middle text-right pr-4">
                          <Link
                            to="/projects/$projectId"
                            params={{ projectId: String(id) }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-primary transition-all"
                          >
                            <ArrowRight className="h-4 w-4" />
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
          /* Grid View Mode (Enhanced Cards) */
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const id = p.id ?? p.project_id ?? p._id;
              const isActive = p.status !== "archived";
              const memberNames = getMemberNames(p.assigned_to);

              // Task calculations
              const taskPercentage =
                p.task_count > 0
                  ? Math.round(((p.task_count - p.open_task_count) / p.task_count) * 100)
                  : 0;

              return (
                <Link
                  key={id}
                  to="/projects/$projectId"
                  params={{ projectId: String(id) }}
                  className="group"
                >
                  <Card className="hover:shadow-[var(--shadow-brand)] hover:-translate-y-1 transition-all h-full border border-border/60 hover:border-primary/30 flex flex-col justify-between overflow-hidden bg-card">
                    <div>
                      {/* Status Border accent */}
                      <div
                        className={`h-1 w-full ${isActive ? "bg-gradient-to-r from-indigo-500 to-brand" : "bg-slate-400"}`}
                        style={isActive ? { backgroundImage: "var(--gradient-brand)" } : undefined}
                      />
                      <CardHeader className="p-5 pb-3">
                        <div className="flex justify-between items-start gap-2">
                          <CardTitle className="text-base font-bold truncate group-hover:text-primary transition-colors">
                            {p.name ?? "Untitled Project"}
                          </CardTitle>
                          <Badge
                            variant={isActive ? "secondary" : "outline"}
                            className={`text-[9px] px-1.5 py-0.5 rounded ${
                              isActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-50 text-slate-600 border-slate-200"
                            }`}
                          >
                            {isActive ? "Active" : "Archived"}
                          </Badge>
                        </div>
                        {p.department_name && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 font-medium">
                            <Building className="h-3.5 w-3.5 shrink-0" />
                            {p.department_name}
                          </p>
                        )}
                      </CardHeader>
                      <CardContent className="p-5 pt-0 pb-3 space-y-4">
                        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                          {p.description ?? "No description provided."}
                        </p>

                        <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                            <span>Start: {p.start_date ?? "—"}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                            <span>End: {p.deadline ?? "—"}</span>
                          </div>
                        </div>
                      </CardContent>
                    </div>

                    <CardFooter className="p-5 pt-3 border-t bg-muted/5 flex flex-col gap-3 shrink-0">
                      {/* Avatar list stack */}
                      <div className="w-full flex items-center justify-between text-xs min-w-0">
                        <span className="text-muted-foreground font-medium">Team</span>
                        {memberNames.length === 0 ? (
                          <span className="text-[11px] text-muted-foreground">None</span>
                        ) : (
                          <div className="flex -space-x-1.5 overflow-hidden">
                            {memberNames.slice(0, 3).map((name, idx) => (
                              <Tooltip key={idx}>
                                <TooltipTrigger asChild>
                                  <div className="inline-flex h-5 w-5 rounded-full ring-2 ring-background bg-slate-200 text-slate-700 flex items-center justify-center text-[8px] font-bold cursor-help">
                                    {initials(name)}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-[10px] font-semibold">{name}</p>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                            {memberNames.length > 3 && (
                              <div className="inline-flex h-5 w-5 rounded-full ring-2 ring-background bg-slate-800 text-white flex items-center justify-center text-[8px] font-bold">
                                +{memberNames.length - 3}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Task Progress Bar / Count */}
                      <div className="w-full space-y-1.5 pt-1.5 border-t border-border/40">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <ListTodo className="h-3.5 w-3.5 shrink-0" />
                            <span>Progress</span>
                          </span>
                          <span className="font-bold text-foreground">
                            {taskPercentage}% ({p.task_count - p.open_task_count}/{p.task_count})
                          </span>
                        </div>
                        <Progress value={taskPercentage} className="h-1 bg-muted" />
                      </div>
                    </CardFooter>
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
