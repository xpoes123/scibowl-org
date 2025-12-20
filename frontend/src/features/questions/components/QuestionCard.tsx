import type { TransformedQuestion } from '../../../shared/types/api';

type QuestionCardProps = {
    question: TransformedQuestion;
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
        <div className="border border-[#7d70f1]/20 rounded-xl p-5 mb-4 bg-slate-800/50 backdrop-blur-sm shadow-lg hover:shadow-xl hover:border-[#7d70f1]/40 transition-all">
            <div className="mb-3">
                <h2 className="text-xl font-bold bg-gradient-to-r from-[#7d70f1] to-[#b4a8ff] bg-clip-text text-transparent mb-1">{question.category}</h2>
                <div className="flex gap-2">
                    <span className="text-xs px-2 py-1 bg-[#7d70f1]/20 text-[#b4a8ff] rounded-md font-medium border border-[#7d70f1]/30">
                        {question.type.charAt(0).toUpperCase() + question.type.slice(1)}
                    </span>
                    <span className="text-xs px-2 py-1 bg-[#9789f5]/20 text-[#c4baff] rounded-md font-medium border border-[#9789f5]/30">
                        {question.questionCategory.charAt(0).toUpperCase() + question.questionCategory.slice(1).replaceAll("_", " ")}
                    </span>
                </div>
            </div>

            <p className="mb-4 text-slate-200 leading-relaxed">{question.text}</p>

            {question.questionCategory === "multiple_choice" && question.choices && (
                <ul className="list-none pl-0 space-y-2 mb-4">
                    {question.choices.map((choice) => (
                        <li key={choice.label} className="text-slate-300 bg-slate-700/30 p-2 rounded-lg">
                            <strong className="text-white">{choice.label}.</strong> {choice.text}
                        </li>
                    ))}
                </ul>
            )}

            {question.questionCategory === "identify_all" && question.attributes && (
                <ul className="list-none pl-0 space-y-1 mb-4">
                    {question.attributes.map((attr, index) => (
                        <li key={attr} className="text-slate-300">
                            <strong className="text-white">{index + 1}.</strong> {attr}
                        </li>
                    ))}
                </ul>
            )}

            {question.questionCategory === "rank" && question.attributes && (
                <ul className="list-none pl-0 space-y-1 mb-4">
                    {question.attributes.map((attr, index) => (
                        <li key={attr} className="text-slate-300">
                            <strong className="text-white">{index + 1}.</strong> {attr}
                        </li>
                    ))}
                </ul>
            )}

            <p className="italic text-green-400 font-medium">Answer: {renderAnswer()}</p>
        </div>
    );
}