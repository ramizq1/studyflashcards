# Study Decks

A static flashcard site: decks of multiple-choice questions, grouped by course. A deck can cover a learning objective, a lecture, or a textbook chapter, and a course's decks can be grouped into collections (for example "Lecture slides" and "Textbook chapters"). No server code, so any static host works (Netlify, GitHub Pages, Cloudflare Pages, or just opening `index.html`).

## Folder layout

```
index.html              the site
assets/                 styles.css, app.js
courses/courses.json    list of courses (code, full name, card colour)
notes/<COURSE>/*.json   one file per deck
data.js                 GENERATED bundle of the above; don't edit it, but do commit it
build-decks.ps1         builds data.js
update-decks.bat        double-click to run build-decks.ps1
DECK_PROMPT.md          prompt for having an AI write a new deck
netlify.toml            Netlify settings (publish the folder as is, no build step)
.gitignore              keeps Sampleoflearningmaterial/ and local tool folders out of Git
```

`Sampleoflearningmaterial/` holds the course material the decks were written from. It stays on your computer only: `.gitignore` keeps it out of the repository, because the textbook and slides are copyrighted.

## Adding a deck

1. Generate it with the prompt in `DECK_PROMPT.md`.
2. Save it in `notes/<COURSE-CODE>/`. Name it after what it covers, for example:
   - `MGMT-603_LO02.json` for a learning objective
   - `ADMN-600_TEXT_CH05.json` for a textbook chapter, or `ADMN-600_SLIDES_CH04.json` for a chapter's lecture slides
3. Double-click `update-decks.bat`. It lists each deck it picked up and flags any file with broken JSON.
4. Refresh the page. If the site is hosted, commit and push the changes (see below).

To check a new deck before adding it, use **Open deck file** at the top of the page. It loads the file for a preview without changing anything.

## Adding a course

Add a line to `courses/courses.json`, then run `update-decks.bat`:

```json
{ "code": "PROJ 615", "name": "Full course name", "color": "#14b8a6" }
```

`color` is optional. A deck's `"course"` value is matched to a course code ignoring spaces, dashes and case, so `"PROJ614"` and `"proj-614"` both match `PROJ 614`.

## Deck format

```json
{
  "course": "PROJ 614",
  "learningObjective": { "number": "03", "title": "Discuss the project planning phase and the project lifecycle" },
  "source": "LO3.pptx",
  "questions": [
    {
      "question": "Question text?",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "answer": "B",
      "note": "Explanation. **bold** and \n line breaks are supported."
    }
  ]
}
```

Optional fields:

| Field | Where | What it does |
|---|---|---|
| `"deckTitle"` | deck | Overrides the title shown (useful when one learning objective has several decks, e.g. "LO3 Part 2"). |
| `"section"` | deck | Use instead of `learningObjective` for decks that aren't learning objectives. `{ "label": "Chapter", "short": "CH", "number": "05", "title": "Motivation in Action" }` shows as "Chapter 05" on the deck and "CH 05" on its badge. |
| `"collection"` | deck | Groups the course's decks under a heading, e.g. `"Textbook chapters (7th Canadian ed.)"`. Decks without one go under "Other decks". |
| `"collectionOrder"` | deck | Number that orders the collections on the course page (lowest first). |
| `"topic"` | question | Subtopic. Decks with several subtopics get a subtopic filter, a chip on each card, and a score per subtopic on the results page. |

## Using the site

- Click an option, or press **A–D** / **1–4**. **Space** shows the answer without scoring it.
- **← / →** move between questions. The dropdown and the progress bar segments jump to any question.
- The subtopic menu (on decks that have subtopics) limits the deck to one subtopic.
- **Shuffle** reorders the questions, **Reset** clears answers, and **Results** shows your score overall and by subtopic, with an option to retry only the questions you missed.
- Progress is saved per deck in your browser.

## Publishing (GitHub + Netlify)

The site is plain files, so Netlify has nothing to build: `netlify.toml` tells it to publish the folder as it is. That's why `data.js` is committed. Once the GitHub repository is connected to Netlify, every push redeploys the site.

First-time setup, in Command Prompt (create an empty repository on GitHub first, without a README):

```bat
cd /d D:\WEBSITES\QUIZZES_FOR_EACH_SUBJECT
git init
git add .
git commit -m "Initial commit: study flashcards site"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

After that, each time you add or change decks:

1. Double-click `update-decks.bat` (this rebuilds `data.js`).
2. In Command Prompt:

```bat
cd /d D:\WEBSITES\QUIZZES_FOR_EACH_SUBJECT
git add -A
git commit -m "Add ADMN 600 chapter decks"
git push
```
