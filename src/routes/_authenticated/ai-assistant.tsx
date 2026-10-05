import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Send,
  Plus,
  Trash2,
  Bot,
  Calendar,
  Clock,
  BookOpen,
  ListTodo,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Loader2,
  Shield,
  ChevronRight,
  Radio,
  Mic,
  MicOff,
} from "lucide-react";
import { VoiceModeModal } from "@/components/ai/voice-mode-modal";
import { useVoiceAssistant } from "@/hooks/use-voice-assistant";
import {
  sendAiMessage,
  getAiConversations,
  getAiMessages,
  deleteAiConversation,
  AiMessage,
  AiConversation,
} from "@/lib/api";
import { ChatMessage } from "@/components/ai/chat-message";
import { PromptChips } from "@/components/ai/prompt-chips";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ai-assistant")({
  head: () => ({ meta: [{ title: "AI Assistant — Aimploy HRMS" }] }),
  component: AiAssistantPage,
});

const HERO_CARDS = [
  {
    icon: Calendar,
    title: "Leaves & Time-Off",
    description: "Check balance, track approvals, and apply for annual or sick leave",
    prompt: "How many days of annual leave do I have left and can I apply for next Monday?",
    color: "text-amber-500 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
  },
  {
    icon: Clock,
    title: "Attendance & Hours",
    description: "Verify today's clock-in status, total work hours, and location log",
    prompt: "Did I clock in today and what is my logged work time?",
    color:
      "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
  },
  {
    icon: BookOpen,
    title: "Policy Knowledge Base",
    description: "Semantic search across official Aimploy policies and UAE labor rules",
    prompt: "What is our policy on medical certificates for sick leaves?",
    color: "text-blue-500 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
  },
  {
    icon: ListTodo,
    title: "Task Management",
    description: "Review your active deliverables, deadlines, and project assignments",
    prompt: "Show all my pending tasks across active projects.",
    color:
      "text-purple-500 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800",
  },
];

