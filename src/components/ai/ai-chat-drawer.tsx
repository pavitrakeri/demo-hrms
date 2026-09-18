import { useState, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Trash2, Bot, Loader2, Radio, Mic, MicOff } from "lucide-react";
import { sendAiMessage, AiMessage } from "@/lib/api";
import { ChatMessage } from "./chat-message";
import { PromptChips } from "./prompt-chips";
import { VoiceModeModal } from "./voice-mode-modal";
import { useVoiceAssistant } from "@/hooks/use-voice-assistant";
import { toast } from "sonner";

interface AiChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const INITIAL_MESSAGE: AiMessage = {
  id: "welcome-msg",
  sender: "assistant",
  content: "Hello! I am your Aimploy HR Assistant. I can help you check your leave balance, review attendance, find assigned tasks, look up company policies, or prepare a leave application. How can I help you today?",
  created_at: new Date().toISOString(),
};

export function AiChatDrawer({ open, onOpenChange }: AiChatDrawerProps) {
  const [messages, setMessages] = useState<AiMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    isListening: isInlineListening,
    startListening: startInlineListen,
    stopListening: stopInlineListen,
  } = useVoiceAssistant({
    continuous: false,
    silenceTimeoutMs: 1200,
    onSpeechResult: (text) => {
      setInput((prev) => (prev ? prev + " " + text : text));
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function handleSend(textToSend?: string) {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg: AiMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await sendAiMessage(text, conversationId);
      setConversationId(res.conversation_id);

      const assistantMsg: AiMessage = {
        id: `ai-${Date.now()}`,
        sender: "assistant",
        content: res.response,
        created_at: new Date().toISOString(),
        action_card: res.action_card,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      toast.error(e.message || "Failed to get AI response");
      const errorMsg: AiMessage = {
        id: `err-${Date.now()}`,
        sender: "assistant",
        content: "Sorry, I ran into an issue communicating with the assistant service. Please try again.",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  function handleClearChat() {
    setMessages([INITIAL_MESSAGE]);
    setConversationId(undefined);
    toast.info("Conversation cleared");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col h-full bg-background border-l border-border/80 shadow-2xl"
      >
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b border-border/70 flex flex-row items-center justify-between space-y-0 shrink-0 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <SheetTitle className="text-base font-bold flex items-center gap-1.5 text-foreground">
                Aimploy Assistant
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20">
                  AI Beta
                </span>
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Company policies, leave management & personal HRMS tasks
              </SheetDescription>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setVoiceModalOpen(true)}
              title="Launch Live Voice Mode"
              className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
            >
              <Radio className="h-4 w-4 text-primary animate-pulse" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearChat}
              title="Clear conversation"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Message Stream */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m) => (
            <ChatMessage key={m.id} message={m} />
          ))}

          {loading && (
            <div className="flex items-center gap-3 text-muted-foreground text-xs py-2 px-3 bg-muted/30 rounded-xl w-fit animate-pulse border border-border/40">
              <Bot className="h-4 w-4 text-primary animate-bounce" />
              <span>Aimploy Assistant is thinking...</span>
            </div>
          )}
        </div>

        {/* Quick Suggestions */}
        <div className="px-4 pb-2 shrink-0">
          <PromptChips onSelect={(prompt) => handleSend(prompt)} disabled={loading} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-border/70 bg-background/95 backdrop-blur shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question or request leave..."
              disabled={loading}
              className="flex-1 text-xs h-10 rounded-xl bg-muted/40 border-border/60 focus-visible:ring-primary"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={isInlineListening ? stopInlineListen : startInlineListen}
              className={`h-10 w-10 shrink-0 rounded-xl transition-colors ${
                isInlineListening
                  ? "bg-rose-500/15 text-rose-500 hover:bg-rose-500/20 animate-pulse"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={isInlineListening ? "Stop voice listening" : "Click to speak"}
            >
              {isInlineListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || loading}
              className="h-10 w-10 shrink-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
          <div className="text-[10px] text-muted-foreground text-center mt-2">
            Powered by Google Gemini 1.5 • Respects Aimploy role permissions
          </div>
        </div>

        <VoiceModeModal
          open={voiceModalOpen}
          onOpenChange={setVoiceModalOpen}
          conversationId={conversationId}
          onNewMessage={(userText, aiText, actionCard) => {
            setMessages((prev) => [
              ...prev,
              { id: `user-${Date.now()}`, sender: "user", content: userText, created_at: new Date().toISOString() },
              { id: `ai-${Date.now()}`, sender: "assistant", content: aiText, created_at: new Date().toISOString(), action_card: actionCard },
            ]);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
