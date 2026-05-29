import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ListTodo,
  Calendar,
  User,
  Trash2,
  Edit,
  AlertTriangle,
  FolderKanban,
  CheckCircle2,
  Clock,
  LayoutGrid,
  List,
  UserCheck,
  Plus
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks/")({
  head: () => ({ meta: [{ title: "My Tasks — HRMS" }] }),
  component: MyTasksPage,
});

const STATUSES = ["todo", "in_progress", "done"];

function MyTasksPage() {
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<"kanban" | "list">("list"); // Defaults to List View as primary view
  const [statusFilter, setStatusFilter] = useState("all");

  // Edit Task Dialog State
  const [editingTask, setEditingTask] = useState<any>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editAssignee, setEditAssignee] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editStatus, setEditStatus] = useState("todo");

  // New Task Dialog State
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [newProjectId, setNewProjectId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newStatus, setNewStatus] = useState("todo");

  // Queries
  const { data: tasksData, isLoading: isLoadingTasks } = useQuery({
    queryKey: ["tasks", "my", statusFilter],
    queryFn: () =>
      api<any>("/tasks/my", {
        query: statusFilter !== "all" ? { status: statusFilter } : undefined,
      }),
  });

  const { data: projectsData } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<any>("/projects"),
  });

  const { data: empsData } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api<any>("/employees/list"),
    enabled: !!editingTask || isNewTaskOpen, // Only load employee list if we are editing or creating
  });

  // Data helpers
  const tasks: any[] = useMemo(() => {
    if (!tasksData) return [];
    return Array.isArray(tasksData) ? tasksData : tasksData.tasks ?? tasksData.items ?? [];
  }, [tasksData]);

  const projects: any[] = useMemo(() => {
    if (!projectsData) return [];
    const list = Array.isArray(projectsData) ? projectsData : projectsData.projects ?? projectsData.items ?? [];
    return list.filter((p: any) => p.status === "active");
  }, [projectsData]);

  const employees: any[] = useMemo(() => {
    if (!empsData) return [];
    const list = Array.isArray(empsData) ? empsData : empsData.employees ?? empsData.items ?? [];
    return list.filter((e: any) => e.is_active !== false);
  }, [empsData]);

  // Mutations
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/tasks/${id}/status`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      toast.success("Task status updated");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["project"] }); // Invalidate project detail tasks cache
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveTask = useMutation({
    mutationFn: () => {
      const payload = {
        title: editTitle,
        description: editDesc || "",
        assignee_id: editAssignee || null,
        due_date: editDueDate || null,
        status: editStatus,
      };
      return api(`/tasks/${editingTask.id}`, { method: "PUT", body: payload });
    },
    onSuccess: () => {
      toast.success("Task updated successfully");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["project"] });
      setEditingTask(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTask = useMutation({
    mutationFn: (id: string) => api(`/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Task deleted successfully");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["project"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createTask = useMutation({
    mutationFn: () => {
      const payload = {
        title: newTitle,
        description: newDesc || undefined,
        assignee_id: newAssignee || undefined,
        due_date: newDueDate || undefined,
        status: newStatus,
      };
      return api(`/projects/${newProjectId}/tasks`, { method: "POST", body: payload });
    },
    onSuccess: () => {
      toast.success("Task created successfully");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["project", newProjectId, "tasks"] });
      setIsNewTaskOpen(false);
      // Reset Form
      setNewTitle("");
      setNewDesc("");
      setNewAssignee("");
      setNewDueDate("");
      setNewProjectId("");
      setNewStatus("todo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Open Edit Dialog helper
  const handleOpenEdit = (task: any) => {
    setEditingTask(task);
    setEditTitle(task.title ?? "");
    setEditDesc(task.description ?? "");
    setEditAssignee(task.assignee_id ?? "");
    setEditDueDate(task.due_date ?? "");
    setEditStatus(task.status ?? "todo");
  };

  // Check if a task is overdue
  const isOverdue = (dueDateStr?: string, status?: string) => {
    if (!dueDateStr || status === "done") return false;
    const due = new Date(dueDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  };

  // Format status badge styles
  const getStatusStyle = (status?: string) => {
    switch (status) {
      case "done":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "in_progress":
        return "bg-sky-50 text-sky-700 border-sky-200";
      default:
        return "bg-amber-50 text-amber-700 border-amber-200";
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "done":
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />;
      case "in_progress":
        return <Clock className="h-3.5 w-3.5 text-sky-600 shrink-0" />;
      default:
        return <ListTodo className="h-3.5 w-3.5 text-amber-600 shrink-0" />;
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Tasks</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage and organize your personal tasks across company projects.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-center">
            {/* New Task Trigger & Dialog */}
            <Dialog open={isNewTaskOpen} onOpenChange={setIsNewTaskOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-9 shadow-[var(--shadow-brand)]" style={{ background: "var(--gradient-brand)" }}>
                  <Plus className="h-4 w-4 mr-1.5" /> New task
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Task</DialogTitle>
                  <DialogDescription>Create and assign a new task to a project member.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-project">Project <span className="text-destructive">*</span></Label>
                    <select
                      id="new-project"
                      value={newProjectId}
                      onChange={(e) => setNewProjectId(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground dark:text-zinc-50"
                    >
                      <option value="" className="text-black bg-background">Select project...</option>
                      {projects.map((proj) => {
                        const projId = String(proj.id ?? proj.project_id);
                        return (
                          <option key={projId} value={projId} className="text-black bg-background">
                            {proj.name}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-title">Task Title <span className="text-destructive">*</span></Label>
                    <Input id="new-title" placeholder="e.g. Design homepage wireframe" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-desc">Description</Label>
                    <Textarea id="new-desc" placeholder="Describe the steps or details..." value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-assignee">Assignee</Label>
                    <select
                      id="new-assignee"
                      value={newAssignee}
                      onChange={(e) => setNewAssignee(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground dark:text-zinc-50"
                    >
                      <option value="" className="text-black bg-background">Select assignee...</option>
                      {employees.map((emp) => {
                        const empId = String(emp.id ?? emp.employee_id ?? emp._id);
                        return (
                          <option key={empId} value={empId} className="text-black bg-background">
                            {emp.full_name ?? emp.name} ({emp.email})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="new-due">Due Date</Label>
                      <Input id="new-due" type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-status">Status</Label>
                      <select
                        id="new-status"
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground dark:text-zinc-50"
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
                    disabled={!newProjectId || !newTitle || createTask.isPending}
                    style={{ background: "var(--gradient-brand)" }}
                  >
                    {createTask.isPending ? "Creating…" : "Create task"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Toggle buttons for Kanban/List View */}
            <div className="flex items-center rounded-lg border bg-muted/30 p-1">
              <Button
                variant={viewMode === "kanban" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-3 text-xs gap-1.5"
                onClick={() => setViewMode("kanban")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Kanban Board
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-3 text-xs gap-1.5"
                onClick={() => setViewMode("list")}
              >
                <List className="h-3.5 w-3.5" />
                List View
              </Button>
            </div>
          </div>
        </div>

        {/* View Layout Renderer */}
        {isLoadingTasks ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="h-32" />
              </Card>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-16 text-center flex flex-col items-center justify-center space-y-3">
              <ListTodo className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="font-semibold text-lg">No tasks assigned</p>
                <p className="text-sm text-muted-foreground">
                  You are all caught up! When you are added to a project task, it will show up here.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : viewMode === "kanban" ? (
          /* Kanban Board View */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STATUSES.map((statusKey) => {
              const statusTasks = tasks.filter((t) => (t.status ?? "todo") === statusKey);
              const columnTitle = 
                statusKey === "todo" ? "To Do" : 
                statusKey === "in_progress" ? "In Progress" : "Completed";
              const columnAccent = 
                statusKey === "todo" ? "bg-amber-500" : 
                statusKey === "in_progress" ? "bg-sky-500" : "bg-emerald-500";

              return (
                <div key={statusKey} className="space-y-4">
                  {/* Column Header */}
                  <div className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${columnAccent}`} />
                      <h2 className="font-bold text-sm text-foreground">{columnTitle}</h2>
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                        {statusTasks.length}
                      </Badge>
                    </div>
                  </div>

                  {/* Task Card Stack */}
                  <div className="space-y-3 min-h-[300px] rounded-lg bg-muted/10 p-2 border border-dashed border-border/40">
                    {statusTasks.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">No tasks</p>
                    ) : (
                      statusTasks.map((t) => {
                        const id = String(t.id ?? t.task_id ?? t._id);
                        const overdue = isOverdue(t.due_date, t.status);

                        return (
                          <Card key={id} className="hover:shadow-[var(--shadow-brand)] transition-all border border-border/60 hover:border-primary/20 bg-card overflow-hidden group">
                            <CardHeader className="p-4 pb-2 space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <Link
                                  to="/tasks/$taskId"
                                  params={{ taskId: id }}
                                  className="font-bold text-xs text-foreground hover:underline group-hover:text-primary transition-colors line-clamp-2"
                                >
                                  {t.title}
                                </Link>
                                <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => handleOpenEdit(t)}>
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => {
                                    if (window.confirm("Are you sure you want to delete this task?")) deleteTask.mutate(id);
                                  }}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              {t.project_name && (
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                                  <FolderKanban className="h-3 w-3 text-muted-foreground/80" />
                                  {t.project_name}
                                </p>
                              )}
                            </CardHeader>
                            <CardContent className="p-4 pt-0 space-y-3">
                              {t.description && (
                                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                  {t.description}
                                </p>
                              )}

                              <div className="flex items-center justify-between text-[10px] pt-2 border-t border-border/40">
                                {/* Creator */}
                                <span className="text-muted-foreground truncate max-w-[100px]" title={`Created by: ${t.creator_name ?? t.creator_email}`}>
                                  by {t.creator_name ?? t.creator_email ?? "System"}
                                </span>

                                {/* Due Date Alert */}
                                {t.due_date ? (
                                  <span className={`flex items-center gap-1 font-medium ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                                    {overdue ? <AlertTriangle className="h-3 w-3 animate-pulse" /> : <Calendar className="h-3 w-3" />}
                                    {t.due_date}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View Table Mode */
          <div className="space-y-4">
            {/* Status Filter Tab row */}
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
              <TabsList className="grid grid-cols-4 w-full max-w-[400px]">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="todo" className="text-xs">Todo</TabsTrigger>
                <TabsTrigger value="in_progress" className="text-xs">In Progress</TabsTrigger>
                <TabsTrigger value="done" className="text-xs">Completed</TabsTrigger>
              </TabsList>
            </Tabs>

            <Card className="border border-border/60 overflow-hidden bg-card shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow>
                      <TableHead className="w-[45%]">Task Details</TableHead>
                      <TableHead className="w-[18%]">Project</TableHead>
                      <TableHead className="w-[15%]">Due Date</TableHead>
                      <TableHead className="w-[18%]">Status</TableHead>
                      <TableHead className="w-[4%] text-right pr-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((t) => {
                      const id = String(t.id ?? t.task_id ?? t._id);
                      const overdue = isOverdue(t.due_date, t.status);

                      return (
                        <TableRow key={id} className="hover:bg-muted/10 transition-colors group">
                          <TableCell className="align-middle py-3">
                            <div className="space-y-1">
                              <Link
                                to="/tasks/$taskId"
                                params={{ taskId: id }}
                                className="font-bold text-sm text-foreground hover:underline group-hover:text-primary transition-colors block"
                              >
                                {t.title}
                              </Link>
                              {t.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1 max-w-[400px]">
                                  {t.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-middle text-xs">
                            {t.project_name ? (
                              <span className="flex items-center gap-1.5 font-medium">
                                <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
                                {t.project_name}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="align-middle text-xs">
                            {t.due_date ? (
                              <span className={`flex items-center gap-1.5 font-medium ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                                {overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
                                {t.due_date}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="align-middle">
                            <Select
                              value={t.status ?? "todo"}
                              onValueChange={(status) => updateStatus.mutate({ id, status })}
                              disabled={updateStatus.isPending}
                            >
                              <SelectTrigger className="h-8 w-28 text-xs py-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUSES.map((s) => (
                                  <SelectItem key={s} value={s} className="text-xs">
                                    {s.replace("_", " ").toUpperCase()}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="align-middle text-right pr-4">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleOpenEdit(t)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => {
                                if (window.confirm("Are you sure you want to delete this task?")) deleteTask.mutate(id);
                              }}>
                                <Trash2 className="h-4 w-4" />
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
          </div>
        )}

        {/* Edit Task Dialog */}
        <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
              <DialogDescription>Modify task specifications, assignee, and schedule.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-title">Task Title <span className="text-destructive">*</span></Label>
                <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea id="edit-desc" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-assignee">Assignee</Label>
                <select
                  id="edit-assignee"
                  value={editAssignee}
                  onChange={(e) => setEditAssignee(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="" className="text-black bg-background">Select assignee...</option>
                  {employees.map((emp) => {
                    const empId = String(emp.id ?? emp.employee_id ?? emp._id);
                    return (
                      <option key={empId} value={empId} className="text-black bg-background">
                        {emp.full_name ?? emp.name} ({emp.email})
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-due">Due Date</Label>
                  <Input id="edit-due" type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-status">Status</Label>
                  <select
                    id="edit-status"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
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
              <Button variant="outline" onClick={() => setEditingTask(null)}>Cancel</Button>
              <Button
                onClick={() => saveTask.mutate()}
                disabled={!editTitle || saveTask.isPending}
                style={{ background: "var(--gradient-brand)" }}
              >
                {saveTask.isPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}