import { Question } from "@/types";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface Props {
  question: Question;
  index: number;
  total: number;
}

export function QuestionCard({ question, index, total }: Props) {
  return (
    <Card
      key={question.id}
      variant="glass"
      className="border-primary-500/20 glow-accent animate-slide-up transition-shadow duration-300 hover:shadow-glow-primary"
    >
      <CardHeader>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono text-neutral-500">
            Question {index + 1} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Badge text={question.category} type="category" />
            <Badge text={question.difficulty} type="difficulty" />
          </div>
        </div>
        <div className="h-0.5 bg-gradient-to-r from-primary-500/40 to-transparent rounded-full" />
      </CardHeader>
      <CardContent>
        <p className="font-display text-xl leading-relaxed text-neutral-900">
          {question.text}
        </p>
        {question.expected_topics.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {question.expected_topics.map((t) => (
              <span
                key={t}
                className="text-xs bg-neutral-200/60 text-neutral-500 px-2 py-0.5 rounded-md"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
