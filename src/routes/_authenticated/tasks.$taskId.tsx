import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Trash2, Play, Square, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks/$taskId")({
  head: () => ({ meta: [{ title: "Task — HRMS" }] }),
  component: TaskDetail,
});

const STATUSES = ["todo", "in_progress", "done", "blocked"];

function TaskDetail() {
  const { taskId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => api<any>(`/tasks/${taskId}`),
  });

  useEffect(() => {
    if (data) {
      const t = data.task ?? data;
      setTitle(t.title ?? t.name ?? "");
      setDescription(t.description ?? "");
      setStatus(t.status ?? "todo");
      setStartDate(t.start_date ?? "");
      setDueDate(t.due_date ?? "");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      api(`/tasks/${taskId}`, { method: "PUT", body: { title, description, status, start_date: startDate || null, due_date: dueDate || null } }),
    onSuccess: () => {
      toast.success("Task updated");
      qc.invalidateQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: () => api(`/tasks/${taskId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Task deleted");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      navigate({ to: "/tasks" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleTimer = useMutation({
    mutationFn: () => api(`/tasks/${taskId}/timer`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Timer toggled");
      qc.invalidateQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const task = data?.task ?? data;

  return (
    <div className="space-y-6 max-w-2xl">
      <Link to="/tasks" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Back to tasks
      </Link>
      <Card>
        <CardHeader><CardTitle>Edit task</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input id="start_date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input id="due_date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          {task && (
            <div className="p-4 bg-muted/30 rounded-lg border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Time Tracked</p>
                  <p className="text-xs text-muted-foreground">{formatTime(task.time_spent_seconds || 0)}</p>
                </div>
              </div>
              <Button 
                variant={task.timer_started_at ? "destructive" : "secondary"} 
                size="sm" 
                onClick={() => toggleTimer.mutate()}
                disabled={toggleTimer.isPending}
              >
                {task.timer_started_at ? (
                  <><Square className="h-4 w-4 mr-1.5" /> Stop Timer</>
                ) : (
                  <><Play className="h-4 w-4 mr-1.5" /> Start Timer</>
                )}
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
            <Button variant="destructive" onClick={() => del.mutate()} disabled={del.isPending}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}