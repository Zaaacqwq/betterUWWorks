"use client";

import { useCallback, useRef } from "react";

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

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        defaultValue={value}
        onChange={handleInput}
        placeholder="Search jobs by title, company, skills..."
        className="w-full px-4 py-3 pl-10 border border-hairline rounded-lg bg-canvas text-charcoal text-sm placeholder:text-stone focus:outline-none focus:border-primary transition-colors"
      />
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    </div>
  );
}
