# backend/app/services/pdf_service.py
from io import BytesIO
from datetime import datetime
from xml.sax.saxutils import escape

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, Color
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Flowable, PageBreak, KeepTogether,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

ACCENT = "#6c63ff"
ACCENT_DARK = "#4a3fd6"
ACCENT_LIGHT = "#8b85ff"
INK = "#1f2430"
MUTED = "#6b7280"
SUCCESS = "#10b981"
WARNING = "#f59e0b"
ERROR = "#ef4444"
ORANGE = "#f97316"
LINE = "#e5e7eb"
PANEL = "#f5f5f8"
PANEL_WARN = "#fff7ed"
PANEL_ACCENT = "#f1f0ff"

PAGE_W, PAGE_H = A4
MARGIN = 16 * mm
CONTENT_W = PAGE_W - 2 * MARGIN

CATEGORY_COLORS = {
    "technical": ("#f3e8ff", "#7e22ce"),
    "behavioral": ("#dbeafe", "#1d4ed8"),
    "scenario": ("#ccfbf1", "#0f766e"),
}
DIFFICULTY_COLORS = {
    "easy": ("#d1fae5", "#047857"),
    "medium": ("#fef3c7", "#b45309"),
    "hard": ("#fee2e2", "#b91c1c"),
}
CORRECTNESS_COLORS = {
    "Correct": ("#d1fae5", "#047857"),
    "Partially Correct": ("#fef3c7", "#b45309"),
    "Incorrect": ("#fee2e2", "#b91c1c"),
}
SENTIMENT_COLORS = {
    "confident": ("#d1fae5", "#047857"),
    "calm": ("#d1fae5", "#047857"),
    "stressed": ("#fef3c7", "#b45309"),
    "anxious": ("#ffedd5", "#c2410c"),
    "uncertain": ("#ffedd5", "#c2410c"),
    "cheated": ("#fee2e2", "#b91c1c"),
    "evasive": ("#fee2e2", "#b91c1c"),
    "neutral": ("#e5e7eb", "#374151"),
}


def esc(text):
    return escape(str(text if text is not None else "")).replace("\n", "<br/>")


def hex_to_color(h):
    return HexColor(h)


def blend(hex1, hex2, frac):
    c1, c2 = HexColor(hex1), HexColor(hex2)
    r = c1.red + (c2.red - c1.red) * frac
    g = c1.green + (c2.green - c1.green) * frac
    b = c1.blue + (c2.blue - c1.blue) * frac
    return Color(r, g, b)


def chip_lookup(table, key, default=("#e5e7eb", "#374151")):
    return table.get(key, default)


def build_styles():
    ss = getSampleStyleSheet()
    styles = {
        "h1": ParagraphStyle("h1", parent=ss["Heading1"], fontName="Helvetica-Bold",
                              fontSize=14, textColor=HexColor(ACCENT_DARK),
                              spaceBefore=2, spaceAfter=2, leading=17),
        "h2": ParagraphStyle("h2", parent=ss["Heading2"], fontName="Helvetica-Bold",
                              fontSize=11, textColor=HexColor(INK),
                              spaceBefore=0, spaceAfter=4, leading=14),
        "body": ParagraphStyle("body", parent=ss["BodyText"], fontName="Helvetica",
                                fontSize=9.3, leading=13.5, textColor=HexColor(INK)),
        "muted": ParagraphStyle("muted", parent=ss["BodyText"], fontName="Helvetica",
                                 fontSize=8.3, leading=11.5, textColor=HexColor(MUTED)),
        "bullet": ParagraphStyle("bullet", parent=ss["BodyText"], fontName="Helvetica",
                                  fontSize=9.3, leading=13.5, textColor=HexColor(INK),
                                  leftIndent=4, spaceAfter=4),
        "qtext": ParagraphStyle("qtext", parent=ss["BodyText"], fontName="Helvetica-Bold",
                                 fontSize=10, leading=13.5, textColor=HexColor(INK), spaceAfter=3),
        "label": ParagraphStyle("label", parent=ss["BodyText"], fontName="Helvetica-Bold",
                                 fontSize=7.8, leading=10, textColor=HexColor(ACCENT_DARK),
                                 spaceAfter=2),
        "chip": ParagraphStyle("chip", fontName="Helvetica-Bold", fontSize=7.3,
                                alignment=TA_CENTER, leading=9),
        "scorebig": ParagraphStyle("scorebig", fontName="Helvetica-Bold", fontSize=30,
                                    alignment=TA_CENTER, textColor=HexColor(ACCENT_DARK)),
        "scoresub": ParagraphStyle("scoresub", fontName="Helvetica", fontSize=8,
                                    alignment=TA_CENTER, textColor=HexColor(MUTED)),
    }
    return styles


