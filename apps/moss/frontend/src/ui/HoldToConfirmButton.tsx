import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type Props = {
  holdMs: number;
  onConfirm: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  hideHoldingLabel?: boolean;
  title?: string;
};

export default function HoldToConfirmButton({ holdMs, onConfirm, children, className, disabled, hideHoldingLabel, title }: Props) {
  const [isHolding, setIsHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const holdTimeoutRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const startMsRef = useRef<number>(0);
  const didConfirmRef = useRef(false);

  const holdMsClamped = useMemo(() => Math.max(0, Math.floor(holdMs)), [holdMs]);

  function clearTimers() {
    if (holdTimeoutRef.current !== null) {
      window.clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function cancelHold() {
    if (didConfirmRef.current) return;
    clearTimers();
    setIsHolding(false);
    setProgress(0);
  }

  function startHold() {
    if (disabled) return;
    if (holdMsClamped === 0) {
      onConfirm();
      return;
    }
    didConfirmRef.current = false;
    startMsRef.current = performance.now();
    setIsHolding(true);
    setProgress(0);

    const tick = () => {
      const elapsed = performance.now() - startMsRef.current;
      const next = Math.max(0, Math.min(1, elapsed / holdMsClamped));
      setProgress(next);
      if (next < 1 && !didConfirmRef.current) {
        rafRef.current = window.requestAnimationFrame(tick);
      }
    };
    rafRef.current = window.requestAnimationFrame(tick);

    holdTimeoutRef.current = window.setTimeout(() => {
      didConfirmRef.current = true;
      clearTimers();
      setIsHolding(false);
      setProgress(0);
      onConfirm();
    }, holdMsClamped);
  }

  useEffect(() => {
    return () => clearTimers();
  }, []);

  return (
    <button
      type="button"
      className={["holdConfirmButton", className ?? ""].filter(Boolean).join(" ")}
      disabled={disabled}
      title={title}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
        startHold();
      }}
      onPointerUp={() => cancelHold()}
      onPointerCancel={() => cancelHold()}
      onPointerLeave={() => cancelHold()}
      style={{ ["--hold-progress" as string]: String(progress) }}
      aria-label={typeof children === "string" ? children : undefined}
    >
      <span className="holdConfirmButtonLabel">
        {isHolding && !hideHoldingLabel ? "Holding…" : children}
      </span>
    </button>
  );
}
