import { Bot, User } from "lucide-react";
import { AiMessage } from "@/lib/api";
import { ActionConfirmCard } from "./action-confirm-card";

interface ChatMessageProps {
  message: AiMessage;
  onActionComplete?: (result: { status: string; message: string }) => void;
}

export function ChatMessage({ message, onActionComplete }: ChatMessageProps) {
  const isUser = message.sender === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      {!isUser && (
        <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
          <Bot className="h-4 w-4" />
        </div>
      )}

      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-card text-card-foreground border border-border/70 shadow-sm rounded-tl-sm"
        }`}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>

        {message.action_card && (
          <ActionConfirmCard card={message.action_card} onActionComplete={onActionComplete} />
        )}

        {message.created_at && (
          <div
            className={`text-[10px] mt-1.5 ${
              isUser ? "text-primary-foreground/70 text-right" : "text-muted-foreground text-left"
            }`}
          >
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>

      {isUser && (
        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
