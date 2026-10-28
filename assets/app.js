/* Study Decks — static flashcard app.
   Data comes from data.js (window.FLASHCARDS), which build-decks.ps1 generates
   from courses/courses.json and every deck JSON file under notes/. */
(() => {
  'use strict';

  const $ = (sel, el = document) => el.querySelector(sel);
  const app = $('#app');
  const KEY = 'fc:deck:';
  const PALETTE = ['#6d5efc', '#0ea5e9', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6'];

  // ---------- Helpers ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } }
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Minimal formatting for AI-written notes: **bold**, `code`, line breaks.
  const rich = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
  const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const slug = s => String(s || '').trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const pad = n => String(n).padStart(2, '0');
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const I = {
    left: svg('<path d="M15 18l-6-6 6-6"/>'),
    right: svg('<path d="M9 18l6-6-6-6"/>'),
    shuffle: svg('<path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>'),
    reset: svg('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
    eye: svg('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'),
    check: svg('<path d="M20 6L9 17l-5-5"/>'),
    x: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
    flag: svg('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>'),
    back: svg('<path d="M19 12H5M12 19l-7-7 7-7"/>')
  };

  function toast(msg, type) {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const t = document.createElement('div');
    t.className = 'toast' + (type ? ' ' + type : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  // ---------- Data ----------
  let raw = window.FLASHCARDS;
  let meta = {};
  let courses = [];
  const decks = [];

  function courseFor(code) {
    const key = norm(code);
    let c = courses.find(x => x.key === key);
    if (!c) {
      c = { code: code || 'Unassigned', name: 'Not listed in courses/courses.json', color: '#94a3b8', key, slug: slug(code || 'unassigned'), decks: [], unlisted: true };
      courses.push(c);
    }
    return c;
  }

  function normalizeDeck(data, file, preview) {
    const warnings = [];
    // "section" (e.g. a textbook chapter) or the original "learningObjective" field.
    const loRaw = data.section ?? data.learningObjective ?? data.lo ?? {};
    const lo = typeof loRaw === 'object' ? loRaw : { number: loRaw };
    const num = parseInt(String(lo.number ?? '').replace(/\D/g, ''), 10);
    const questions = [];

    (Array.isArray(data.questions) ? data.questions : []).forEach((q, i) => {
      let opts = q.options || {};
      if (Array.isArray(opts)) opts = Object.fromEntries(opts.map((o, j) => [String.fromCharCode(65 + j), o]));
      const options = {};
      Object.keys(opts).forEach(k => { options[k.trim().toUpperCase()] = String(opts[k]); });
      const keys = Object.keys(options).sort();
      const answer = String(q.answer ?? '').trim().toUpperCase().charAt(0);
      if (!q.question || keys.length < 2 || !options[answer]) {
        warnings.push(`Question ${i + 1} skipped (needs question text, at least 2 options, and an answer that matches an option letter).`);
        return;
      }
      questions.push({ question: String(q.question), options, keys, answer, note: q.note ? String(q.note) : '', topic: q.topic ? String(q.topic).trim() : '' });
    });

    if (!questions.length) warnings.push('This deck has no valid questions.');
    const order = Number(data.collectionOrder);
    const path = (file || 'deck').replace(/\.json$/i, '');
    const base = path.split('/').pop();
    // Short id from the file name; fall back to the full path if another file already uses it.
    let id = (preview ? 'preview-' : '') + slug(base);
    if (!preview && decks.some(d => d.id === id && d.file !== file)) id = slug(path);
    return {
      id,
      file,
      preview: !!preview,
      courseCode: data.course,
      loNum: Number.isFinite(num) ? num : null,
      loTitle: lo.title || '',
      label: lo.label || 'Learning Objective',
      short: lo.short || 'LO',
      collection: data.collection ? String(data.collection) : '',
      collectionOrder: data.collectionOrder != null && Number.isFinite(order) ? order : 99,
      title: data.deckTitle || lo.title || base,
      source: data.source || '',
      topics: [...new Set(questions.map(q => q.topic).filter(Boolean))],
      questions,
      warnings
    };
  }

  const numLabel = d => (d.loNum != null ? pad(d.loNum) : '—');
  const inTopic = (d, topic) => [...d.questions.keys()].filter(i => topic === 'all' || d.questions[i].topic === topic);

  function addDeck(data, file, preview) {
    const d = normalizeDeck(data || {}, file, preview);
    const c = courseFor(d.courseCode);
    d.course = c;
    const existing = decks.findIndex(x => x.id === d.id);
    if (existing >= 0) {
      const old = decks[existing];
      old.course.decks = old.course.decks.filter(x => x !== old);
      decks.splice(existing, 1);
    }
    decks.push(d);
    c.decks.push(d);
    c.decks.sort((a, b) => a.collectionOrder - b.collectionOrder || a.collection.localeCompare(b.collection) ||
      (a.loNum ?? 999) - (b.loNum ?? 999) || a.title.localeCompare(b.title));
    return d;
  }

  function loadData() {
    meta = raw.courses || {};
    courses = (meta.courses || []).map((c, i) => ({
      code: c.code,
      name: c.name || '',
      color: c.color || PALETTE[i % PALETTE.length],
      key: norm(c.code),
      slug: slug(c.code),
      decks: []
    }));
    (raw.decks || []).forEach(d => addDeck(d.data, d.file));
  }

  // ---------- Session state ----------
  let session = null;

  const sig = deck => deck.questions.length + ':' + deck.questions.map(q => q.question.length + q.answer).join('.');

  function loadSession(deck) {
    const n = deck.questions.length;
    const s = { deck, order: [...Array(n).keys()], pos: 0, answers: {}, view: 'card', anim: 'fade', topic: 'all' };
    const saved = deck.preview ? null : store.get(KEY + deck.id);
    if (saved && saved.sig === sig(deck) && Array.isArray(saved.order) && saved.order.length &&
        saved.order.every(i => Number.isInteger(i) && i >= 0 && i < n)) {
      s.order = saved.order;
      s.pos = Math.min(Math.max(saved.pos || 0, 0), saved.order.length - 1);
      s.answers = saved.answers || {};
      s.topic = deck.topics.includes(saved.topic) ? saved.topic : 'all';
    }
    return s;
  }

  function saveSession() {
    if (!session || session.deck.preview) return;
    const { deck, order, pos, answers, topic } = session;
    store.set(KEY + deck.id, { sig: sig(deck), order, pos, answers, topic });
  }

  function statusOf(deck, answers, qi) {
    const a = answers[qi];
    if (a == null) return 'open';
    if (a === '?') return 'revealed';
    return a === deck.questions[qi].answer ? 'correct' : 'wrong';
  }

  function tally(deck, answers, indices) {
    const t = { total: indices.length, correct: 0, wrong: 0, revealed: 0, open: 0 };
    indices.forEach(i => { t[statusOf(deck, answers, i)]++; });
    t.answered = t.correct + t.wrong;
    t.done = t.total - t.open;
    t.acc = t.answered ? Math.round((t.correct / t.answered) * 100) : null;
    return t;
  }

  function deckProgress(deck) {
    const saved = deck.preview ? null : store.get(KEY + deck.id);
    const answers = saved && saved.sig === sig(deck) ? saved.answers || {} : {};
    return tally(deck, answers, [...deck.questions.keys()]);
  }

  // ---------- Views ----------
  function setView(html) {
    app.innerHTML = html;
    window.scrollTo({ top: 0 });
  }

  function renderMissing() {
    setView(`
      <section class="hero">
        <div class="eyebrow">Setup needed</div>
        <h1>No deck data <span class="grad">found</span></h1>
        <p class="lead">The page couldn't load <code>data.js</code>. Double-click <code>update-decks.bat</code> in the site folder to build it from <code>courses/courses.json</code> and the deck files in <code>notes/</code>, then refresh this page.</p>
      </section>`);
  }

  function renderHome() {
    session = null;
    const nDecks = decks.length;
    const nQs = decks.reduce((s, d) => s + d.questions.length, 0);
    const place = [meta.institution, meta.campus].filter(Boolean).join(' · ');
    const cards = courses.map((c, i) => {
      const qs = c.decks.reduce((s, d) => s + d.questions.length, 0);
      const done = c.decks.reduce((s, d) => s + deckProgress(d).done, 0);
      const pct = qs ? Math.round((done / qs) * 100) : 0;
      return `
        <a class="course-card${c.decks.length ? '' : ' empty'}" href="#/c/${c.slug}" style="--c:${esc(c.color)};--i:${i}">
          <div class="cc-top">
            <span class="cc-code">${esc(c.code)}</span>
            <span class="pill">${c.decks.length ? plural(c.decks.length, 'deck') : 'No decks yet'}</span>
          </div>
          <p class="cc-name">${esc(c.name)}</p>
          <div class="cc-foot">
            ${qs ? `<span>${plural(qs, 'question')}</span><div class="bar"><i style="width:${pct}%"></i></div><span>${pct}%</span>` : '<span>Add deck files to notes/</span>'}
          </div>
        </a>`;
    }).join('');

    setView(`
      <section class="hero">
        ${place ? `<div class="eyebrow">${esc(place)}</div>` : ''}
        <h1>Study <span class="grad">Decks</span></h1>
        <p class="lead">Pick a course, choose a deck, and work through the questions one card at a time.</p>
        <div class="chips">
          <span class="chip"><b>${courses.length}</b> courses</span>
          <span class="chip"><b>${nDecks}</b> ${nDecks === 1 ? 'deck' : 'decks'}</span>
          <span class="chip"><b>${nQs}</b> questions</span>
        </div>
      </section>
      <section class="grid">${cards}</section>`);
  }

  function renderCourse(courseSlug) {
    session = null;
    const c = courses.find(x => x.slug.toLowerCase() === String(courseSlug).toLowerCase());
    if (!c) { location.hash = '#/'; return; }

    // Decks are grouped under a heading per collection (e.g. lecture slides vs textbook chapters).
    const hasCollections = c.decks.some(d => d.collection);
    let lastCol;
    const list = c.decks.map((d, i) => {
      const p = deckProgress(d);
      const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
      const label = p.done === 0 ? 'Start' : p.done < p.total ? 'Continue' : 'Review';
      let head = '';
      if (hasCollections && d.collection !== lastCol) {
        const group = c.decks.filter(x => x.collection === d.collection);
        head = `<h2 class="collection-head"><span>${esc(d.collection || 'Other decks')}</span><small>${plural(group.length, 'deck')} · ${plural(group.reduce((n, x) => n + x.questions.length, 0), 'question')}</small></h2>`;
        lastCol = d.collection;
      }
      return `${head}
        <a class="deck-card" href="#/d/${d.id}" style="--c:${esc(c.color)};--i:${Math.min(i, 8)}">
          <div class="lo-badge"><small>${esc(d.short)}</small><b>${numLabel(d)}</b></div>
          <div>
            <h3>${esc(d.title)}${d.preview ? ' <span class="pill">Preview</span>' : ''}</h3>
            <div class="deck-meta">
              <span>${plural(d.questions.length, 'question')}</span>
              ${d.topics.length > 1 ? `<span>${plural(d.topics.length, 'subtopic')}</span>` : ''}
              <div class="bar"><i style="width:${pct}%"></i></div>
              <span>${p.done ? `${p.correct}/${p.total} correct` : 'Not started'}</span>
              ${d.warnings.length ? `<span class="warn">⚠ ${plural(d.warnings.length, 'warning')}</span>` : ''}
            </div>
          </div>
          <span class="go">${label} ${I.right}</span>
        </a>`;
    }).join('');
    const nQs = c.decks.reduce((n, d) => n + d.questions.length, 0);

    setView(`
      <section class="page-head">
        <nav class="crumbs"><a href="#/">Courses</a><span>›</span><span>${esc(c.code)}</span></nav>
        <h1 style="margin-top:14px">${esc(c.code)}</h1>
        <p class="lead">${esc(c.name)}</p>
        ${c.decks.length ? `<div class="chips"><span class="chip"><b>${c.decks.length}</b> ${c.decks.length === 1 ? 'deck' : 'decks'}</span><span class="chip"><b>${nQs}</b> questions</span></div>` : ''}
      </section>
      <section class="deck-list">
        ${list || `
          <div class="empty-state">
            <h3>No decks yet</h3>
            <p>Save deck files for this course in <code>notes/${esc(c.slug)}/</code> with <code>"course": "${esc(c.code)}"</code>, then run <code>update-decks.bat</code>.</p>
          </div>`}
      </section>`);
  }

  function renderDeck(id, qParam) {
    const deck = decks.find(d => d.id === id);
    if (!deck) { location.hash = '#/'; return; }
    if (!session || session.deck !== deck) session = loadSession(deck);
    if (!deck.questions.length) {
      setView(`<section class="quiz">${crumbs(deck)}<div class="empty-state" style="margin-top:20px"><h3>Nothing to study here</h3><p>${deck.warnings.map(esc).join('<br>')}</p></div></section>`);
      return;
    }
    const q = parseInt(qParam, 10);
    if (Number.isFinite(q)) session.pos = Math.min(Math.max(q - 1, 0), session.order.length - 1);
    session.view = 'card';
    renderQuiz();
  }

  function crumbs(deck) {
    return `<nav class="crumbs"><a href="#/">Courses</a><span>›</span><a href="#/c/${deck.course.slug}">${esc(deck.course.code)}</a><span>›</span><span>${esc(deck.short)} ${numLabel(deck)}</span></nav>`;
  }

  function renderQuiz() {
    const s = session;
    const d = s.deck;
    const c = d.course;
    const t = tally(d, s.answers, s.order);
    const total = s.order.length;

    const head = `
      ${crumbs(d)}
      <header class="quiz-head">
        <div>
          <div class="eyebrow">${esc(c.code)} · ${esc(d.label)} ${numLabel(d)}${d.collection ? ` · ${esc(d.collection)}` : ''}</div>
          <h1>${esc(d.title)}</h1>
        </div>
        <div class="stats">
          <div class="stat"><b>${t.done}/${total}</b><span>Done</span></div>
          <div class="stat good"><b>${t.correct}</b><span>Correct</span></div>
          <div class="stat bad"><b>${t.wrong}</b><span>Wrong</span></div>
          <div class="stat"><b>${t.acc == null ? '—' : t.acc + '%'}</b><span>Score</span></div>
        </div>
      </header>
      ${d.warnings.length ? `<div class="banner">⚠ ${d.warnings.map(esc).join('<br>')}</div>` : ''}
      <div class="segs" role="group" aria-label="Question progress">
        ${s.order.map((qi, p) => `<button class="seg ${statusOf(d, s.answers, qi)}${p === s.pos && s.view === 'card' ? ' current' : ''}" data-act="goto" data-pos="${p}" title="Question ${p + 1}" aria-label="Go to question ${p + 1}"></button>`).join('')}
      </div>`;

    const body = s.view === 'summary' ? summaryHtml(t) : cardHtml();
    setViewKeepScroll(`<section class="quiz" style="--c:${esc(c.color)}">${head}${body}</section>`);
    s.anim = null;
    saveSession();
    syncUrl();
  }

  function setViewKeepScroll(html) {
    const y = window.scrollY;
    app.innerHTML = html;
    window.scrollTo({ top: y });
  }

  function cardHtml() {
    const s = session;
    const d = s.deck;
    const qi = s.order[s.pos];
    const q = d.questions[qi];
    const st = statusOf(d, s.answers, qi);
    const picked = s.answers[qi];
    const total = s.order.length;
    const locked = st !== 'open';
    const statusLabel = { open: 'Unanswered', correct: 'Correct', wrong: 'Incorrect', revealed: 'Answer shown' }[st];

    const jump = s.order.map((i, p) => {
      const mark = { open: '○', correct: '✓', wrong: '✗', revealed: '◐' }[statusOf(d, s.answers, i)];
      return `<option value="${p}"${p === s.pos ? ' selected' : ''}>${mark}  Q${p + 1}. ${esc(clip(d.questions[i].question, 80))}</option>`;
    }).join('');

    const options = q.keys.map(k => {
      let cls = '';
      let mark = '';
      if (locked) {
        if (k === q.answer) { cls = 'correct' + (picked === k ? ' picked' : ''); mark = I.check; }
        else if (k === picked) { cls = 'wrong'; mark = I.x; }
        else cls = 'dim';
      }
      return `<button class="option ${cls}" data-act="answer" data-k="${esc(k)}"${locked ? ' disabled' : ''}>
          <span class="letter">${esc(k)}</span><span class="text">${rich(q.options[k])}</span><span class="mark">${mark}</span>
        </button>`;
    }).join('');

    let feedback = '';
    if (locked) {
      const title = st === 'correct' ? `${I.check} Correct!`
        : st === 'wrong' ? `${I.x} Not quite. The correct answer is ${esc(q.answer)}.`
        : `${I.eye} Answer: ${esc(q.answer)}`;
      feedback = `
        <div class="feedback ${st}">
          <div class="fb-title">${title}</div>
          ${q.note ? `<div class="note-label">Note</div><div class="note">${rich(q.note)}</div>` : ''}
        </div>`;
    }

    const topicSel = d.topics.length > 1 ? `
        <label class="select">
          <select data-act="topic" aria-label="Filter by subtopic">
            <option value="all"${s.topic === 'all' ? ' selected' : ''}>All subtopics (${d.questions.length})</option>
            ${d.topics.map(tp => `<option value="${esc(tp)}"${s.topic === tp ? ' selected' : ''}>${esc(tp)} (${inTopic(d, tp).length})</option>`).join('')}
          </select>
        </label>` : '';

    const isLast = s.pos === total - 1;
    return `
      <div class="toolbar">
        <div class="selects">
          ${topicSel}
          <label class="select">
            <select data-act="jump" aria-label="Jump to question">${jump}</select>
          </label>
        </div>
        <div class="tools">
          <button class="btn" data-act="shuffle" title="Shuffle question order">${I.shuffle}<span class="hide-sm">Shuffle</span></button>
          <button class="btn" data-act="restart" title="Clear answers and start over">${I.reset}<span class="hide-sm">Reset</span></button>
          <button class="btn" data-act="summary" title="See results">${I.flag}<span class="hide-sm">Results</span></button>
        </div>
      </div>
      <article class="card ${s.anim ? 'in-' + s.anim : ''}">
        <div class="card-top">
          <div class="card-top-left">
            <span class="qnum">Question ${s.pos + 1} <i>of ${total}</i></span>
            ${q.topic ? `<span class="topic-chip">${esc(q.topic)}</span>` : ''}
          </div>
          <span class="status ${st}">${statusLabel}</span>
        </div>
        <h2 class="question">${rich(q.question)}</h2>
        <div class="options">${options}</div>
        ${locked ? feedback : `
          <div class="card-actions">
            <button class="btn ghost" data-act="reveal">${I.eye} Show answer</button>
            <span class="hint"><kbd>${esc(q.keys[0])}</kbd>–<kbd>${esc(q.keys[q.keys.length - 1])}</kbd> to answer · <kbd>Space</kbd> to reveal</span>
          </div>`}
      </article>
      <div class="nav">
        <button class="btn" data-act="prev"${s.pos === 0 ? ' disabled' : ''}>${I.left} Previous</button>
        <span class="hint"><kbd>←</kbd> <kbd>→</kbd> to move</span>
        <button class="btn primary" data-act="next">${isLast ? 'See results' : 'Next'} ${I.right}</button>
      </div>`;
  }

  function summaryHtml(t) {
    const s = session;
    const d = s.deck;
    const pct = t.total ? Math.round((t.correct / t.total) * 100) : 0;
    const C = 2 * Math.PI * 54;
    const headline = pct >= 90 ? 'Outstanding!' : pct >= 70 ? 'Nice work!' : pct >= 50 ? 'Getting there' : 'Keep practising';
    const missed = s.order.filter(i => statusOf(d, s.answers, i) !== 'correct').length;

    const review = s.order.map((qi, p) => {
      const st = statusOf(d, s.answers, qi);
      return `<button class="review-item" data-act="goto" data-pos="${p}">
          <span class="dot ${st}"></span><span class="n">${p + 1}</span><span class="t">${esc(d.questions[qi].question)}</span>${I.right}
        </button>`;
    }).join('');

    // Score per subtopic, so weak areas stand out; clicking a row practises just that subtopic.
    const shownTopics = [...new Set(s.order.map(i => d.questions[i].topic).filter(Boolean))];
    const byTopic = shownTopics.length > 1 ? `
      <div class="by-topic">
        <div class="note-label">By subtopic</div>
        ${shownTopics.map(tp => {
          const idx = s.order.filter(i => d.questions[i].topic === tp);
          const tt = tally(d, s.answers, idx);
          const p = Math.round((tt.correct / idx.length) * 100);
          const color = !tt.done ? 'var(--track)' : p >= 80 ? 'var(--good)' : p >= 50 ? 'var(--warn)' : 'var(--bad)';
          return `<button class="bt-row" data-act="topicgo" data-topic="${esc(tp)}" title="Practise this subtopic">
              <span class="bt-name">${esc(tp)}</span>
              <span class="bar"><i style="width:${p}%;background:${color}"></i></span>
              <span class="bt-score">${tt.correct}/${idx.length}</span>
            </button>`;
        }).join('')}
      </div>` : '';

    return `
      <article class="card summary in-fade">
        <div class="ring">
          <svg viewBox="0 0 120 120">
            <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" style="stop-color:var(--accent)"/><stop offset="1" style="stop-color:var(--accent-2)"/>
            </linearGradient></defs>
            <circle cx="60" cy="60" r="54" fill="none" stroke="var(--track)" stroke-width="11"/>
            <circle class="arc" cx="60" cy="60" r="54" fill="none" stroke="url(#ringGrad)" stroke-width="11" stroke-linecap="round"
              stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pct / 100)).toFixed(1)}"/>
          </svg>
          <div class="pct"><b>${pct}%</b><span>${t.correct} of ${t.total}</span></div>
        </div>
        <h2>${headline}</h2>
        <p class="lead" style="margin:0 auto">${esc(d.title)}</p>
        <div class="chips">
          <span class="chip"><b style="color:var(--good)">${t.correct}</b> correct</span>
          <span class="chip"><b style="color:var(--bad)">${t.wrong}</b> wrong</span>
          <span class="chip"><b style="color:var(--warn)">${t.revealed}</b> revealed</span>
          <span class="chip"><b>${t.open}</b> skipped</span>
        </div>
        ${byTopic}
        <div class="review">${review}</div>
        <div class="sum-actions">
          ${missed && missed < t.total ? `<button class="btn primary" data-act="retry">${I.reset} Retry ${plural(missed, 'missed question')}</button>` : ''}
          <button class="btn${missed && missed < t.total ? '' : ' primary'}" data-act="restart">${I.reset} Start over</button>
          <a class="btn" href="#/c/${d.course.slug}">${I.back} Back to ${esc(d.course.code)}</a>
        </div>
      </article>`;
  }

  function syncUrl() {
    if (!session) return;
    const want = session.view === 'summary' ? `#/d/${session.deck.id}/results` : `#/d/${session.deck.id}/q/${session.pos + 1}`;
    if (location.hash !== want) history.replaceState(null, '', want);
  }

  // ---------- Actions ----------
  function go(pos, anim) {
    const s = session;
    if (pos < 0 || pos >= s.order.length) return;
    s.anim = anim || (pos > s.pos ? 'next' : pos < s.pos ? 'prev' : 'fade');
    s.pos = pos;
    s.view = 'card';
    renderQuiz();
  }

  const actions = {
    answer(k) {
      const s = session;
      const qi = s.order[s.pos];
      if (s.answers[qi] != null || !s.deck.questions[qi].options[k]) return;
      s.answers[qi] = k;
      renderQuiz();
    },
    reveal() {
      const s = session;
      const qi = s.order[s.pos];
      if (s.answers[qi] != null) return;
      s.answers[qi] = '?';
      renderQuiz();
    },
    next() {
      const s = session;
      if (s.view === 'summary') return;
      if (s.pos < s.order.length - 1) go(s.pos + 1);
      else actions.summary();
    },
    prev() {
      const s = session;
      if (s.view === 'summary') { go(s.order.length - 1, 'fade'); return; }
      go(s.pos - 1);
    },
    summary() { session.view = 'summary'; renderQuiz(); },
    goto(p) { go(parseInt(p, 10), 'fade'); },
    shuffle() {
      const o = session.order;
      for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
      session.pos = 0;
      session.view = 'card';
      session.anim = 'fade';
      renderQuiz();
      toast('Questions shuffled');
    },
    restart() {
      // Clears answers within the current subtopic filter (the whole deck when "All subtopics").
      const s = session;
      s.order = inTopic(s.deck, s.topic);
      s.order.forEach(i => { delete s.answers[i]; });
      s.pos = 0;
      s.view = 'card';
      s.anim = 'fade';
      renderQuiz();
    },
    topic(tp) {
      const s = session;
      s.topic = tp === 'all' || s.deck.topics.includes(tp) ? tp : 'all';
      s.order = inTopic(s.deck, s.topic);
      s.pos = 0;
      s.view = 'card';
      s.anim = 'fade';
      renderQuiz();
      window.scrollTo({ top: 0 });
    },
    retry() {
      const s = session;
      const missed = s.order.filter(i => statusOf(s.deck, s.answers, i) !== 'correct');
      missed.forEach(i => { delete s.answers[i]; });
      s.order = missed;
      s.pos = 0;
      s.view = 'card';
      s.anim = 'fade';
      renderQuiz();
      toast(`Retrying ${plural(missed.length, 'question')}. Use Reset to bring back the full deck.`);
    }
  };

  app.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || !session || el.tagName === 'SELECT') return;
    const act = el.dataset.act;
    if (act === 'answer') actions.answer(el.dataset.k);
    else if (act === 'goto') actions.goto(el.dataset.pos);
    else if (act === 'topicgo') actions.topic(el.dataset.topic);
    else if (actions[act]) actions[act]();
  });

  app.addEventListener('change', e => {
    if (!session) return;
    if (e.target.matches('select[data-act="jump"]')) go(parseInt(e.target.value, 10), 'fade');
    else if (e.target.matches('select[data-act="topic"]')) actions.topic(e.target.value);
  });

  document.addEventListener('keydown', e => {
    if (!session || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest('select, input, textarea')) return;
    const onButton = e.target.closest('button, a');
    const key = e.key;
    if (key === 'ArrowRight') { e.preventDefault(); actions.next(); return; }
    if (key === 'ArrowLeft') { e.preventDefault(); actions.prev(); return; }
    if (session.view !== 'card') return;
    const q = session.deck.questions[session.order[session.pos]];
    const open = session.answers[session.order[session.pos]] == null;
    if ((key === ' ' || key === 'Enter') && !onButton) {
      e.preventDefault();
      if (open) actions.reveal(); else actions.next();
      return;
    }
    if (!open) return;
    const up = key.toUpperCase();
    if (q.keys.includes(up)) { actions.answer(up); return; }
    const n = parseInt(key, 10);
    if (n >= 1 && n <= q.keys.length) actions.answer(q.keys[n - 1]);
  });

  // ---------- Deck file preview ----------
  const fileInput = $('#deckFile');
  $('#loadDeckBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    fileInput.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!raw) { raw = window.FLASHCARDS = { courses: {}, decks: [] }; loadData(); }
      const d = addDeck(data, f.name, true);
      session = null;
      toast(d.warnings.length ? `Loaded with ${plural(d.warnings.length, 'warning')}. See the banner.` : `Loaded "${d.title}" (${plural(d.questions.length, 'question')}). Preview only, not saved.`);
      location.hash = `#/d/${d.id}`;
      route();
    } catch (err) {
      toast(`Couldn't read that file: ${err.message}`, 'bad');
    }
  });

  // ---------- Theme ----------
  const themeBtn = $('#themeBtn');
  const darkMq = window.matchMedia('(prefers-color-scheme: dark)');
  const currentTheme = () => document.documentElement.dataset.theme || (darkMq.matches ? 'dark' : 'light');
  function paintThemeBtn() { themeBtn.innerHTML = currentTheme() === 'dark' ? I.sun : I.moon; }
  themeBtn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('fc:theme', next);
    paintThemeBtn();
  });
  darkMq.addEventListener?.('change', paintThemeBtn);
  paintThemeBtn();

  // ---------- Router ----------
  function route() {
    if (!window.FLASHCARDS) { renderMissing(); return; }
    const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean).map(decodeURIComponent);
    if (parts[0] === 'c' && parts[1]) renderCourse(parts[1]);
    else if (parts[0] === 'd' && parts[1]) {
      renderDeck(parts[1], parts[2] === 'q' ? parts[3] : undefined);
      if (parts[2] === 'results' && session && session.deck.questions.length) actions.summary();
    }
    else renderHome();
  }

  window.addEventListener('hashchange', route);
  if (raw) loadData();
  route();
})();
