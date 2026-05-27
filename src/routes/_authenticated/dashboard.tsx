import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, FolderKanban, ListTodo, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — HRMS" }] }),
  component: Dashboard,
});

function Dashboard() {
  const attendance = useQuery({
    queryKey: ["attendance", "latest"],
    queryFn: () => api<any>("/attendance/latest"),
  });
  const tasks = useQuery({
    queryKey: ["tasks", "my"],
    queryFn: () => api<any>("/tasks/my"),
  });
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<any>("/projects"),
  });

  const taskCount = Array.isArray(tasks.data)
    ? tasks.data.length
    : tasks.data?.tasks?.length ?? tasks.data?.items?.length ?? 0;
  const projectCount = Array.isArray(projects.data)
    ? projects.data.length
    : projects.data?.projects?.length ?? projects.data?.items?.length ?? 0;

  const latestStatus = attendance.data?.status ?? attendance.data?.latest?.status ?? "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Here's a quick overview of your day.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Clock} title="Attendance" value={String(latestStatus)} loading={attendance.isLoading} href="/attendance" />
        <StatCard icon={ListTodo} title="My Tasks" value={String(taskCount)} loading={tasks.isLoading} href="/tasks" />
        <StatCard icon={FolderKanban} title="Projects" value={String(projectCount)} loading={projects.isLoading} href="/projects" />
        <StatCard icon={Users} title="Employees" value="View" href="/employees" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
          <CardDescription>Jump straight into common tasks.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild><Link to="/attendance">Clock in / out</Link></Button>
          <Button asChild variant="secondary"><Link to="/projects">View projects</Link></Button>
          <Button asChild variant="secondary"><Link to="/tasks">My tasks</Link></Button>
          <Button asChild variant="secondary"><Link to="/employees">Employees</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  title,
  value,
  loading,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  loading?: boolean;
  href: "/attendance" | "/tasks" | "/projects" | "/employees";
}) {
  return (
    <Link to={href}>
      <Card className="hover:border-foreground/20 transition-colors cursor-pointer h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{loading ? "…" : value}</div>
        </CardContent>
      </Card>
    </Link>
  );
}