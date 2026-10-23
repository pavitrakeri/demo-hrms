import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Calendar,
  UserCheck,
  Check,
  Sparkles,
  Info,
  Clock,
  CheckCheck,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["notifications"],
    queryFn: () => api<any[]>("/notifications"),
    refetchInterval: 30000, // poll every 30s
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api("/notifications/read-all", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "holiday_announced":
        return <Calendar className="h-4 w-4 text-amber-500 shrink-0" />;
      case "leave_assigned":
        return <UserCheck className="h-4 w-4 text-emerald-500 shrink-0" />;
      case "leave_requested":
        return <Clock className="h-4 w-4 text-blue-500 shrink-0" />;
      default:
        return <Info className="h-4 w-4 text-primary shrink-0" />;
    }
  };

  const getNotificationDetails = (n: any) => {
    const p = n.payload || {};
    if (n.type === "holiday_announced") {
      return {
        title: `Holiday: ${p.name || "Company Holiday"}`,
        subtitle: p.date ? `Date: ${p.date}` : (p.message || "New public holiday announced"),
      };
    }
    if (n.type === "leave_assigned") {
      return {
        title: `Leave Assigned (${p.leave_type ? p.leave_type.toUpperCase() : "Approved"})`,
        subtitle: `${p.days || 1} day(s) from ${p.start_date || ""} to ${p.end_date || ""}`,
      };
    }
    return {
      title: p.message || n.type?.replace(/_/g, " "),
      subtitle: p.by ? `By ${p.by}` : "",
    };
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full cursor-pointer hover:bg-muted"
          aria-label="View notifications"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm animate-in zoom-in">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 sm:w-96 p-0 shadow-lg border border-border/60 bg-popover rounded-xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-3.5 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold tracking-tight">Notifications</h4>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-bold">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-[11px] h-7 px-2 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-[350px] overflow-y-auto divide-y divide-border/30">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground space-y-1">
              <Bell className="h-8 w-8 mx-auto stroke-1 opacity-40 mb-2" />
              <p className="text-xs font-medium">No notifications yet</p>
              <p className="text-[11px] text-muted-foreground/80">
                You're all caught up with announcements and updates!
              </p>
            </div>
          ) : (
            notifications.map((n) => {
              const { title, subtitle } = getNotificationDetails(n);
              let timeStr = "";
              if (n.created_at) {
                try {
                  timeStr = formatDistanceToNow(new Date(n.created_at), { addSuffix: true });
                } catch {
                  timeStr = "";
                }
              }

              return (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.is_read) {
                      markReadMutation.mutate(n.id);
                    }
                  }}
                  className={`p-3.5 flex gap-3 items-start transition-colors cursor-pointer select-none ${
                    n.is_read ? "opacity-75 hover:bg-muted/30" : "bg-primary/5 hover:bg-primary/10"
                  }`}
                >
                  <div className="mt-0.5 p-1.5 rounded-lg bg-background border border-border/40 shadow-xs">
                    {getNotificationIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs ${n.is_read ? "font-medium" : "font-bold text-foreground"}`}>
                        {title}
                      </p>
                      {!n.is_read && (
                        <span className="size-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    {subtitle && (
                      <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                        {subtitle}
                      </p>
                    )}
                    {timeStr && (
                      <p className="text-[10px] text-muted-foreground/60 font-mono pt-0.5">
                        {timeStr}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