class HeaderBanner(Flowable):
    def __init__(self, width, height, job_role, generated_on, overall_score, mode):
        Flowable.__init__(self)
        self.width = width
        self.height = height
        self.job_role = job_role
        self.generated_on = generated_on
        self.overall_score = overall_score
        self.mode = mode

    def wrap(self, availWidth, availHeight):
        return self.width, self.height

    def draw(self):
        c = self.canv
        w, h = self.width, self.height

        steps = 48
        for i in range(steps):
            frac = i / (steps - 1)
            c.setFillColor(blend(ACCENT_DARK, ACCENT, frac))
            band_h = h / steps
            c.rect(0, h - (i + 1) * band_h, w, band_h + 0.6, stroke=0, fill=1)

        c.saveState()
        c.setFillColor(white)
        c.setFillAlpha(0.10)
        c.circle(w - 22 * mm, h - 6 * mm, 26 * mm, stroke=0, fill=1)
        c.setFillAlpha(0.07)
        c.circle(w - 40 * mm, h + 4 * mm, 20 * mm, stroke=0, fill=1)
        c.restoreState()

        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 24)
        c.drawString(9 * mm, h - 15 * mm, "InterviewIQ")
        c.setFont("Helvetica", 10.5)
        c.drawString(9 * mm, h - 22 * mm, "Interview Performance Report")
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(9 * mm, h - 28 * mm, f"{self.job_role}  ·  {self.mode.title()} Mode")

        c.setFont("Helvetica", 8)
        c.drawRightString(w - 34 * mm, h - 9 * mm, f"Generated {self.generated_on}")

        cx, cy, r = w - 20 * mm, h - 17 * mm, 11 * mm
        c.setFillColor(white)
        c.circle(cx, cy, r, stroke=0, fill=1)
        c.setFillColor(HexColor(ACCENT_DARK))
        c.setFont("Helvetica-Bold", 15)
        c.drawCentredString(cx, cy - 3, f"{self.overall_score}")
        c.setFont("Helvetica", 6.2)
        c.drawCentredString(cx, cy - 11, "OUT OF 10")


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(HexColor(LINE))
    canvas.setLineWidth(0.6)
    canvas.line(MARGIN, 13 * mm, PAGE_W - MARGIN, 13 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(HexColor(MUTED))
    canvas.drawString(MARGIN, 8.5 * mm, "InterviewIQ  ·  Confidential Interview Performance Report")
    canvas.drawRightString(PAGE_W - MARGIN, 8.5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def section_title(text, styles):
    return [
        Paragraph(esc(text), styles["h1"]),
        HRFlowable(width="100%", thickness=1.1, color=HexColor(ACCENT_LIGHT),
                   spaceBefore=1, spaceAfter=7),
    ]


def panel(content, bg=PANEL, border=None):
    if not isinstance(content, list):
        content = [content]
    t = Table([[content]], colWidths=[CONTENT_W - 2])
    style = [
        ("BACKGROUND", (0, 0), (-1, -1), HexColor(bg)),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]
    if border:
        style.append(("BOX", (0, 0), (-1, -1), 0.75, HexColor(border)))
    t.setStyle(TableStyle(style))
    return t


def bullet_block(items, styles, empty_text="Nothing notable identified."):
    if not items:
        return Paragraph(esc(empty_text), styles["muted"])
    rows = []
    for it in items:
        rows.append(Paragraph(f'<font color="{ACCENT_DARK}"><b>&bull;</b></font>&nbsp;&nbsp;{esc(it)}', styles["bullet"]))
    return rows


def chip(label, bg, fg):
    return Paragraph(f'<font color="{fg}"><b>{esc(label)}</b></font>', ParagraphStyle(
        "chip_%s" % abs(hash(label + bg)), fontName="Helvetica-Bold", fontSize=7.3,
        alignment=TA_CENTER, leading=9,
    ))


def chip_row(chips):
    cells = [[c[0] for c in [(chip(label, bg, fg),)]][0] for (label, bg, fg) in chips]
    t = Table([cells], hAlign="LEFT")
    cmds = [
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
    ]
    for i, (label, bg, fg) in enumerate(chips):
        cmds.append(("BACKGROUND", (i, 0), (i, 0), HexColor(bg)))
    t.setStyle(TableStyle(cmds))
    return t


def score_rating(score):
    if score >= 8:
        return "Excellent", SUCCESS
    if score >= 6:
        return "Good", WARNING
    if score >= 4:
        return "Fair", ORANGE
    return "Needs Work", ERROR


def hiring_chip(rec):
    mapping = {
        "Strong Hire": ("#d1fae5", "#047857"),
        "Hire": ("#dbeafe", "#1d4ed8"),
        "Maybe": ("#fef3c7", "#b45309"),
        "No Hire": ("#fee2e2", "#b91c1c"),
    }
    bg, fg = mapping.get(rec or "", ("#e5e7eb", "#374151"))
    return chip_row([(rec or "Pending", bg, fg)])


def category_score_table(category_scores, styles):
    rows = []
    labels = {
        "technical_knowledge": "Technical Knowledge",
        "communication": "Communication",
        "clarity": "Clarity",
        "confidence": "Confidence",
    }
    for key, label in labels.items():
        val = float(category_scores.get(key, 0))
        rating, color = score_rating(val)
        bar_width = 46
        filled = max(0, min(bar_width, int(bar_width * val / 10)))
        bar = "".join(["\u2588"] * filled) + "".join(["\u2591"] * (bar_width - filled))
        rows.append([
            Paragraph(esc(label), styles["body"]),
            Paragraph(f'<font color="{color}" face="Courier">{bar}</font>', ParagraphStyle(
                "bar", fontName="Helvetica", fontSize=7.5, textColor=HexColor(color))),
            Paragraph(f'<font color="{color}"><b>{val:.1f}/10</b></font>', styles["body"]),
            Paragraph(f'<font color="{color}">{rating}</font>', styles["muted"]),
        ])
    t = Table(rows, colWidths=[38 * mm, 60 * mm, 20 * mm, CONTENT_W - 118 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, HexColor(LINE)),
    ]))
    return t


