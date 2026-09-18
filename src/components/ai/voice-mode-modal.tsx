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
  Send,
  RotateCcw,
  Square,
  Radio,
  AudioLines,
  AlertCircle
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

const VOICE_SUGGESTIONS = [
  "How many leaves do I have left?",
  "Did I clock in today?",
  "Show my pending tasks",
  "Explain our sick leave policy",
];

export function VoiceModeModal({
  open,
  onOpenChange,
  conversationId,
  onNewMessage,
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
    transcript,
    interimTranscript,
    audioLevel,
    isSupported,
    isMicAvailable,
    startListening,
    stopListening,
    finalizeSpeech,
    speak,
    stopSpeaking,
  } = useVoiceAssistant({
    silenceTimeoutMs: 1500,
    continuous: true,
    onSpeechResult: (finalText) => {
      if (finalText && finalText.trim()) {
        handleUserSpeechFinalized(finalText.trim());
      }
    },
  });

  // When modal opens, initialize cleanly
  useEffect(() => {
    isMounted.current = true;
    if (open) {
      setLastUserSpeech("");
      setLastAiResponse("");
      setCurrentActionCard(null);

      // Start listening directly without blocking on speech synthesis
      if (isSupported) {
        setVoiceStatus("listening");
        startListening();
      } else {
        setVoiceStatus("idle");
      }
    } else {
      stopListening();
      stopSpeaking();
      setVoiceStatus("idle");
    }

    return () => {
      isMounted.current = false;
      stopListening();
      stopSpeaking();
    };
  }, [open, isSupported, startListening, stopListening, stopSpeaking]);

  async function handleUserSpeechFinalized(userText: string) {
    if (!userText.trim()) return;
    setLastUserSpeech(userText);
    stopListening();
    setVoiceStatus("thinking");

    try {
      const res = await sendAiMessage(userText, conversationId || undefined);
      if (!isMounted.current) return;

      setLastAiResponse(res.response);
      setCurrentActionCard(res.action_card || null);

      onNewMessage?.(userText, res.response, res.action_card);

      if (audioEnabled) {
        setVoiceStatus("speaking");
        speak(res.response, () => {
          if (isMounted.current && open) {
            // After finished speaking, automatically re-listen for follow-up conversation
            setTimeout(() => {
              if (isMounted.current && open) {
                setVoiceStatus("listening");
                startListening();
              }
            }, 600);
          }
        });
      } else {
        setVoiceStatus("idle");
      }
    } catch (e: any) {
      if (!isMounted.current) return;
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

  function handleManualSend() {
    const fullText = (transcript + " " + interimTranscript).trim();
    if (fullText) {
      finalizeSpeech();
    } else {
      toast.info("Please speak a command first");
    }
  }

  function handleToggleAudio() {
    if (audioEnabled) {
      stopSpeaking();
      setAudioEnabled(false);
      toast.info("Audio playback muted");
    } else {
      setAudioEnabled(true);
      toast.info("Audio playback unmuted");
    }
  }

  function handleInterrupt() {
    stopSpeaking();
    setVoiceStatus("listening");
    startListening();
  }

  function handleSuggestionClick(suggestion: string) {
    stopSpeaking();
    handleUserSpeechFinalized(suggestion);
  }

  // Combined live text while speaking
  const liveDisplayText = interimTranscript
    ? `${transcript} ${interimTranscript}`.trim()
    : transcript;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-w-full h-[90vh] sm:h-[680px] p-0 overflow-hidden bg-slate-950 text-slate-100 border border-slate-800 shadow-2xl backdrop-blur-2xl flex flex-col justify-between rounded-3xl">
        {/* Top Header Bar */}
        <div className="p-5 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-tr from-indigo-500 to-cyan-500 p-[1px]">
              <div className="h-full w-full bg-slate-950 rounded-[15px] flex items-center justify-center text-cyan-400">
                <AudioLines className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                Aimploy Live Voice Mode
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Real-Time
                </span>
              </div>
              <div className="text-xs text-slate-400">Natural voice conversation with HRMS</div>
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
          {/* Permission or Support Warning */}
          {!isSupported && (
            <div className="mb-4 flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs px-3.5 py-2 rounded-xl">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Web Speech API is not supported in this browser. Please use Chrome, Edge, or Safari.</span>
            </div>
          )}

          {!isMicAvailable && isSupported && (
            <div className="mb-4 flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs px-3.5 py-2 rounded-xl">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Microphone access blocked. Please check browser microphone permissions.</span>
            </div>
          )}

          {/* Ambient Glow */}
          <div
            className={`absolute w-72 h-72 rounded-full blur-3xl transition-all duration-700 pointer-events-none ${
              voiceStatus === "listening"
                ? "bg-cyan-500/30 scale-125"
                : voiceStatus === "thinking"
                ? "bg-indigo-600/30 animate-pulse scale-100"
                : voiceStatus === "speaking"
                ? "bg-purple-600/35 scale-125"
                : "bg-slate-800/20 scale-75"
            }`}
          />

          {/* Dynamic Concentric Audio Orb */}
          <div className="relative mb-6 flex items-center justify-center">
            {/* Real-time reactive soundwave rings */}
            {voiceStatus === "listening" && (
              <>
                <div
                  className="absolute rounded-full border border-cyan-400/30 transition-transform duration-75 pointer-events-none"
                  style={{
                    width: `${140 + audioLevel * 120}px`,
                    height: `${140 + audioLevel * 120}px`,
                    opacity: 0.3 + audioLevel * 0.7,
                  }}
                />
                <div
                  className="absolute rounded-full bg-cyan-500/10 pointer-events-none"
                  style={{
                    width: `${160 + audioLevel * 160}px`,
                    height: `${160 + audioLevel * 160}px`,
                    opacity: 0.2 + audioLevel * 0.5,
                  }}
                />
              </>
            )}

            {voiceStatus === "speaking" && (
              <>
                <div className="absolute w-44 h-44 rounded-full bg-purple-500/20 animate-ping duration-1000 pointer-events-none" />
                <div className="absolute w-52 h-52 rounded-full bg-pink-500/15 animate-pulse duration-700 pointer-events-none" />
              </>
            )}

            {/* Core Orb Button */}
            <button
              type="button"
              onClick={handleToggleMic}
              style={{
                transform:
                  voiceStatus === "listening"
                    ? `scale(${1 + audioLevel * 0.25})`
                    : undefined,
              }}
              className={`relative z-10 h-32 w-32 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 cursor-pointer ${
                voiceStatus === "listening"
                  ? "bg-gradient-to-tr from-cyan-500 to-indigo-600 shadow-cyan-500/50 ring-4 ring-cyan-400/40"
                  : voiceStatus === "thinking"
                  ? "bg-gradient-to-tr from-indigo-700 to-purple-600 shadow-purple-500/40 animate-spin"
                  : voiceStatus === "speaking"
                  ? "bg-gradient-to-tr from-purple-600 to-pink-600 shadow-pink-500/40 scale-105"
                  : "bg-slate-900 border-2 border-slate-700 hover:border-slate-500 text-slate-400"
              }`}
            >
              {voiceStatus === "listening" ? (
                <Mic className="h-11 w-11 text-white" />
              ) : voiceStatus === "thinking" ? (
                <Sparkles className="h-10 w-10 text-white animate-spin" />
              ) : voiceStatus === "speaking" ? (
                <Radio className="h-11 w-11 text-white animate-pulse" />
              ) : (
                <MicOff className="h-10 w-10 text-slate-400" />
              )}
            </button>
          </div>

          {/* Dynamic Status Text & Soundwave indicator */}
          <div className="text-sm font-semibold tracking-wide uppercase mb-3">
            {voiceStatus === "listening" ? (
              <div className="flex flex-col items-center gap-1.5 text-cyan-300">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                  Listening to you...
                </span>
                {/* 5-bar live equalizer */}
                <div className="flex items-center gap-1 h-4">
                  {[0.4, 0.8, 1.0, 0.7, 0.5].map((factor, i) => (
                    <span
                      key={i}
                      className="w-1 bg-cyan-400 rounded-full transition-all duration-75"
                      style={{
                        height: `${Math.max(4, audioLevel * 18 * factor)}px`,
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : voiceStatus === "thinking" ? (
              <span className="flex items-center justify-center gap-2 text-indigo-300">
                <Sparkles className="h-3.5 w-3.5 animate-spin" />
                Aimploy is processing & checking HR policies...
              </span>
            ) : voiceStatus === "speaking" ? (
              <span className="flex items-center justify-center gap-2 text-purple-300">
                <Volume2 className="h-4 w-4 animate-bounce" />
                Aimploy is speaking...
              </span>
            ) : (
              <span className="text-slate-400">Microphone paused • Tap orb to start</span>
            )}
          </div>

          {/* Real-time Subtitle & Transcription Box */}
          <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-xs space-y-2 min-h-[96px] shadow-inner backdrop-blur flex flex-col justify-center">
            {liveDisplayText ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                    You're saying:
                  </span>
                  {voiceStatus === "listening" && (
                    <span className="text-[10px] text-slate-500">Auto-sends on pause</span>
                  )}
                </div>
                <p className="text-cyan-100 text-sm font-medium leading-snug">
                  "{liveDisplayText}"
                </p>
              </div>
            ) : lastUserSpeech ? (
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Last asked:
                </span>
                <p className="text-slate-200 font-medium">"{lastUserSpeech}"</p>
              </div>
            ) : null}

            {lastAiResponse && !liveDisplayText && (
              <div className="border-t border-slate-800/80 pt-2 text-left">
                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider block mb-1">
                  Aimploy:
                </span>
                <p className="text-indigo-200/90 line-clamp-3 text-xs leading-relaxed">
                  {lastAiResponse}
                </p>
              </div>
            )}

            {!liveDisplayText && !lastUserSpeech && !lastAiResponse && (
              <div className="text-slate-400 text-center py-1">
                <p className="font-medium text-slate-300 mb-1">I'm ready! Speak clearly into your mic.</p>
                <p className="text-[11px] text-slate-500">Or pick a quick suggestion below:</p>
              </div>
            )}
          </div>

          {/* Quick Voice Suggestions */}
          {!lastUserSpeech && !liveDisplayText && (
            <div className="w-full max-w-md mt-3 flex flex-wrap gap-1.5 justify-center">
              {VOICE_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="text-[11px] bg-slate-900/70 hover:bg-indigo-950/60 border border-slate-800 hover:border-indigo-700/60 text-slate-300 hover:text-indigo-200 px-3 py-1.5 rounded-full transition-all"
                >
                  "{suggestion}"
                </button>
              ))}
            </div>
          )}

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
        <div className="p-5 border-t border-slate-800/80 bg-slate-900/70 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 text-cyan-400" />
            <span>Sub-second voice pipeline</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick manual send if user wants to submit immediately */}
            {liveDisplayText && voiceStatus === "listening" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualSend}
                className="bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-200 border-cyan-800 text-xs h-9 gap-1.5"
              >
                <Send className="h-3 w-3" />
                Send Now
              </Button>
            )}

            {isSpeaking && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleInterrupt}
                className="bg-slate-800 hover:bg-slate-700 text-xs border-slate-700 text-slate-200 h-9 gap-1.5"
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
