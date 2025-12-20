import type { TransformedQuestion } from '../types/api';

/**
 * Builds the full question text including choices or attributes
 */
export function buildFullQuestionText(question: TransformedQuestion): string {
    let text = question.text;

    // Append choices for multiple choice questions
    if (question.questionCategory === "multiple_choice" && question.choices) {
        text += "\n\n";
        question.choices.forEach(choice => {
            text += `${choice.label}) ${choice.text}\n`;
        });
    }

    // Append attributes for identify_all and rank questions
    if ((question.questionCategory === "identify_all" || question.questionCategory === "rank") && question.attributes) {
        text += "\n\n";
        question.attributes.forEach((attr, index) => {
            text += `${index + 1}. ${attr}\n`;
        });
    }

    return text;
}

/**
 * Calculates how much of a specific choice has been revealed
 */
export function getRevealedChoiceText(
    question: TransformedQuestion,
    choiceIndex: number,
    currentCharIndex: number
): string {
    if (!question.choices || question.questionCategory !== "multiple_choice") {
        return "";
    }

    // Calculate where this choice starts in the full text
    let charsSoFar = question.text.length + 2; // +2 for "\n\n"

    for (let i = 0; i < choiceIndex; i++) {
        charsSoFar += question.choices[i].label.length + 2; // "W) "
        charsSoFar += question.choices[i].text.length + 1; // text + "\n"
    }

    const choiceStart = charsSoFar;
    const labelLength = question.choices[choiceIndex].label.length + 2; // "W) "
    const choiceTextStart = choiceStart + labelLength;
    const choiceTextEnd = choiceTextStart + question.choices[choiceIndex].text.length;

    if (currentCharIndex <= choiceTextStart) {
        return ""; // Haven't reached this choice's text yet
    } else if (currentCharIndex >= choiceTextEnd) {
        return question.choices[choiceIndex].text; // Fully revealed
    } else {
        // Partially revealed
        const charsRevealed = currentCharIndex - choiceTextStart;
        return question.choices[choiceIndex].text.slice(0, charsRevealed);
    }
}

/**
 * Calculates how much of a specific attribute has been revealed
 */
export function getRevealedAttributeText(
    question: TransformedQuestion,
    attrIndex: number,
    currentCharIndex: number
): string {
    if (!question.attributes || (question.questionCategory !== "identify_all" && question.questionCategory !== "rank")) {
        return "";
    }

    // Calculate where this attribute starts in the full text
    let charsSoFar = question.text.length + 2; // +2 for "\n\n"

    for (let i = 0; i < attrIndex; i++) {
        const labelLength = String(i + 1).length + 2; // "1. " or "10. "
        charsSoFar += labelLength;
        charsSoFar += question.attributes[i].length + 1; // text + "\n"
    }

    const attrStart = charsSoFar;
    const labelLength = String(attrIndex + 1).length + 2; // "1. "
    const attrTextStart = attrStart + labelLength;
    const attrTextEnd = attrTextStart + question.attributes[attrIndex].length;

    if (currentCharIndex <= attrTextStart) {
        return ""; // Haven't reached this attribute's text yet
    } else if (currentCharIndex >= attrTextEnd) {
        return question.attributes[attrIndex]; // Fully revealed
    } else {
        // Partially revealed
        const charsRevealed = currentCharIndex - attrTextStart;
        return question.attributes[attrIndex].slice(0, charsRevealed);
    }
}

/**
 * Freezes the current revealed texts for all choices
 */
export function freezeChoiceTexts(
    question: TransformedQuestion,
    currentCharIndex: number
): string[] {
    if (!question.choices || question.questionCategory !== "multiple_choice") {
        return [];
    }
    return question.choices.map((_, index) =>
        getRevealedChoiceText(question, index, currentCharIndex)
    );
}

/**
 * Freezes the current revealed texts for all attributes
 */
export function freezeAttributeTexts(
    question: TransformedQuestion,
    currentCharIndex: number
): string[] {
    if (!question.attributes || (question.questionCategory !== "identify_all" && question.questionCategory !== "rank")) {
        return [];
    }
    return question.attributes.map((_, index) =>
        getRevealedAttributeText(question, index, currentCharIndex)
    );
}
