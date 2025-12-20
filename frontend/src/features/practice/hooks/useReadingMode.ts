import { useState, useEffect, useRef, useMemo } from 'react';
import type { TransformedQuestion } from '../../../shared/types/api';
import { buildFullQuestionText, freezeChoiceTexts, freezeAttributeTexts } from '../utils/textRevealUtils';
import { READING_CONFIG } from '../utils/timerUtils';

export function useReadingMode(question: TransformedQuestion) {
    const [revealedText, setRevealedText] = useState("");
    const [isReading, setIsReading] = useState(false);
    const [currentCharIndex, setCurrentCharIndex] = useState(0);
    const [hasBuzzed, setHasBuzzed] = useState(false);
    const [frozenChoiceTexts, setFrozenChoiceTexts] = useState<string[]>([]);
    const [frozenAttributeTexts, setFrozenAttributeTexts] = useState<string[]>([]);
    const [buzzTimeLeft, setBuzzTimeLeft] = useState<number | null>(null);

    const readingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const buzzTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fullQuestionText = useMemo(() => buildFullQuestionText(question), [
        question.text,
        question.questionCategory,
        question.choices,
        question.attributes,
    ]);

    // Reset state when question changes
    useEffect(() => {
        setIsReading(true);
        setCurrentCharIndex(0);
        setRevealedText("");
        setHasBuzzed(false);
        setFrozenChoiceTexts([]);
        setFrozenAttributeTexts([]);
    }, [question.id]);

    // Progressive text reveal
    useEffect(() => {
        if (!isReading || hasBuzzed) {
            if (readingIntervalRef.current) {
                clearInterval(readingIntervalRef.current);
            }
            return;
        }

        readingIntervalRef.current = setInterval(() => {
            setCurrentCharIndex(prev => {
                const next = prev + 1;
                if (next >= fullQuestionText.length) {
                    setIsReading(false);
                    if (readingIntervalRef.current) {
                        clearInterval(readingIntervalRef.current);
                    }
                    return fullQuestionText.length;
                }
                return next;
            });
        }, READING_CONFIG.MS_PER_CHAR);

        return () => {
            if (readingIntervalRef.current) {
                clearInterval(readingIntervalRef.current);
            }
        };
    }, [isReading, hasBuzzed, fullQuestionText.length]);

    // Update revealed text
    useEffect(() => {
        setRevealedText(fullQuestionText.slice(0, currentCharIndex));
    }, [currentCharIndex, fullQuestionText]);

    const handleBuzz = () => {
        // Clear the buzz timer if it's running
        if (buzzTimerRef.current) {
            clearInterval(buzzTimerRef.current);
            buzzTimerRef.current = null;
        }
        setBuzzTimeLeft(null);

        // Freeze the current revealed texts
        setFrozenChoiceTexts(freezeChoiceTexts(question, currentCharIndex));
        setFrozenAttributeTexts(freezeAttributeTexts(question, currentCharIndex));

        setHasBuzzed(true);
        setIsReading(false);
    };

    return {
        revealedText,
        isReading,
        currentCharIndex,
        hasBuzzed,
        frozenChoiceTexts,
        frozenAttributeTexts,
        buzzTimeLeft,
        setBuzzTimeLeft,
        buzzTimerRef,
        fullQuestionText,
        handleBuzz,
        setHasBuzzed,
        setIsReading,
    };
}
