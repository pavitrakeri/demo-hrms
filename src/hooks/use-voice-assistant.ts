import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

export interface UseVoiceAssistantOptions {
  onSpeechResult?: (transcript: string) => void;
  onSpeechEnd?: () => void;
  silenceTimeoutMs?: number; // silence duration before auto-finalizing speech
  continuous?: boolean;
}

export function useVoiceAssistant(options: UseVoiceAssistantOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 1 for visualizer
  const [isSupported, setIsSupported] = useState(false);
  const [isMicAvailable, setIsMicAvailable] = useState(true);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep latest callbacks in ref to avoid stale closure issues
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const accumulatedFinalRef = useRef("");
  const isListeningRef = useRef(false);
  const isSpeakingRef = useRef(false);

  // Initialize Speech Recognition & Synthesis
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsSupported(true);
    }

    if ("speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
      // Pre-warm voices
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }

    return () => {
      cleanupAudio();
      cleanupRecognition();
      if (synthRef.current) {
        try {
          synthRef.current.cancel();
        } catch {}
      }
    };
  }, []);

  function cleanupAudio() {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  }

  function cleanupRecognition() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    isListeningRef.current = false;
    setIsListening(false);
  }

  // Setup Web Audio Analyser for live mic volume visualization
  const setupAudioAnalyser = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!analyserRef.current || !isListeningRef.current) {
          setAudioLevel(0);
          return;
        }

        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        // Normalize 0 to 1
        const level = Math.min(1, Math.max(0, avg / 128));
        setAudioLevel(level);

        animFrameRef.current = requestAnimationFrame(updateMeter);
      };

      animFrameRef.current = requestAnimationFrame(updateMeter);
      setIsMicAvailable(true);
    } catch (err) {
      console.warn("Could not access microphone for audio meter:", err);
      setIsMicAvailable(false);
    }
  };

  const finalizeSpeech = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    const textToSubmit = accumulatedFinalRef.current.trim();
    if (textToSubmit) {
      optionsRef.current.onSpeechResult?.(textToSubmit);
      accumulatedFinalRef.current = "";
      setTranscript("");
      setInterimTranscript("");
    }
  }, []);

  const startListening = useCallback(async () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error(
        "Speech recognition is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Safari.",
      );
      return;
    }

    // Stop speech synthesis if speaking
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    isSpeakingRef.current = false;
    setIsSpeaking(false);

    cleanupRecognition();
    cleanupAudio();

    await setupAudioAnalyser();

    const recognition = new SpeechRecognition();
    recognition.continuous = optionsRef.current.continuous ?? true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    accumulatedFinalRef.current = "";
    setTranscript("");
    setInterimTranscript("");

    recognition.onstart = () => {
      isListeningRef.current = true;
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      let newFinal = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        if (item.isFinal) {
          newFinal += item[0].transcript + " ";
        } else {
          interim += item[0].transcript;
        }
      }

      if (newFinal) {
        accumulatedFinalRef.current += newFinal;
        setTranscript(accumulatedFinalRef.current.trim());
      }
      setInterimTranscript(interim);

      // Reset silence auto-submit timer whenever speech is detected
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      const silenceTimeout = optionsRef.current.silenceTimeoutMs ?? 1600;
      if (silenceTimeout > 0 && (accumulatedFinalRef.current.trim() || interim.trim())) {
        silenceTimerRef.current = setTimeout(() => {
          // If we have final text or interim text, finalize
          if (interim.trim() && !newFinal) {
            accumulatedFinalRef.current += interim + " ";
            setTranscript(accumulatedFinalRef.current.trim());
            setInterimTranscript("");
          }
          finalizeSpeech();
        }, silenceTimeout);
      }
    };

    recognition.onerror = (event: any) => {
      // 'no-speech' is normal when user is thinking, don't crash
      if (event.error === "no-speech") {
        return;
      }
      if (event.error === "not-allowed") {
        toast.error("Microphone access was denied. Please allow microphone permissions.");
        setIsListening(false);
        isListeningRef.current = false;
        cleanupAudio();
        return;
      }
      if (event.error === "network") {
        console.warn("Speech recognition network issue.");
        return;
      }
      console.warn("Speech recognition error:", event.error);
    };

    recognition.onend = () => {
      // If user is still supposed to be listening (e.g. continuous mode paused by browser), restart
      if (isListeningRef.current && !isSpeakingRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          // Fall through if cannot restart
        }
      }
      isListeningRef.current = false;
      setIsListening(false);
      cleanupAudio();
      optionsRef.current.onSpeechEnd?.();
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.error("Failed to start speech recognition:", e);
      setIsListening(false);
      isListeningRef.current = false;
    }
  }, [finalizeSpeech]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    cleanupAudio();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const speak = useCallback((text: string, onDone?: () => void) => {
    if (!synthRef.current) {
      onDone?.();
      return;
    }

    // Clean markdown formatting, tables, bullets, code fences for natural speech
    const cleanText = text
      // Remove markdown table lines
      .replace(/\|[^\n]+\|/g, " ")
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, " ")
      // Remove markdown links [text](url) -> text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Remove symbols and headers
      .replace(/[#*_`~>[\]]/g, "")
      // Remove raw URLs
      .replace(/https?:\/\/\S+/g, "link")
      // Collapse whitespace
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanText) {
      onDone?.();
      return;
    }

    try {
      synthRef.current.cancel();
      isSpeakingRef.current = true;
      setIsSpeaking(true);

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      // Select natural English voice
      const voices = synthRef.current.getVoices();
      const naturalVoice =
        voices.find(
          (v) =>
            v.lang.startsWith("en") &&
            (v.name.includes("Google") ||
              v.name.includes("Natural") ||
              v.name.includes("Samantha") ||
              v.name.includes("Daniel") ||
              v.name.includes("Jenny") ||
              v.name.includes("Guy")),
        ) ||
        voices.find((v) => v.lang.startsWith("en")) ||
        voices[0];

      if (naturalVoice) {
        utterance.voice = naturalVoice;
      }

      let doneCalled = false;
      const handleDone = () => {
        if (!doneCalled) {
          doneCalled = true;
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          onDone?.();
        }
      };

      utterance.onstart = () => {
        isSpeakingRef.current = true;
        setIsSpeaking(true);
      };

      utterance.onend = handleDone;
      utterance.onerror = (e) => {
        console.warn("Speech synthesis notice:", e);
        handleDone();
      };

      // Safeguard timeout in case browser TTS freezes
      const estimatedDurationMs = Math.max(3000, (cleanText.length / 15) * 1000);
      const safetyTimeout = setTimeout(() => {
        if (isSpeakingRef.current) {
          handleDone();
        }
      }, estimatedDurationMs + 4000);

      const originalOnEnd = utterance.onend;
      utterance.onend = (ev) => {
        clearTimeout(safetyTimeout);
        originalOnEnd?.call(utterance, ev);
      };

      synthRef.current.speak(utterance);
    } catch (e) {
      console.error("Speech synthesis error:", e);
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      onDone?.();
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      try {
        synthRef.current.cancel();
      } catch {}
    }
    isSpeakingRef.current = false;
    setIsSpeaking(false);
  }, []);

  return {
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
  };
}
