import type { Question } from '../data/questions';

type QuestionCardProps = {
    question: Question;
};

export function QuestionCard({ question }: QuestionCardProps) {
    const renderAnswer = () => {
        if (question.questionCategory === "multiple_choice" && question.choices) {
            const correctChoice = question.choices.find(
                (choice) => choice.label === question.answer
            );
            if (correctChoice) {
                return `${correctChoice.label}. ${correctChoice.text}`;
            }
        }
        return question.answer;
    }
    return (
        <div
            style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "12px",
            }}
            >
                <h2 style={{ marginTop: 0, textAlign: "left", marginLeft: "8px" }}>{question.category}</h2>
                <h5 style={{ marginTop: 0, textAlign: "left", marginLeft: "8px" }}>{question.type.charAt(0).toUpperCase() + question.type.slice(1)}</h5>
                <h5 style={{ marginTop: 0, textAlign: "left", marginLeft: "8px" }}>{question.questionCategory.charAt(0).toUpperCase() + question.questionCategory.slice(1).replaceAll("_", " ")}</h5> 
                <p style={{ marginBottom: "8px" , textAlign: "left"}}>{question.text}</p>
                {question.questionCategory === "multiple_choice" && question.choices && (
                    <ul style={{ listStyleType: "none", paddingLeft: 0, textAlign: "left" }}>
                        {question.choices.map((choice) => (
                            <li key={choice.label}>
                                <strong>{choice.label}.</strong> {choice.text}
                            </li>
                        ))}
                        </ul>
                )}
                {question.questionCategory === "identify_all" && question.attributes && (
                    <ul style={{ listStyleType: "none", paddingLeft: 0, textAlign: "left" }}>
                        {question.attributes.map((attr, index) => (
                            <li key={attr}>
                                <strong>{index + 1} </strong> {attr}
                            </li>
                        ))}
                    </ul>
                )}
                {question.questionCategory === "rank" && question.attributes && (
                    <ul style={{ listStyleType: "none", paddingLeft: 0, textAlign: "left" }}>
                        {question.attributes.map((attr, index) => (
                            <li key={attr}>
                                <strong>{index + 1} </strong> {attr}
                            </li>
                        ))}
                    </ul>
                )}
                <p style={{ marginBottom: "8px", fontStyle: "italic", textAlign: "left" }}>Answer: {renderAnswer()}</p>
        </div>
    );
}