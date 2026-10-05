import { useState } from "react";
import { confirmAiAction, AiActionCard } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ActionConfirmCardProps {
  card: AiActionCard;
  onActionComplete?: (result: { status: string; message: string }) => void;
}

export function ActionConfirmCard({ card, onActionComplete }: ActionConfirmCardProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"pending" | "executed" | "cancelled">("pending");
  const [resultMsg, setResultMsg] = useState("");

  async function handleConfirm(confirm: boolean) {
    setLoading(true);
    try {
      const res = await confirmAiAction(card.action_id, confirm);
      if (res.status === "success") {
        setStatus("executed");
        setResultMsg(res.message || "Leave applied successfully!");
        toast.success("Leave application submitted!");
      } else {
        setStatus("cancelled");
        setResultMsg("Action was cancelled.");
        toast.info("Action cancelled");
      }
      onActionComplete?.(res);
    } catch (e: any) {
      toast.error(e.message || "Failed to process confirmation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 p-3.5 bg-background border-2 border-primary/30 rounded-xl shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-primary">
        <AlertCircle className="h-4 w-4" />
        Action Approval Required
      </div>

      <div className="space-y-1.5 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/40">
        <div className="flex justify-between items-center text-foreground font-medium">
          <span>Leave Type:</span>
          <span className="uppercase tracking-wider px-2 py-0.5 bg-primary/10 text-primary rounded font-bold text-[11px]">
            {card.leave_type}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span>Dates:</span>
          <span className="font-semibold text-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            {card.start_date} → {card.end_date}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span>Duration:</span>
          <span className="font-semibold text-foreground">{card.num_days} Day(s)</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Reason:</span>
          <span className="text-foreground italic truncate max-w-[180px]">{card.reason}</span>
        </div>
      </div>

      {status === "pending" ? (
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1 text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            disabled={loading}
            onClick={() => handleConfirm(true)}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            )}
            Confirm & Submit
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 text-muted-foreground hover:text-foreground"
            disabled={loading}
            onClick={() => handleConfirm(false)}
          >
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Cancel
          </Button>
        </div>
      ) : status === "executed" ? (
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{resultMsg}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/40 p-2 rounded-lg">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>{resultMsg}</span>
        </div>
      )}
    </div>
  );
}
