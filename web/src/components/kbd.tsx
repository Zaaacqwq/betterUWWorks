export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-block min-w-[18px] px-1 text-center font-sans text-[11px] leading-[16px] text-steel bg-canvas border border-hairline border-b-2 rounded">
      {children}
    </kbd>
  );
}
