import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  Bot,
  Square,
  Radio,
  AudioLines
} from "lucide-react";
import { useVoiceAssistant } from "@/hooks/use-voice-assistant";
import { sendAiMessage, AiActionCard } from "@/lib/api";
import { ActionConfirmCard } from "./action-confirm-card";
import { toast } from "sonner";

interface VoiceModeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId?: string | null;
  onNewMessage?: (userText: string, aiText: string, actionCard?: AiActionCard | null) => void;
}

export function VoiceModeModal({
  open,
  onOpenChange,
  conversationId,
  onNewMessage
}: VoiceModeModalProps) {
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [lastUserSpeech, setLastUserSpeech] = useState("");
  const [lastAiResponse, setLastAiResponse] = useState("");
  const [currentActionCard, setCurrentActionCard] = useState<AiActionCard | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const isMounted = useRef(true);

  const {
    isListening,
    isSpeaking,
    interimTranscript,
    transcript,
    isSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  } = useVoiceAssistant({
    onSpeechResult: (finalText) => {
      if (finalText) {
        handleUserSpeechFinalized(finalText);
      }
    },
  });

  useEffect(() => {
    isMounted.current = true;
    if (open && isSupported) {
      setLastUserSpeech("");
      setLastAiResponse("");
      setCurrentActionCard(null);
      // Greet user and start listening
      setVoiceStatus("speaking");
      if (audioEnabled) {
        speak("Aimploy voice mode active. How can I help you today?", () => {
          if (isMounted.current && open) {
            setVoiceStatus("listening");
            startListening();
          }
        });
      } else {
        setVoiceStatus("listening");
        startListening();
      }
    } else if (!open) {
      stopListening();
      stopSpeaking();
      setVoiceStatus("idle");
    }

    return () => {
      isMounted.current = false;
      stopListening();
      stopSpeaking();
    };
  }, [open, isSupported]);

  async function handleUserSpeechFinalized(userText: string) {
    if (!userText.trim()) return;
    setLastUserSpeech(userText);
    stopListening();
    setVoiceStatus("thinking");

    try {
      const res = await sendAiMessage(userText, conversationId || undefined);
      setLastAiResponse(res.response);
      setCurrentActionCard(res.action_card || null);

      onNewMessage?.(userText, res.response, res.action_card);

      setVoiceStatus("speaking");
      if (audioEnabled) {
        speak(res.response, () => {
          if (isMounted.current && open) {
            // Automatically resume listening for follow-up question after short pause
            setTimeout(() => {
              if (isMounted.current && open) {
                setVoiceStatus("listening");
                startListening();
              }
            }, 800);
          }
        });
      } else {
        setVoiceStatus("idle");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to process voice command");
      setVoiceStatus("idle");
    }
  }

  function handleToggleMic() {
    if (isListening) {
      stopListening();
      setVoiceStatus("idle");
    } else {
      stopSpeaking();
      setVoiceStatus("listening");
      startListening();
    }
  }

  function handleToggleAudio() {
    if (audioEnabled) {
      stopSpeaking();
      setAudioEnabled(false);
      toast.info("Voice read-aloud muted");
    } else {
      setAudioEnabled(true);
      toast.info("Voice read-aloud enabled");
    }
  }

  function handleInterrupt() {
    stopSpeaking();
    setVoiceStatus("listening");
    startListening();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-w-full h-[85vh] sm:h-[680px] p-0 overflow-hidden bg-slate-950/95 text-slate-100 border border-slate-800 shadow-2xl backdrop-blur-2xl flex flex-col justify-between rounded-3xl">
        {/* Top Header Bar */}
        <div className="p-5 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <AudioLines className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                Aimploy Live Voice Mode
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Live
                </span>
              </div>
              <div className="text-xs text-slate-400">Hands-free conversational assistant</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleAudio}
              className={`h-9 w-9 rounded-full ${audioEnabled ? "text-indigo-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-800"}`}
              title={audioEnabled ? "Mute audio output" : "Enable audio output"}
            >
              {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-9 w-9 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Central Ambient Visualizer */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 text-center relative overflow-hidden">
          {/* Subtle Ambient Background Glow */}
          <div
            className={`absolute w-72 h-72 rounded-full blur-3xl transition-all duration-700 opacity-40 pointer-events-none ${
              voiceStatus === "listening"
                ? "bg-cyan-500 scale-125"
                : voiceStatus === "thinking"
                ? "bg-indigo-600 animate-pulse scale-100"
                : voiceStatus === "speaking"
                ? "bg-purple-600 scale-125"
                : "bg-slate-800 scale-75"
            }`}
          />

          {/* Concentric Pulsing Audio Orb */}
          <div className="relative mb-6">
            {/* Outer Waves */}
            {(voiceStatus === "listening" || voiceStatus === "speaking") && (
              <>
                <span className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping duration-1000 scale-150 pointer-events-none" />
                <span className="absolute -inset-4 rounded-full bg-cyan-500/15 animate-pulse duration-700 pointer-events-none" />
              </>
            )}

            {/* Core Orb Button */}
            <button
              type="button"
              onClick={handleToggleMic}
              className={`relative z-10 h-32 w-32 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 cursor-pointer ${
                voiceStatus === "listening"
                  ? "bg-gradient-to-tr from-cyan-500 to-indigo-600 shadow-cyan-500/50 scale-110 ring-4 ring-cyan-400/40"
                  : voiceStatus === "thinking"
                  ? "bg-gradient-to-tr from-indigo-700 to-purple-600 shadow-purple-500/40 animate-spin"
                  : voiceStatus === "speaking"
                  ? "bg-gradient-to-tr from-purple-600 to-pink-600 shadow-pink-500/40 scale-105"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300"
              }`}
            >
              {voiceStatus === "listening" ? (
                <Mic className="h-12 w-12 text-white animate-pulse" />
              ) : voiceStatus === "thinking" ? (
                <Sparkles className="h-10 w-10 text-white animate-spin" />
              ) : voiceStatus === "speaking" ? (
                <Radio className="h-12 w-12 text-white animate-bounce" />
              ) : (
                <MicOff className="h-10 w-10 text-slate-400" />
              )}
            </button>
          </div>

          {/* Dynamic Status Text */}
          <div className="text-sm font-semibold tracking-wide uppercase text-indigo-300 mb-2">
            {voiceStatus === "listening" ? (
              <span className="flex items-center justify-center gap-2 text-cyan-300">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                Listening to you...
              </span>
            ) : voiceStatus === "thinking" ? (
              <span className="flex items-center justify-center gap-2 text-indigo-300">
                Aimploy is thinking & checking HR policies...
              </span>
            ) : voiceStatus === "speaking" ? (
              <span className="flex items-center justify-center gap-2 text-purple-300">
                <Volume2 className="h-4 w-4 animate-bounce" />
                Speaking answer...
              </span>
            ) : (
              <span className="text-slate-400">Microphone paused • Tap to speak</span>
            )}
          </div>

          {/* Real-time Subtitle Card */}
          <div className="w-full max-w-md bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 text-xs space-y-2 min-h-[90px] shadow-inner backdrop-blur">
            {interimTranscript ? (
              <p className="text-cyan-200 italic text-sm font-medium">"{interimTranscript}..."</p>
            ) : lastUserSpeech ? (
              <p className="text-slate-300 font-medium">You: "{lastUserSpeech}"</p>
            ) : null}

            {lastAiResponse && (
              <p className="text-indigo-200/90 line-clamp-3 leading-relaxed mt-1 text-left">
                {lastAiResponse}
              </p>
            )}

            {!interimTranscript && !lastUserSpeech && !lastAiResponse && (
              <p className="text-slate-500 italic">
                Try saying: "How many leaves do I have left?" or "Did I clock in today?"
              </p>
            )}
          </div>

          {/* Action Confirmation in Voice Mode */}
          {currentActionCard && (
            <div className="w-full max-w-md mt-3 text-left">
              <ActionConfirmCard
                card={currentActionCard}
                onActionComplete={(res) => {
                  if (audioEnabled) {
                    speak(res.message);
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Bottom Controls Bar */}
        <div className="p-5 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 text-cyan-400" />
            <span>Natural Voice • Powered by Gemini</span>
          </div>

          <div className="flex items-center gap-2">
            {isSpeaking && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleInterrupt}
                className="bg-slate-800/80 hover:bg-slate-700 text-xs border-slate-700 text-slate-200 h-9 gap-1.5"
              >
                <Square className="h-3 w-3 fill-current" />
                Interrupt
              </Button>
            )}

            <Button
              size="sm"
              onClick={handleToggleMic}
              className={`text-xs h-9 px-4 rounded-xl font-semibold gap-1.5 ${
                isListening
                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="h-3.5 w-3.5" />
                  Mute Mic
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5" />
                  Start Speaking
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
