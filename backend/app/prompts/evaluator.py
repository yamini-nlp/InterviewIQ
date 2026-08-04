def build_evaluation_prompt(question_text: str, category: str, difficulty: str, answer_text: str, job_role: str) -> str:
    return f"""You are an expert technical interviewer evaluating a candidate's answer. You are also
trained in behavioral psychology and can read emotional tone and intent from written answers.

Job Role: {job_role}
Question Category: {category}
Difficulty Level: {difficulty}
Question: {question_text}
Candidate's Answer: {answer_text}

Evaluate the answer and respond in this exact JSON format:

{{
  "correctness": "Correct|Partially Correct|Incorrect",
  "score": <integer 0-10>,
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "ideal_answer": "A comprehensive ideal answer that would score a 10/10 and impress the interviewer",
  "suggestions": ["specific suggestion 1", "specific suggestion 2"],
  "sentiment": "confident|calm|stressed|anxious|uncertain|evasive|cheated|neutral",
  "intent": "one short phrase describing what the candidate seemed to actually be doing with this answer, e.g. genuine_answer, rehearsed_script, face_saving_assertion, expressing_confusion, stalling_for_time, off_topic",
  "answer_tips": ["a concrete tip on how this exact question needs to be answered", "another concrete tip"]
}}

Scoring guide:
- 9-10: Exceptional, covers all aspects with depth
- 7-8: Good, covers main points with minor gaps
- 5-6: Adequate, covers basics but lacks depth
- 3-4: Below average, significant gaps
- 0-2: Poor or irrelevant answer

Sentiment guide:
- "confident"/"calm": answer is composed, direct, well organized
- "stressed"/"anxious"/"uncertain": answer hedges heavily, rambles, or shows visible hesitation in wording
- "evasive"/"cheated": answer reads suspiciously polished/out of character for the rest of the response, is copy-pasted in style, or dodges the actual question entirely
- "neutral": none of the above stand out

Be constructive, specific, and honest — do not inflate scores. Return ONLY valid JSON."""