function AiAssistantPage() {
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
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

  // Fetch list of conversations
  const { data: conversations = [], isLoading: loadingConversations } = useQuery({
    queryKey: ["ai_conversations"],
    queryFn: getAiConversations,
  });

  // Fetch messages for selected conversation
  const { data: conversationData, isLoading: loadingMessages } = useQuery({
    queryKey: ["ai_messages", selectedConversationId],
    queryFn: () => getAiMessages(selectedConversationId!),
    enabled: !!selectedConversationId,
  });

  useEffect(() => {
    if (selectedConversationId && conversationData) {
      setMessages(conversationData.messages || []);
    } else if (!selectedConversationId) {
      setMessages([]);
    }
  }, [selectedConversationId, conversationData]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAiConversation(id),
    onSuccess: (_, id) => {
      toast.success("Conversation deleted");
      queryClient.invalidateQueries({ queryKey: ["ai_conversations"] });
      if (selectedConversationId === id) {
        setSelectedConversationId(null);
        setMessages([]);
      }
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete conversation"),
  });

  async function handleSend(textToSend?: string) {
    const text = (textToSend || input).trim();
    if (!text || sending) return;

    const userMsg: AiMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await sendAiMessage(text, selectedConversationId || undefined);

      if (!selectedConversationId) {
        setSelectedConversationId(res.conversation_id);
        queryClient.invalidateQueries({ queryKey: ["ai_conversations"] });
      }

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
        content:
          "Sorry, I ran into an issue communicating with the assistant service. Please try again.",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  }

  function handleNewChat() {
    setSelectedConversationId(null);
    setMessages([]);
  }

  return (
    <div className="space-y-4">
      {/* Module Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
                <Sparkles className="h-4 w-4" />
              </span>
              Aimploy AI Copilot
            </h1>
            <Badge
              variant="outline"
              className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold"
            >
              Gemini 3.6
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Intelligent HR operations, company policy retrieval, leave requests, and workforce
            assistant
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setVoiceModalOpen(true)}
            size="sm"
            variant="outline"
            className="border-primary/40 text-primary hover:bg-primary/10 font-medium shadow-sm h-9 gap-1.5"
          >
            <Radio className="h-4 w-4 text-primary animate-pulse" />
            Live Voice Mode
          </Button>
          <Button
            onClick={handleNewChat}
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-sm h-9 gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New Conversation
          </Button>
        </div>
      </div>

      {/* Main Workspace: 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-210px)] min-h-[560px]">
        {/* Left Column: History Sidebar */}
        <Card className="lg:col-span-1 flex flex-col h-full overflow-hidden border-border/80 shadow-sm bg-card/60 backdrop-blur">
          <CardHeader className="py-3 px-4 border-b border-border/60 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Recent Sessions
            </CardTitle>
            <span className="text-[11px] text-muted-foreground">{conversations.length}</span>
          </CardHeader>

          <CardContent className="p-2 flex-1 overflow-y-auto space-y-1">
            {loadingConversations ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground text-xs">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading sessions...
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-10 px-4 text-muted-foreground text-xs space-y-1">
                <Bot className="h-6 w-6 mx-auto text-muted-foreground/50 mb-2" />
                <p className="font-medium">No previous sessions</p>
                <p className="text-[11px]">
                  Start a new conversation to ask questions or request leaves.
                </p>
              </div>
            ) : (
              conversations.map((c) => {
                const active = selectedConversationId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedConversationId(c.id)}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:bg-muted text-foreground/80 hover:text-foreground"
                    }`}
                  >
                    <div className="truncate flex-1 pr-2">
                      <div className="truncate">{c.title || "Conversation"}</div>
                      {c.updated_at && (
                        <div
                          className={`text-[10px] mt-0.5 ${
                            active ? "text-primary-foreground/70" : "text-muted-foreground"
                          }`}
                        >
                          {new Date(c.updated_at).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(c.id);
                      }}
                      className={`opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/20 transition-opacity ${
                        active
                          ? "text-primary-foreground"
                          : "text-muted-foreground hover:text-destructive"
                      }`}
                      title="Delete chat"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </CardContent>

          <div className="p-3 border-t border-border/60 bg-muted/20 text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>Encrypted with strict role-based access</span>
          </div>
        </Card>

        {/* Right Column: Active Conversation Canvas */}
        <Card className="lg:col-span-3 flex flex-col h-full overflow-hidden border-border/80 shadow-sm bg-background">
          {/* Messages Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {messages.length === 0 ? (
              /* Empty Canvas Hero & Capabilities */
              <div className="max-w-2xl mx-auto py-8 space-y-6">
                <div className="text-center space-y-2">
                  <div className="inline-flex h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center text-primary shadow-sm mb-2">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">
                    Welcome to Aimploy AI Copilot
                  </h2>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Your personal HR copilot grounded in company policies, live attendance records,
                    leave balances, and project tasks.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {HERO_CARDS.map((card) => (
                    <button
                      key={card.title}
                      type="button"
                      onClick={() => handleSend(card.prompt)}
                      className="text-left p-3.5 rounded-xl border border-border/70 hover:border-primary/50 bg-card hover:bg-accent/50 transition-all group flex flex-col justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg border ${card.color} shrink-0`}>
                          <card.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                            {card.title}
                            <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                            {card.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Message Thread */
              messages.map((m) => (
                <ChatMessage
                  key={m.id}
                  message={m}
                  onActionComplete={() => {
                    queryClient.invalidateQueries({
                      queryKey: ["ai_messages", selectedConversationId],
                    });
                  }}
                />
              ))
            )}

            {sending && (
              <div className="flex items-center gap-3 text-muted-foreground text-xs py-2.5 px-4 bg-muted/40 rounded-xl w-fit animate-pulse border border-border/40">
                <Bot className="h-4 w-4 text-primary animate-bounce" />
                <span>Aimploy Copilot is analyzing policies and generating response...</span>
              </div>
            )}
          </div>

          {/* Prompt Chips Bar */}
          <div className="px-4 pb-2 shrink-0">
            <PromptChips onSelect={(prompt) => handleSend(prompt)} disabled={sending} />
          </div>

          {/* Input Box */}
          <div className="p-4 border-t border-border/70 bg-card/60 backdrop-blur shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2 max-w-4xl mx-auto"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about policies, check leave balances, or request time-off..."
                disabled={sending}
                className="flex-1 text-sm h-11 rounded-xl bg-muted/40 border-border/60 focus-visible:ring-primary shadow-inner"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={isInlineListening ? stopInlineListen : startInlineListen}
                className={`h-11 w-11 shrink-0 rounded-xl transition-colors ${
                  isInlineListening
                    ? "bg-rose-500/15 text-rose-500 hover:bg-rose-500/20 animate-pulse"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={isInlineListening ? "Stop voice listening" : "Click to speak"}
              >
                {isInlineListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || sending}
                className="h-11 w-11 shrink-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-md font-semibold"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </Card>
      </div>

      <VoiceModeModal
        open={voiceModalOpen}
        onOpenChange={setVoiceModalOpen}
        conversationId={selectedConversationId}
        onNewMessage={(userText, aiText, actionCard) => {
          setMessages((prev) => [
            ...prev,
            {
              id: `user-${Date.now()}`,
              sender: "user",
              content: userText,
              created_at: new Date().toISOString(),
            },
            {
              id: `ai-${Date.now()}`,
              sender: "assistant",
              content: aiText,
              created_at: new Date().toISOString(),
              action_card: actionCard,
            },
          ]);
          queryClient.invalidateQueries({ queryKey: ["ai_conversations"] });
        }}
      />
    </div>
  );
}
