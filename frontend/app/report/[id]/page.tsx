"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getReport } from "@/lib/api";
import { Report } from "@/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge, Progress } from "@/components/ui/Badge";
import { scoreColor } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { MLIMReportSection } from "@/components/mlim/MLIMReportSection";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from "recharts";
import { Download, BookOpen, Target, TrendingUp, Loader2, ChevronDown, ChevronUp } from "lucide-react";

export default function ReportPage() {
  const { id } = useParams();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    getReport(id as string)
      .then((r) => { setReport(r); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  const exportPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: html2canvas } = await import("html2canvas");
    const el = document.getElementById("report-content");
    if (!el) return;
    const bgVar = getComputedStyle(document.documentElement).getPropertyValue("--color-neutral-50").trim();
    const bgColor = bgVar ? `rgb(${bgVar.replace(/\s+/g, ", ")})` : "#ffffff";
    const canvas = await html2canvas(el, { backgroundColor: bgColor, scale: 2 });
    const pdf = new jsPDF("p", "mm", "a4");
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height / canvas.width) * w;
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, h);
    pdf.save(`InterviewIQ_Report_${id}.pdf`);
  };

  if (loading) return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <Loader2 className="animate-spin text-accent" size={32} />
    </div>
  );
  if (!report) return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center text-neutral-500">
      Report not found
    </div>
  );

  const radarData = [
    { subject: "Technical", value: report.category_scores.technical_knowledge * 10 },
    { subject: "Communication", value: report.category_scores.communication * 10 },
    { subject: "Clarity", value: report.category_scores.clarity * 10 },
    { subject: "Confidence", value: report.category_scores.confidence * 10 },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="pt-24 pb-16 px-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold">Interview Report</h1>
            <p className="text-neutral-500 mt-1">{report.completed_questions} of {report.total_questions} questions completed</p>
          </div>
          <Button onClick={exportPDF} variant="outline">
            <Download size={14} /> Export PDF
          </Button>
        </div>

        <div id="report-content" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="md:col-span-2 flex flex-col items-center justify-center text-center py-8">
              <p className="text-neutral-500 text-sm mb-2">Overall Score</p>
              <p className={`font-display text-7xl font-bold ${scoreColor(report.overall_score)}`}>
                {report.overall_score}
              </p>
              <p className="text-neutral-500 text-sm mt-1">out of 10</p>
            </Card>
            <Card className="md:col-span-2">
              <ResponsiveContainer width="100%" height={180}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(128,128,128,0.2)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#6b7280" }} />
                  <Radar dataKey="value" stroke="#6c63ff" fill="#6c63ff" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(report.category_scores).map(([key, val]) => (
              <Card key={key} className="flex items-center gap-4 py-4">
                <div className="flex-1">
                  <p className="text-sm capitalize text-neutral-500 mb-1.5">{key.replace(/_/g, " ")}</p>
                  <Progress value={val as number} />
                </div>
                <span className={`font-display font-bold text-lg ${scoreColor(val as number)}`}>
                  {(val as number).toFixed(1)}
                </span>
              </Card>
            ))}
          </div>

          <MLIMReportSection sessionId={id as string} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-error-500">
                  <Target size={14} /> Weak Areas
                </CardTitle>
              </CardHeader>
              <ul className="space-y-2">
                {report.weak_areas.map((a, i) => (
                  <li key={i} className="text-sm text-neutral-600 flex gap-2">
                    <span className="text-error-500 mt-0.5">•</span>{a}
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-accent">
                  <BookOpen size={14} /> Study Topics
                </CardTitle>
              </CardHeader>
              <ul className="space-y-2">
                {report.recommended_topics.map((t, i) => (
                  <li key={i} className="text-sm text-neutral-600 flex gap-2">
                    <span className="text-accent">→</span>{t}
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-success-500">
                  <TrendingUp size={14} /> Improvements
                </CardTitle>
              </CardHeader>
              <ul className="space-y-2">
                {report.suggested_improvements.map((s, i) => (
                  <li key={i} className="text-sm text-neutral-600 flex gap-2">
                    <span className="text-success-500">✓</span>{s}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Question Breakdown</CardTitle></CardHeader>
            <div className="space-y-3">
              {report.question_breakdown.map((q, i) => (
                <div key={i} className="border border-neutral-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                    className="w-full text-left p-4 hover:bg-neutral-100 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <span className="text-xs text-neutral-500 font-mono mt-0.5 flex-shrink-0">Q{i + 1}</span>
                        <p className="text-sm text-neutral-800 leading-relaxed">{q.question}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge text={q.category} type="category" />
                        <Badge text={q.difficulty} type="difficulty" />
                        <span className={`font-bold text-sm min-w-[40px] text-right ${scoreColor(q.score)}`}>
                          {q.score}/10
                        </span>
                        {expandedIndex === i
                          ? <ChevronUp size={14} className="text-neutral-500" />
                          : <ChevronDown size={14} className="text-neutral-500" />
                        }
                      </div>
                    </div>
                  </button>

                  {expandedIndex === i && (
                    <div className="border-t border-neutral-200 p-4 space-y-4 bg-neutral-100">
                      <div>
                        <p className="text-xs font-medium text-accent mb-2">Your Answer</p>
                        <div className="bg-neutral-100 rounded-xl p-4 border border-neutral-200">
                          <p className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">{q.answer}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-500">Result:</span>
                        <Badge text={q.correctness} type="correctness" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}