/**
 * Utility functions for handling keyboard events
 */

/**
 * Checks if the keyboard event target is an input field where we should ignore hotkeys
 */
export function isTypingInInput(e: KeyboardEvent): boolean {
    return (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
    );
}

/**
 * Creates a keyboard event handler with common filtering logic
 */
export function createKeyHandler(
    key: string,
    callback: (e: KeyboardEvent) => void,
    options: {
        ignoreWhenTyping?: boolean;
        preventDefault?: boolean;
        caseSensitive?: boolean;
    } = {}
): (e: KeyboardEvent) => void {
    const {
        ignoreWhenTyping = true,
        preventDefault = false,
        caseSensitive = false,
    } = options;

    return (e: KeyboardEvent) => {
        if (ignoreWhenTyping && isTypingInInput(e)) {
            return;
        }

        const eventKey = caseSensitive ? e.key : e.key.toLowerCase();
        const targetKey = caseSensitive ? key : key.toLowerCase();

        if (eventKey === targetKey) {
            if (preventDefault) {
                e.preventDefault();
            }
            callback(e);
        }
    };
}

/**
 * Adds a keyboard event listener with automatic cleanup
 * Returns a cleanup function
 */
export function useKeyboardShortcut(
    key: string,
    callback: (e: KeyboardEvent) => void,
    options?: {
        ignoreWhenTyping?: boolean;
        preventDefault?: boolean;
        caseSensitive?: boolean;
    }
): () => void {
    const handler = createKeyHandler(key, callback, options);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
}
