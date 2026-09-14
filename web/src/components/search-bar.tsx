"use client";

import { useCallback, useEffect, useRef } from "react";
import { SearchIcon } from "./icons";
import { Kbd } from "./kbd";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onChange(v), 300);
    },
    [onChange]
  );

  // "/" jumps to search from anywhere that isn't already a text field.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (document.querySelector("[aria-modal='true']")) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div data-tour="search" className="relative">
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone pointer-events-none" />
      <input
        ref={inputRef}
        type="search"
        defaultValue={value}
        onChange={handleInput}
        onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
        placeholder="Search title, employer, skill"
        aria-label="Search jobs"
        className="peer w-full h-10 pl-9 pr-10 border border-hairline rounded-lg bg-canvas text-charcoal text-sm placeholder:text-stone focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/12 transition-colors [&::-webkit-search-cancel-button]:hidden"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none peer-focus:hidden">
        <Kbd>/</Kbd>
      </span>
    </div>
  );
}