def integrity_table(integrity, styles):
    rows = [[
        Paragraph("<b>Integrity Score</b>", styles["muted"]),
        Paragraph("<b>Tab Switches</b>", styles["muted"]),
        Paragraph("<b>Cheating Signals</b>", styles["muted"]),
        Paragraph("<b>Total Flags</b>", styles["muted"]),
    ], [
        Paragraph(f'{integrity.get("integrity_score", 100)}/100', styles["h2"]),
        Paragraph(str(integrity.get("tab_switches", 0)), styles["h2"]),
        Paragraph(str(integrity.get("cheating_detection_count", 0)), styles["h2"]),
        Paragraph(str(integrity.get("total_violations", 0)), styles["h2"]),
    ]]
    t = Table(rows, colWidths=[CONTENT_W / 4.0] * 4)
    t.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("BACKGROUND", (0, 0), (-1, -1), HexColor(PANEL)),
        ("BOX", (0, 0), (-1, -1), 0.6, HexColor(LINE)),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, HexColor(LINE)),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    return t


def question_block(idx, q, styles):
    flow = []
    category = q.get("category", "")
    difficulty = q.get("difficulty", "")
    correctness = q.get("correctness", "")
    sentiment = q.get("sentiment", "neutral") or "neutral"
    intent = q.get("intent", "") or "Not detected"
    score = q.get("score", 0)

    cat_bg, cat_fg = chip_lookup(CATEGORY_COLORS, category)
    diff_bg, diff_fg = chip_lookup(DIFFICULTY_COLORS, difficulty)
    corr_bg, corr_fg = chip_lookup(CORRECTNESS_COLORS, correctness)
    sent_bg, sent_fg = chip_lookup(SENTIMENT_COLORS, str(sentiment).lower())

    _, score_color = score_rating(score)

    header_row = Table([[
        Paragraph(f"Q{idx}", ParagraphStyle("qn", fontName="Helvetica-Bold", fontSize=9,
                                             textColor=HexColor(ACCENT_DARK))),
        chip_row([(category, cat_bg, cat_fg), (difficulty, diff_bg, diff_fg)]),
        Paragraph(f'<font color="{score_color}"><b>{score}/10</b></font>', styles["body"]),
    ]], colWidths=[10 * mm, CONTENT_W - 10 * mm - 22 * mm, 22 * mm])
    header_row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (2, 0), (2, 0), "RIGHT"),
    ]))

    flow.append(header_row)
    flow.append(Spacer(1, 4))
    flow.append(Paragraph(esc(q.get("question", "")), styles["qtext"]))
    flow.append(Spacer(1, 2))

    flow.append(Paragraph("YOUR ANSWER", styles["label"]))
    flow.append(panel(Paragraph(esc(q.get("answer", "") or "No answer provided."), styles["body"])))
    flow.append(Spacer(1, 5))

    tags = chip_row([
        (f"Result: {correctness}", corr_bg, corr_fg),
        (f"Sentiment: {sentiment}", sent_bg, sent_fg),
    ])
    flow.append(tags)
    flow.append(Spacer(1, 4))
    flow.append(Paragraph(f'<font color="{ACCENT_DARK}"><b>Intent detected:</b></font> {esc(intent)}', styles["muted"]))
    flow.append(Spacer(1, 5))

    tips = q.get("answer_tips") or []
    if tips:
        flow.append(Paragraph("HOW THIS QUESTION SHOULD BE ANSWERED", styles["label"]))
        flow.extend(bullet_block(tips, styles))
        flow.append(Spacer(1, 4))

    ideal = q.get("ideal_answer", "")
    if ideal:
        flow.append(Paragraph("IDEAL ANSWER THAT SCORES WELL & IMPRESSES THE INTERVIEWER", styles["label"]))
        flow.append(panel(Paragraph(esc(ideal), styles["body"]), bg=PANEL_ACCENT, border=ACCENT_LIGHT))
        flow.append(Spacer(1, 6))

    flow.append(HRFlowable(width="100%", thickness=0.6, color=HexColor(LINE), spaceAfter=8))
    return flow


