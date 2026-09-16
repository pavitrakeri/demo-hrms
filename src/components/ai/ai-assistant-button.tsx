import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AiAssistantButtonProps {
  onClick: () => void;
}

export function AiAssistantButton({ onClick }: AiAssistantButtonProps) {
  return (
    <div className="fixed bottom-6 right-6 z-40">
      <Button
        onClick={onClick}
        className="group relative flex items-center gap-2.5 h-12 px-4 rounded-full bg-primary hover:bg-primary/95 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
        style={{
          boxShadow: "0 10px 25px -5px rgba(99, 102, 241, 0.4), 0 8px 10px -6px rgba(99, 102, 241, 0.3)",
        }}
      >
        <div className="relative flex items-center justify-center">
          <Sparkles className="h-5 w-5 animate-pulse text-amber-200" />
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
          </span>
        </div>
        <span className="font-semibold text-xs tracking-wide">Aimploy AI</span>
      </Button>
    </div>
  );
}
