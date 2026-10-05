import { Sparkles } from "lucide-react";

interface PromptChipsProps {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

const PROMPT_SUGGESTIONS = [
  "What is my current leave balance?",
  "Did I clock in today?",
  "Show my pending tasks for this week",
  "What is our company sick leave policy?",
  "Apply for annual leave next Monday",
];

export function PromptChips({ onSelect, disabled }: PromptChipsProps) {
  return (
    <div className="flex flex-wrap gap-1.5 p-2 bg-muted/40 rounded-xl border border-border/50">
      <div className="w-full flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground px-1 pb-1">
        <Sparkles className="h-3 w-3 text-primary" />
        Suggested Prompts
      </div>
      {PROMPT_SUGGESTIONS.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(suggestion)}
          className="text-xs bg-background hover:bg-accent text-foreground/80 hover:text-foreground border border-border/60 rounded-full px-3 py-1 transition-colors text-left disabled:opacity-50"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
