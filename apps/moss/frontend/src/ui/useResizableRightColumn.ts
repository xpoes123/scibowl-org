import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

type Options = {
  storageKey: string;
  defaultRightPx: number;
  minLeftPx: number;
  minRightPx: number;
  gapPx: number;
};

type Result = {
  layoutRef: React.RefObject<HTMLDivElement | null>;
  layoutStyle: CSSProperties;
  isResizing: boolean;
  resizerProps: {
    role: "separator";
    "aria-orientation": "vertical";
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  };
};

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function readStoredNumber(key: string): number | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeStoredNumber(key: string, value: number): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // ignore
  }
}

export default function useResizableRightColumn({
  storageKey,
  defaultRightPx,
  minLeftPx,
  minRightPx,
  gapPx,
}: Options): Result {
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [rightPx, setRightPx] = useState<number>(() => {
    const stored = readStoredNumber(storageKey);
    if (stored === null) return defaultRightPx;
    return Math.max(minRightPx, stored);
  });

  const computeRightPx = useCallback((clientX: number): number | null => {
    const layout = layoutRef.current;
    if (!layout) return null;
    const rect = layout.getBoundingClientRect();
    const containerWidth = rect.width;
    const maxRight = containerWidth - gapPx - minLeftPx;
    if (maxRight <= minRightPx) return minRightPx;
    const desired = rect.right - clientX - (gapPx / 2);
    return clampNumber(desired, minRightPx, maxRight);
  }, [gapPx, minLeftPx, minRightPx]);

  useEffect(() => {
    if (!isResizing) return;

    const onPointerMove = (e: PointerEvent) => {
      if (pointerIdRef.current !== null && e.pointerId !== pointerIdRef.current) return;
      const next = computeRightPx(e.clientX);
      if (next === null) return;
      setRightPx(Math.round(next));
    };

    const onPointerUp = (e: PointerEvent) => {
      if (pointerIdRef.current !== null && e.pointerId !== pointerIdRef.current) return;
      pointerIdRef.current = null;
      setIsResizing(false);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
    window.addEventListener("pointercancel", onPointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [computeRightPx, isResizing]);

  useEffect(() => {
    writeStoredNumber(storageKey, rightPx);
  }, [rightPx, storageKey]);

  const layoutStyle = useMemo(() => {
    return { ["--scoresheetColWidth" as string]: `${rightPx}px` } as CSSProperties;
  }, [rightPx]);

  const onResizerPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    pointerIdRef.current = e.pointerId;
    (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
    setIsResizing(true);
    const next = computeRightPx(e.clientX);
    if (next !== null) setRightPx(Math.round(next));
  }, [computeRightPx]);

  const resizerProps = useMemo(() => {
    return {
      role: "separator" as const,
      "aria-orientation": "vertical" as const,
      onPointerDown: onResizerPointerDown,
    };
  }, [onResizerPointerDown]);

  return { layoutRef, layoutStyle, isResizing, resizerProps };
}
