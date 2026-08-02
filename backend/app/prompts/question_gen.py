def build_question_gen_prompt(job_role: str, job_description: str, resume_text: str = None, num_technical: int = 4, num_behavioral: int = 3, num_scenario: int = 3) -> str:
    job_description = (job_description or "")[:3000]
    resume_text = (resume_text or "")[:4000] if resume_text else None
    resume_section = f"\n\nCandidate Resume:\n{resume_text}" if resume_text else ""
    return f"""You are an expert technical recruiter and interview question designer.

Job Role: {job_role}
Job Description: {job_description}{resume_section}

Generate exactly {num_technical + num_behavioral + num_scenario} interview questions in this JSON format:

{{
  "questions": [
    {{
      "id": "q1",
      "text": "question text here",
      "category": "technical|behavioral|scenario",
      "difficulty": "easy|medium|hard",
      "expected_topics": ["topic1", "topic2"]
    }}
  ]
}}

Requirements:
- Generate {num_technical} technical questions (code, algorithms, system design, domain knowledge)
- Generate {num_behavioral} behavioral questions (STAR method scenarios, teamwork, conflict)
- Generate {num_scenario} scenario-based questions (hypothetical work situations)
- Mix difficulty: some easy, mostly medium, some hard
- Make questions highly specific to the job description
- Questions should feel authentic to a real interview
- Return ONLY valid JSON, no extra text"""