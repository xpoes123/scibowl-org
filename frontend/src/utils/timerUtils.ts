import { useRef, useEffect } from 'react';

/**
 * Configuration for reading speed
 */
export const READING_CONFIG = {
    CHARS_PER_SECOND: 20,
    get MS_PER_CHAR() {
        return 1000 / this.CHARS_PER_SECOND;
    },
} as const;

/**
 * Hook for managing a countdown timer
 */
export function useCountdownTimer(
    initialSeconds: number | null,
    onComplete: () => void,
    enabled: boolean = true
): {
    timeLeft: number | null;
    setTimeLeft: React.Dispatch<React.SetStateAction<number | null>>;
    clearTimer: () => void;
} {
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [timeLeft, setTimeLeft] = React.useState<number | null>(initialSeconds);

    const clearTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    useEffect(() => {
        if (!enabled || timeLeft === null) {
            clearTimer();
            return;
        }

        if (timeLeft === initialSeconds && initialSeconds !== null) {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev === null || prev <= 1) {
                        clearTimer();
                        onComplete();
                        return null;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return clearTimer;
    }, [enabled, timeLeft, initialSeconds, onComplete]);

    return { timeLeft, setTimeLeft, clearTimer };
}

/**
 * Hook for progressive text reveal
 */
export function useProgressiveReveal(
    fullText: string,
    isRevealing: boolean,
    msPerChar: number = READING_CONFIG.MS_PER_CHAR
): {
    currentCharIndex: number;
    revealedText: string;
    isComplete: boolean;
    reset: () => void;
} {
    const [currentCharIndex, setCurrentCharIndex] = React.useState(0);
    const [isComplete, setIsComplete] = React.useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!isRevealing || isComplete) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            return;
        }

        intervalRef.current = setInterval(() => {
            setCurrentCharIndex(prev => {
                const next = prev + 1;
                if (next >= fullText.length) {
                    setIsComplete(true);
                    if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                    }
                    return fullText.length;
                }
                return next;
            });
        }, msPerChar);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isRevealing, isComplete, fullText.length, msPerChar]);

    const reset = () => {
        setCurrentCharIndex(0);
        setIsComplete(false);
    };

    return {
        currentCharIndex,
        revealedText: fullText.slice(0, currentCharIndex),
        isComplete,
        reset,
    };
}