def build_report_pdf(report: dict) -> bytes:
    styles = build_styles()
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN, topMargin=8 * mm, bottomMargin=20 * mm,
        title="InterviewIQ Performance Report",
    )

    story = []

    overall = report.get("overall_score", 0)
    job_role = report.get("job_role") or "Candidate"
    mode = report.get("mode") or "practice"
    generated_on = datetime.utcnow().strftime("%b %d, %Y %H:%M UTC")

    story.append(HeaderBanner(CONTENT_W, 40 * mm, job_role, generated_on, overall, mode))
    story.append(Spacer(1, 10))

    story.append(Paragraph(
        f"Completed {report.get('completed_questions', 0)} of {report.get('total_questions', 0)} questions",
        styles["muted"],
    ))
    story.append(Spacer(1, 8))

    story.extend(section_title("Score Overview", styles))
    story.append(category_score_table(report.get("category_scores", {}), styles))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Hiring Recommendation", styles["h2"]))
    story.append(hiring_chip(report.get("hiring_recommendation")))
    story.append(Spacer(1, 14))

    story.extend(section_title("Integrity & Session Behavior", styles))
    story.append(integrity_table(report.get("integrity_summary", {}), styles))
    story.append(Spacer(1, 14))

    story.extend(section_title("Overall Sentiment & Intent — Entire Session", styles))
    story.append(panel([
        Paragraph(f'<font color="{ACCENT_DARK}"><b>Overall Sentiment:</b></font> '
                  f'{esc(report.get("overall_sentiment") or "Not available")}', styles["body"]),
        Spacer(1, 4),
        Paragraph(f'<font color="{ACCENT_DARK}"><b>Overall Intent:</b></font> '
                  f'{esc(report.get("overall_intent") or "Not available")}', styles["body"]),
    ], bg=PANEL_ACCENT, border=ACCENT_LIGHT))
    story.append(Spacer(1, 14))

    story.extend(section_title("Areas of Improvement — Topic by Topic", styles))
    story.extend(bullet_block(report.get("weak_areas", []), styles, "No specific weak areas identified."))
    story.append(Spacer(1, 12))

    story.extend(section_title("How to Improve Communication Skills", styles))
    story.extend(bullet_block(report.get("communication_improvement", []), styles,
                               "No specific communication feedback generated."))
    story.append(Spacer(1, 12))

    story.extend(section_title("How to Improve Body Language", styles))
    story.extend(bullet_block(report.get("body_language_improvement", []), styles,
                               "No specific body language feedback generated."))
    story.append(Spacer(1, 12))

    story.extend(section_title("Honest, Brutal Assessment", styles))
    story.append(panel(
        Paragraph(esc(report.get("brutal_assessment") or "No assessment generated."), styles["body"]),
        bg=PANEL_WARN, border=WARNING,
    ))
    story.append(Spacer(1, 14))

    story.extend(section_title("Recommended Study Topics", styles))
    story.extend(bullet_block(report.get("recommended_topics", []), styles, "No topics recommended."))
    story.append(Spacer(1, 12))

    story.extend(section_title("Suggested Improvements", styles))
    story.extend(bullet_block(report.get("suggested_improvements", []), styles, "No suggestions generated."))

    story.append(PageBreak())
    story.extend(section_title("Question-by-Question Breakdown", styles))
    story.append(Spacer(1, 4))

    breakdown = report.get("question_breakdown", [])
    if not breakdown:
        story.append(Paragraph("No questions were answered in this session.", styles["muted"]))
    for i, q in enumerate(breakdown, start=1):
        story.extend(question_block(i, q, styles))

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()