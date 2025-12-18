import { QuestionCard } from "./QuestionCard";
import type { Question } from "../types/api";

type QuestionListProps = {
    questions: Question[];
};

export function QuestionList({ questions }: QuestionListProps) {
    return (
        <div>
            {questions.map((q) => (
                <QuestionCard key={q.id} question={q} />
            ))}
        </div>
    );
}