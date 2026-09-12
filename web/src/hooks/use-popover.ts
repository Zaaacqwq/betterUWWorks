"use client";

import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";

interface Popover {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  ref: RefObject<HTMLDivElement | null>;
}

// Open/closed state for a dropdown that closes on an outside click, on focus
// moving outside it (Tab), or on Escape.
// `ref` goes on the element wrapping both the trigger and the panel.
export function usePopover(onClose?: () => void): Popover {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const wasOpen = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      if (wasOpen.current) onCloseRef.current?.();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleFocus(e: FocusEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("focusin", handleFocus);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("focusin", handleFocus);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return { open, setOpen, ref };
}
