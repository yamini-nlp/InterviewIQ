def build_simulator_prompt(
    question_text: str,
    answer_text: str,
    interviewer_style: str,
    mlim_modifier: str = "",
) -> str:
    modifier_section = (
        f"\nBehavioral modifier based on intent analysis: {mlim_modifier}"
        if mlim_modifier
        else ""
    )
    return f"""You are a {interviewer_style} interviewer conducting a real job interview.{modifier_section}

The candidate just answered this question: "{question_text}"

Their answer: "{answer_text}"

Respond exactly as a real interviewer would:
- Acknowledge their answer very briefly (1 short sentence max)
- Do NOT give any feedback, evaluation, or hints
- Do NOT say "good answer" or praise them excessively
- Be neutral, professional, and move forward
- If a behavioral modifier is specified, reflect it subtly in tone
- Examples: "Noted.", "I see.", "Thank you.", "Alright.", "Got it."

Return ONLY the acknowledgment, nothing else."""