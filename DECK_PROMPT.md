# Prompt for generating a deck

Copy everything between the lines, fill in the `<<...>>` placeholders, attach or paste the learning-material text, and send it to Claude (or another AI). Save the reply as a `.json` file in `notes/<COURSE-CODE>/`, for example `notes/PROJ-614/PROJ-614_LO04.json`, then run `update-decks.bat`.

For a textbook chapter instead of a learning objective, see the note at the end of the prompt.

---

You are creating a multiple-choice flashcard deck for a college student, from the learning material I've attached.

**Course code:** <<e.g. PROJ 614>>
**Learning objective number:** <<e.g. 04>>
**Number of questions:** <<e.g. 25>>

Source rules:
- Use ONLY the attached material as the source of truth for every question, answer and explanation. Do not add facts it doesn't contain.
- Paraphrase the material in your own words instead of copying sentences from it.

Question rules:
- Write scenario-based questions: put the concept in a realistic workplace situation, so the question tests understanding and application rather than recall of a definition.
- Cover every major section or sub-objective of the material, and group the questions into subtopics that follow the material's main headings (roughly 4 to 10 subtopics, each with at least 2 questions). Put the subtopic name in each question's `"topic"`.
- Every question has exactly 4 options, A to D, and exactly one correct answer.
- Every wrong option must be plausible: a common misconception, a related concept from the same material, or a logical misstep. No throwaway options.
- Keep all four options similar in length, tone, structure and level of detail. The correct answer must not be the longest or the most detailed option; check this for every question.
- Never use "All of the above", "None of the above", or combined options such as "Both A and B".
- Distribute the correct answers across A, B, C and D randomly and roughly evenly, with no pattern.

Explanation rules (the `"note"`):
- Say why the correct answer is right, citing the logic or the section of the material it comes from.
- Then say briefly why each wrong option is wrong.
- Use this layout, with `\n` between the lines (it matches the other decks):
  `**Why C is correct:** ... (Section name)\n**Why not A:** ...\n**Why not B:** ...\n**Why not D:** ...`
- `**bold**` and `\n` are the only formatting allowed. No HTML.

Output rules (important, the file is read by a program):
- Reply with ONLY the JSON below: no introduction, no explanation, no Markdown code fences.
- It must be valid JSON: double quotes everywhere, no trailing commas, no comments. Escape any double quote inside text as `\"`.
- `"answer"` is a single capital letter that matches one of the option keys.
- `"learningObjective.number"` is a two-digit string ("04", not "4" or 4).
- `"learningObjective.title"` is the learning objective's wording from the material, without the "LO4:" prefix.
- `"source"` is the file name of the material.

Use exactly this structure:

{
  "course": "PROJ 614",
  "learningObjective": {
    "number": "04",
    "title": "Full learning objective title from the material"
  },
  "source": "LO4.pptx",
  "questions": [
    {
      "topic": "Subtopic name",
      "question": "Scenario and question text?",
      "options": {
        "A": "First option",
        "B": "Second option",
        "C": "Third option",
        "D": "Fourth option"
      },
      "answer": "C",
      "note": "**Why C is correct:** ... (Section)\n**Why not A:** ...\n**Why not B:** ...\n**Why not D:** ..."
    }
  ]
}

---

**Textbook chapters and other non-LO decks.** Replace `"learningObjective"` in the prompt's structure with a `"section"`, and optionally add a collection so the course page groups the decks:

```json
"section": { "label": "Chapter", "short": "CH", "number": "05", "title": "Motivation in Action" },
"collection": "Textbook chapters (7th Canadian ed.)",
"collectionOrder": 2,
```

Decks in the same collection should use exactly the same `"collection"` text. `"collectionOrder"` orders the collections on the course page (lowest first).
