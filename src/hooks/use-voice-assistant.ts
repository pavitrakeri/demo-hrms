import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

export interface UseVoiceAssistantOptions {
  onSpeechResult?: (transcript: string) => void;
  onSpeechEnd?: () => void;
}

export function useVoiceAssistant(options: UseVoiceAssistantOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        setIsSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onstart = () => {
          setIsListening(true);
          setTranscript("");
          setInterimTranscript("");
        };

        recognition.onresult = (event: any) => {
          let interim = "";
          let final = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const item = event.results[i];
            if (item.isFinal) {
              final += item[0].transcript;
            } else {
              interim += item[0].transcript;
            }
          }
          if (final) {
            setTranscript(final.trim());
            options.onSpeechResult?.(final.trim());
          }
          setInterimTranscript(interim);
        };

        recognition.onerror = (event: any) => {
          console.warn("Speech recognition error:", event.error);
          setIsListening(false);
          if (event.error === "not-allowed") {
            toast.error("Microphone access was denied. Please check your browser permissions.");
          }
        };

        recognition.onend = () => {
          setIsListening(false);
          options.onSpeechEnd?.();
        };

        recognitionRef.current = recognition;
      }

      if ("speechSynthesis" in window) {
        synthRef.current = window.speechSynthesis;
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      if (synthRef.current) {
        try {
          synthRef.current.cancel();
        } catch {}
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      toast.error("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }
    // Stop any speech output before listening
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
    try {
      recognitionRef.current.start();
    } catch (e) {
      // If already started, abort and restart
      try {
        recognitionRef.current.abort();
        recognitionRef.current.start();
      } catch {}
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
  }, []);

  const speak = useCallback((text: string, onDone?: () => void) => {
    if (!synthRef.current) return;

    // Clean markdown formatting characters for natural speech
    const cleanText = text
      .replace(/[*#_`~[\]()]/g, "")
      .replace(/https?:\/\/\S+/g, "link")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanText) return;

    try {
      synthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      // Prefer natural English voices
      const voices = synthRef.current.getVoices();
      const naturalVoice = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Samantha") || v.name.includes("Daniel"))
      ) || voices.find((v) => v.lang.startsWith("en"));

      if (naturalVoice) {
        utterance.voice = naturalVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        onDone?.();
      };
      utterance.onerror = () => setIsSpeaking(false);

      synthRef.current.speak(utterance);
    } catch (e) {
      console.error("Speech synthesis error:", e);
      setIsSpeaking(false);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      try {
        synthRef.current.cancel();
      } catch {}
    }
    setIsSpeaking(false);
  }, []);

  return {
    isListening,
    isSpeaking,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
