"use client";

import { useState } from "react";
import { Copy, Check, Info } from "lucide-react";
import { toast } from "sonner";

/*
TEAM CODE WIDGET
Displays the secret invite code with click-to-reveal obfuscation and 1-click clipboard copy.
*/

export function TeamCodeWidget({ teamId }: { teamId: string }) {
  const [isCodeRevealed, setIsCodeRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(teamId);
      setCopied(true);
      toast.success("Team code copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy team code.");
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">Team Code:</span>
        <button
          type="button"
          onClick={() => setIsCodeRevealed((prev) => !prev)}
          className={`relative inline-flex items-center justify-center px-2 py-0.5 text-xs font-mono rounded cursor-pointer transition-all duration-150 select-none ${
            isCodeRevealed
              ? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-200 border border-gray-300 dark:border-zinc-700 select-all"
              : "bg-gray-300 hover:bg-gray-400/80 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-transparent border border-gray-300 dark:border-zinc-600"
          }`}
          title={isCodeRevealed ? "Click to conceal code" : "Click to reveal code"}
        >
          {isCodeRevealed ? (
            <span>{teamId}</span>
          ) : (
            <>
              <span className="opacity-0 select-none">{teamId}</span>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-sans font-medium text-gray-600 dark:text-zinc-300">
                Reveal code
              </span>
            </>
          )}
        </button>

        {isCodeRevealed && (
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-zinc-800"
            title="Copy team code"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-zinc-400 flex items-center gap-1.5 pt-0.5">
        <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span>This is your team invite code. Do not share it with anyone you don&apos;t know.</span>
      </p>
    </div>
  );
}
