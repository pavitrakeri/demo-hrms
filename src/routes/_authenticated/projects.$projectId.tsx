import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Plus,
  Archive,
  Calendar,
  Users,
  Edit,
  Trash2,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  UserCheck
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  head: () => ({ meta: [{ title: "Project Details — HRMS" }] }),
  component: ProjectDetail,
});

const TASK_STATUSES = ["todo", "in_progress", "done"];

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Dialog states
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);

  // Edit Project Form state
  const [projName, setProjName] = useState("");
  const [projDesc, setProjDesc] = useState("");
  const [projStart, setProjStart] = useState("");
  const [projDeadline, setProjDeadline] = useState("");
  const [projMembers, setProjMembers] = useState<string[]>([]);
  const [empSearch, setEmpSearch] = useState("");

  // New Task Form state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskStatus, setTaskStatus] = useState("todo");

  // Task list filters
  const [taskStatusFilter, setTaskStatusFilter] = useState("all");

  // Project Details Query
  const { data: projectData, isLoading: isLoadingProject } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api<any>(`/projects/${projectId}`),
  });

  // Tasks Query
  const { data: tasksData, isLoading: isLoadingTasks } = useQuery({
    queryKey: ["project", projectId, "tasks", taskStatusFilter],
    queryFn: () =>
      api<any>(`/projects/${projectId}/tasks`, {
        query: taskStatusFilter !== "all" ? { status: taskStatusFilter } : undefined,
      }),
  });

  // All Employees Query (needed for editing project members)
  const { data: empsData } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api<any>("/employees/list"),
    enabled: isEditOpen, // Only fetch when edit modal is open
  });

  const employees: any[] = useMemo(() => {
    if (!empsData) return [];
    const list = Array.isArray(empsData) ? empsData : empsData.employees ?? empsData.items ?? [];
    return list.filter((e: any) => e.is_active !== false);
  }, [empsData]);

  const filteredEmployees = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        (e.full_name ?? e.name ?? "").toLowerCase().includes(q) ||
        (e.email ?? "").toLowerCase().includes(q)
    );
  }, [employees, empSearch]);

  const p = projectData?.project ?? {};
  const members: any[] = projectData?.members ?? [];
  const tasks: any[] = useMemo(() => {
    if (!tasksData) return [];
    return Array.isArray(tasksData) ? tasksData : tasksData.tasks ?? tasksData.items ?? [];
  }, [tasksData]);

  // Populate Edit Form on load
  useEffect(() => {
    if (projectData?.project) {
      setProjName(p.name ?? "");
      setProjDesc(p.description ?? "");
      setProjStart(p.start_date ?? "");
      setProjDeadline(p.deadline ?? "");
      setProjMembers(members.map((m) => m.user_id));
    }
  }, [projectData]);

  // Edit Project Mutation
  const updateProject = useMutation({
    mutationFn: () => {
      const payload = {
        name: projName,
        description: projDesc || "",
        start_date: projStart || null,
        deadline: projDeadline || null,
        member_ids: projMembers,
      };
      return api(`/projects/${projectId}`, { method: "PUT", body: payload });
    },
    onSuccess: () => {
      toast.success("Project updated successfully");
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      setIsEditOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Archive Project Mutation
  const archiveProject = useMutation({
    mutationFn: () => api(`/projects/${projectId}/archive`, { method: "PATCH" }),
    onSuccess: () => {
      toast.success("Project archived successfully");
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete Project Mutation
  const deleteProject = useMutation({
    mutationFn: () => api(`/projects/${projectId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Project deleted successfully");
      qc.invalidateQueries({ queryKey: ["projects"] });
      navigate({ to: "/projects" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Create Task Mutation
  const createTask = useMutation({
    mutationFn: () => {
      const payload = {
        title: taskTitle,
        description: taskDesc || undefined,
        assignee_id: taskAssignee || undefined,
        due_date: taskDueDate || undefined,
        status: taskStatus,
      };
      return api(`/projects/${projectId}/tasks`, { method: "POST", body: payload });
    },
    onSuccess: () => {
      toast.success("Task created successfully");
      qc.invalidateQueries({ queryKey: ["project", projectId, "tasks"] });
      qc.invalidateQueries({ queryKey: ["project", projectId] }); // Update task counts
      setIsNewTaskOpen(false);
      // Reset Task Form
      setTaskTitle("");
      setTaskDesc("");
      setTaskAssignee("");
      setTaskDueDate("");
      setTaskStatus("todo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Update Task Status Mutation
  const updateTaskStatus = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      api(`/tasks/${taskId}/status`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      toast.success("Task status updated");
      qc.invalidateQueries({ queryKey: ["project", projectId, "tasks"] });
      qc.invalidateQueries({ queryKey: ["project", projectId] }); // Update task counts
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete Task Mutation
  const deleteTask = useMutation({
    mutationFn: (taskId: string) => api(`/tasks/${taskId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Task deleted successfully");
      qc.invalidateQueries({ queryKey: ["project", projectId, "tasks"] });
      qc.invalidateQueries({ queryKey: ["project", projectId] }); // Update task counts
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoadingProject) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading project...</div>;
  }

  if (!projectData || !p.id) {
    return (
      <div className="space-y-4 text-center py-12">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">Project not found</h2>
        <Link to="/projects" className="text-primary hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to projects
        </Link>
      </div>
    );
  }

  const isArchived = p.status === "archived";

  return (
    <div className="space-y-6">
      {/* Back Link & Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <Link
            to="/projects"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to projects
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{p.name}</h1>
            <Badge
              variant={isArchived ? "outline" : "secondary"}
              className={
                isArchived
                  ? "bg-slate-50 text-slate-600 border-slate-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }
            >
              {isArchived ? "Archived" : "Active"}
            </Badge>
          </div>
          {p.department_name && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Building className="h-4 w-4 text-muted-foreground/80" />
              {p.department_name} Department
            </p>
          )}
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2">
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Edit className="h-4 w-4 mr-2" /> Edit project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Edit Project</DialogTitle>
                <DialogDescription>Update project information and edit team members.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-name">Project Name <span className="text-destructive">*</span></Label>
                  <Input id="edit-name" value={projName} onChange={(e) => setProjName(e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-desc">Description</Label>
                  <Textarea id="edit-desc" value={projDesc} onChange={(e) => setProjDesc(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-start">Start Date</Label>
                  <Input id="edit-start" type="date" value={projStart} onChange={(e) => setProjStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-deadline">Deadline</Label>
                  <Input id="edit-deadline" type="date" value={projDeadline} onChange={(e) => setProjDeadline(e.target.value)} />
                </div>

                <div className="space-y-2 sm:col-span-2 border-t pt-3 mt-1">
                  <Label className="text-base font-semibold">Manage Project Members</Label>
                  <div className="relative mt-2 mb-2">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search employees to add/remove..."
                      value={empSearch}
                      onChange={(e) => setEmpSearch(e.target.value)}
                      className="pl-9 h-8 text-xs"
                    />
                  </div>
                  <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2 bg-muted/20">
                    {filteredEmployees.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No employees found.</p>
                    ) : (
                      filteredEmployees.map((emp) => {
                        const empId = String(emp.id ?? emp.employee_id ?? emp._id);
                        return (
                          <div key={empId} className="flex items-center space-x-2">
                            <Checkbox
                              id={`edit-emp-${empId}`}
                              checked={projMembers.includes(empId)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setProjMembers([...projMembers, empId]);
                                } else {
                                  setProjMembers(projMembers.filter((id) => id !== empId));
                                }
                              }}
                            />
                            <Label htmlFor={`edit-emp-${empId}`} className="text-xs cursor-pointer flex flex-col">
                              <span className="font-medium">{emp.full_name ?? emp.name}</span>
                              <span className="text-muted-foreground text-[10px]">{emp.email}</span>
                            </Label>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => updateProject.mutate()}
                  disabled={!projName || updateProject.isPending}
                  style={{ background: "var(--gradient-brand)" }}
                >
                  {updateProject.isPending ? "Saving…" : "Save changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="sm"
            className="h-9 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => {
              if (window.confirm("Are you sure you want to archive this project?")) {
                archiveProject.mutate();
              }
            }}
            disabled={isArchived || archiveProject.isPending}
          >
            <Archive className="h-4 w-4 mr-2" />
            {isArchived ? "Archived" : "Archive project"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9 hover:bg-destructive/10 hover:text-destructive border-input"
            onClick={() => {
              if (window.confirm("Are you sure you want to permanently delete this project? This will delete all project members and tasks!")) {
                deleteProject.mutate();
              }
            }}
            disabled={deleteProject.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete project
          </Button>
        </div>
      </div>

      {/* Grid Layout: Left Detail & Members, Right Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Project Overview */}
        <div className="space-y-6 lg:col-span-1">
          {/* Detail Card */}
          <Card className="border border-border/60">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-bold">Project Details</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-4 text-sm">
              <p className="text-muted-foreground leading-relaxed">
                {p.description ?? "No description provided."}
              </p>

              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Start Date
                  </span>
                  <span className="font-semibold">{p.start_date ?? "—"}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Deadline
                  </span>
                  <span className="font-semibold">{p.deadline ?? "—"}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5" /> Created By
                  </span>
                  <span className="font-semibold truncate max-w-[150px]">{p.creator_name ?? p.creator_email ?? "—"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Members Card */}
          <Card className="border border-border/60">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Users className="h-4 w-4" /> Team Members ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {members.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No members assigned.</p>
              ) : (
                <div className="divide-y divide-border/50 max-h-[300px] overflow-y-auto pr-1">
                  {members.map((m) => (
                    <div key={m.user_id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{m.full_name ?? m.email}</p>
                        <p className="text-muted-foreground text-[10px] truncate">{m.email}</p>
                      </div>
                      <Badge
                        variant={m.role === "owner" ? "default" : "secondary"}
                        className={`text-[9px] capitalize shrink-0 ${
                          m.role === "owner" ? "bg-indigo-600 text-white" : ""
                        }`}
                      >
                        {m.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Tasks Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-border/60">
            <CardHeader className="p-5 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-lg font-bold">Tasks</CardTitle>
                <CardDescription>Coordinate and track task list for this project.</CardDescription>
              </div>

              {/* Task Creation Trigger */}
              <Dialog open={isNewTaskOpen} onOpenChange={setIsNewTaskOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={isArchived} className="h-8 shadow-[var(--shadow-brand)]" style={{ background: "var(--gradient-brand)" }}>
                    <Plus className="h-4 w-4 mr-1.5" /> New task
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create Task</DialogTitle>
                    <DialogDescription>Assign a new task to a project team member.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="t-title">Task Title <span className="text-destructive">*</span></Label>
                      <Input id="t-title" placeholder="e.g. Design homepage wireframe" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="t-desc">Description</Label>
                      <Textarea id="t-desc" placeholder="Describe the steps or details..." value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="t-assignee">Assignee</Label>
                      <select
                        id="t-assignee"
                        value={taskAssignee}
                        onChange={(e) => setTaskAssignee(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="" className="text-black bg-background">Assign to project member...</option>
                        {members.map((m) => (
                          <option key={m.user_id} value={m.user_id} className="text-black bg-background">
                            {m.full_name ?? m.email}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="t-due">Due Date</Label>
                        <Input id="t-due" type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="t-status">Initial Status</Label>
                        <select
                          id="t-status"
                          value={taskStatus}
                          onChange={(e) => setTaskStatus(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="todo" className="text-black bg-background">Todo</option>
                          <option value="in_progress" className="text-black bg-background">In Progress</option>
                          <option value="done" className="text-black bg-background">Done</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setIsNewTaskOpen(false)}>Cancel</Button>
                    <Button
                      onClick={() => createTask.mutate()}
                      disabled={!taskTitle || createTask.isPending}
                      style={{ background: "var(--gradient-brand)" }}
                    >
                      {createTask.isPending ? "Creating…" : "Create task"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {/* Tabs for filters */}
              <Tabs value={taskStatusFilter} onValueChange={setTaskStatusFilter} className="w-full mb-4">
                <TabsList className="grid grid-cols-4 w-full max-w-[400px]">
                  <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                  <TabsTrigger value="todo" className="text-xs">Todo</TabsTrigger>
                  <TabsTrigger value="in_progress" className="text-xs">In Progress</TabsTrigger>
                  <TabsTrigger value="done" className="text-xs font-semibold">Done</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Tasks List */}
              {isLoadingTasks ? (
                <div className="p-4 text-center text-xs text-muted-foreground animate-pulse">Loading tasks...</div>
              ) : tasks.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground border border-dashed rounded-lg bg-muted/5">
                  No tasks found under this filter.
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden bg-card">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="w-[45%]">Task Details</TableHead>
                        <TableHead className="w-[20%]">Assignee</TableHead>
                        <TableHead className="w-[15%]">Due Date</TableHead>
                        <TableHead className="w-[20%]">Status/Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks.map((t) => {
                        const tId = String(t.id ?? t.task_id ?? t._id);

                        return (
                          <TableRow key={tId} className="hover:bg-muted/10">
                            <TableCell className="align-middle">
                              <div className="space-y-1">
                                <Link
                                  to="/tasks/$taskId"
                                  params={{ taskId: tId }}
                                  className="font-semibold text-sm hover:underline hover:text-primary transition-colors block"
                                >
                                  {t.title}
                                </Link>
                                {t.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-1">
                                    {t.description}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="align-middle text-xs">
                              <span className="font-medium truncate max-w-[120px] block">
                                {t.assignee_name ?? t.assignee_email ?? "Unassigned"}
                              </span>
                            </TableCell>
                            <TableCell className="align-middle text-xs text-muted-foreground">
                              {t.due_date ? (
                                <span className="flex items-center gap-1.5">
                                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                                  {t.due_date}
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="align-middle">
                              <div className="flex items-center justify-between gap-2">
                                <Select
                                  value={t.status ?? "todo"}
                                  onValueChange={(status) => updateTaskStatus.mutate({ taskId: tId, status })}
                                  disabled={isArchived || updateTaskStatus.isPending}
                                >
                                  <SelectTrigger className="h-8 w-28 text-xs py-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TASK_STATUSES.map((statusOption) => (
                                      <SelectItem key={statusOption} value={statusOption} className="text-xs">
                                        {statusOption.replace("_", " ").toUpperCase()}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                                  onClick={() => {
                                    if (window.confirm("Are you sure you want to delete this task?")) {
                                      deleteTask.mutate(tId);
                                    }
                                  }}
                                  disabled={isArchived || deleteTask.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}