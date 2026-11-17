/* Экономическая теория — Telegram Mini App. Всё работает в браузере, без сервера и без ключей. */
(function () {
  const D = window.DATA, P = window.Problems;
  const tg = window.Telegram && window.Telegram.WebApp;
  const $app = document.getElementById('app');
  const $nav = document.getElementById('nav');

  // ---------------------------------------------------------------- утилиты
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nl = (s) => esc(s).replace(/\n/g, '<br>');
  const img = (n) => `img/${n}`;
  const mascot = (n, cls = '') => `<img class="mascot ${cls}" src="${img('mascot_' + n + '.webp')}" alt="Эко">`;
  const haptic = (t) => { try { tg && tg.HapticFeedback && (t === 'ok' ? tg.HapticFeedback.notificationOccurred('success') : t === 'bad' ? tg.HapticFeedback.notificationOccurred('error') : tg.HapticFeedback.selectionChanged()); } catch (e) {} };

  // ---------------------------------------------------------------- прогресс (в телефоне, а в Telegram ещё и в облаке)
  const LEVELS = [[0, 'Новичок'], [50, 'Студент'], [150, 'Практик'], [350, 'Знаток'], [700, 'Эксперт'], [1200, 'Профессор']];
  const KEY = 'eco_progress_v1';
  let S = { xp: 0, streak: 0, last: '', solved: 0, exam: {}, lessons: {}, topics: {} };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  try {
    if (tg && tg.CloudStorage) tg.CloudStorage.getItem(KEY, (err, v) => {
      if (err || !v) return;
      try { const c = JSON.parse(v); if ((c.xp || 0) > S.xp) { Object.assign(S, c); localStorage.setItem(KEY, JSON.stringify(S)); render(); } } catch (e) {}
    });
  } catch (e) {}
  function save() {
    const raw = JSON.stringify(S);
    try { localStorage.setItem(KEY, raw); } catch (e) {}
    try { tg && tg.CloudStorage && tg.CloudStorage.setItem(KEY, raw); } catch (e) {}
  }
  const level = (xp) => LEVELS.filter((l) => xp >= l[0]).pop();
  const nextLevel = (xp) => LEVELS.find((l) => l[0] > xp);
  function today() { return new Date().toISOString().slice(0, 10); }
  function addXp(n) {
    const before = level(S.xp)[1];
    S.xp += n;
    const t = today();
    if (S.last !== t) {
      const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      S.streak = S.last === y ? S.streak + 1 : 1;
      S.last = t;
    }
    save();
    const after = level(S.xp)[1];
    toast(`+${n} XP` + (after !== before ? ` · новый уровень: ${after}!` : ''));
    return after !== before;
  }
  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2200);
  }

  // ---------------------------------------------------------------- поиск по материалам (BM25, как в боте)
  const STOP = new Set(('и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет о из ему теперь когда даже ну вдруг ли если уже или ни быть был него до вас нибудь опять уж вам ведь там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда кто этот того потому этого какой совсем ним здесь этом один почти мой тем чтобы нее сейчас были куда зачем всех никогда можно при наконец два об другой хоть после над больше тот через эти нас про всего них какая много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя такой им более всегда конечно всю между такое это как считать посчитать решить найти задача задачу расскажи объясни что такое').split(' '));
  const stem = (w) => (w.length > 5 ? w.slice(0, 5) : w);
  const tokens = (t) => (t.toLowerCase().replace(/ё/g, 'е').match(/[a-zа-я0-9]+/g) || []).filter((w) => !STOP.has(w) && w.length > 1).map(stem);
  const idx = { tf: [], idf: {}, avg: 1 };
  (function build() {
    const df = {};
    D.KB.forEach((d) => {
      const c = {};
      tokens(d[2]).concat(tokens(D.KBTOPICS[d[0]])).forEach((t) => { c[t] = (c[t] || 0) + 1; });
      idx.tf.push(c);
      Object.keys(c).forEach((t) => { df[t] = (df[t] || 0) + 1; });
    });
    const n = D.KB.length;
    Object.keys(df).forEach((t) => { idx.idf[t] = Math.log(1 + (n - df[t] + 0.5) / (df[t] + 0.5)); });
    idx.avg = idx.tf.reduce((a, c) => a + Object.values(c).reduce((x, y) => x + y, 0), 0) / n;
  })();
  function search(q, k = 6) {
    const qt = tokens(q);
    if (!qt.length) return [];
    const out = [];
    D.KB.forEach((d, i) => {
      if (d[3]) return; // слайды-задания не используем для теории
      const c = idx.tf[i], ln = Object.values(c).reduce((a, b) => a + b, 0);
      let s = 0;
      qt.forEach((t) => { const f = c[t] || 0; if (f) s += (idx.idf[t] || 0) * f * 2.2 / (f + 1.2 * (0.25 + 0.75 * ln / idx.avg)); });
      if (s > 0) out.push({ s, topic: D.KBTOPICS[d[0]], slide: d[1], text: d[2] });
    });
    out.sort((a, b) => b.s - a.s);
    return out.slice(0, k);
  }
  function where(q) {
    const hits = search(q, 8), by = {};
    hits.forEach((h) => { (by[h.topic] = by[h.topic] || []).push(h.slide); });
    return { list: Object.entries(by).slice(0, 3).map(([t, s]) => [t, [...new Set(s)].sort((a, b) => a - b).slice(0, 4)]), hits: hits.slice(0, 3) };
  }
  const topicByKb = (kb) => D.TOPICS.find((t) => t.kb === kb);
  function topicFor(q) {
    const votes = {};
    search(q, 6).forEach((h) => { votes[h.topic] = (votes[h.topic] || 0) + h.s; });
    const best = Object.keys(votes).sort((a, b) => votes[b] - votes[a])[0];
    return best ? topicByKb(best) : null;
  }
  function guessKind(q) {
    const ql = q.toLowerCase().replace(/ё/g, 'е');
    for (const [words, kind] of D.KINDS) if (words.some((w) => ql.includes(w))) return kind;
    return null;
  }
  const clip = (t, n = 450) => { t = t.replace(/\n+/g, '\n').trim(); return t.length <= n ? t : t.slice(0, n).replace(/\s\S*$/, '') + '…'; };

  // ---------------------------------------------------------------- маршрутизация
  const state = { route: location.hash.slice(1) || 'home', ctx: {} };
  function go(route, ctx) { state.route = route; state.ctx = ctx || {}; history.replaceState(null, '', '#' + route); render(); window.scrollTo(0, 0); }
  window.go = go;
  const TABS = [['home', '🏠', 'Главная'], ['cons', '📚', 'Конспекты'], ['exam', '🎓', 'Экзамен'], ['tasks', '🧮', 'Задачи'], ['lessons', '🎬', 'Уроки']];
  const tabOf = (r) => (r.startsWith('cons') ? 'cons' : r.startsWith('exam') ? 'exam' : r.startsWith('task') ? 'tasks' : r.startsWith('less') ? 'lessons' : 'home');

  function render() {
    const r = state.route;
    $nav.innerHTML = TABS.map(([id, ic, t]) => `<button class="${tabOf(r) === id ? 'on' : ''}" onclick="go('${id}')"><span>${ic}</span>${t}</button>`).join('');
    const deep = ['cons:', 'exam:', 'task:', 'less:', 'ask'].some((p) => r.startsWith(p));
    try { if (tg) { deep ? tg.BackButton.show() : tg.BackButton.hide(); } } catch (e) {}
    const views = { home: vHome, cons: vConsList, exam: vExamList, tasks: vTaskMenu, lessons: vLessonList, ask: vAsk };
    if (views[r]) $app.innerHTML = views[r]();
    else if (r.startsWith('cons:')) $app.innerHTML = vCons(r.slice(5));
    else if (r.startsWith('exam:')) $app.innerHTML = vExam(+r.slice(5));
    else if (r.startsWith('task:')) $app.innerHTML = vTask();
    else if (r.startsWith('less:')) $app.innerHTML = vLesson(r.slice(5));
    else $app.innerHTML = vHome();
    afterRender();
  }
  // Apple-эмодзи на любом телефоне (картинки с CDN; если не загрузились, остаётся родной смайлик)
  const EMO = /\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier}|\u200D\p{Extended_Pictographic}\uFE0F?)*\uFE0F?/gu;
  const CDN = 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64/';
  function appleEmoji(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
    while (walker.nextNode()) { if (EMO.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode); EMO.lastIndex = 0; }
    nodes.forEach((n) => {
      const frag = document.createDocumentFragment(), s = n.nodeValue;
      let last = 0, m;
      EMO.lastIndex = 0;
      while ((m = EMO.exec(s))) {
        frag.appendChild(document.createTextNode(s.slice(last, m.index)));
        const ch = m[0], cps = [...ch].map((c) => c.codePointAt(0).toString(16));
        const full = cps.join('-'), bare = cps.filter((c) => c !== 'fe0f').join('-');
        const im = new Image();
        im.className = 'emo'; im.alt = ch; im.draggable = false;
        im.onerror = () => { if (im.dataset.t !== '1' && bare !== full) { im.dataset.t = '1'; im.src = CDN + bare + '.png'; } else im.replaceWith(document.createTextNode(ch)); };
        im.src = CDN + full + '.png';
        frag.appendChild(im);
        last = m.index + ch.length;
      }
      frag.appendChild(document.createTextNode(s.slice(last)));
      n.replaceWith(frag);
    });
  }
  function afterRender() {
    appleEmoji($app); appleEmoji($nav);
    const el = document.getElementById('q'); // фокус не забираем автоматически, чтобы не прыгала клавиатура
    if (el && state.ctx.refocus) el.focus();
  }
  function back() {
    const r = state.route;
    go(r.startsWith('cons:') ? 'cons' : r.startsWith('exam:') ? 'exam' : r.startsWith('task:') ? 'tasks' : r.startsWith('less:') ? 'lessons' : 'home');
  }

  // ---------------------------------------------------------------- главная
  function vHome() {
    const lv = level(S.xp), nx = nextLevel(S.xp);
    const pct = nx ? Math.round(((S.xp - lv[0]) / (nx[0] - lv[0])) * 100) : 100;
    const name = tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user.first_name : '';
    return `
    <section class="hero">
      ${mascot('hello', 'hero-m')}
      <div><h1>Привет${name ? ', ' + esc(name) : ''}!</h1><p>Я Эко, ёжик-репетитор. Не выдаю ответы, а помогаю дойти до них самому.</p></div>
    </section>
    <section class="card stat">
      <div class="row"><b>${lv[1]}</b><span>${S.xp} XP${nx ? ' · до «' + nx[1] + '» ' + (nx[0] - S.xp) : ''}</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="chips"><span>🔥 серия: ${S.streak || 0}</span><span>✅ задач: ${S.solved || 0}</span><span>🎓 вопросов: ${Object.keys(S.exam).length}/${D.EXAMQ.length}</span></div>
    </section>
    <form class="card ask" onsubmit="event.preventDefault();askGo()">
      <h3>Спроси Эко 💬</h3>
      <div class="inline"><input id="q" placeholder="Например: что такое эластичность спроса?" autocomplete="off"><button class="btn">→</button></div>
      <small>Эко подскажет, где искать, что говорит теория и покажет похожий пример.</small>
    </form>
    <div class="grid">
      <button class="tile t1" onclick="go('tasks')"><b>🧮 Задачи</b><span>с лесенкой подсказок</span></button>
      <button class="tile t2" onclick="go('exam')"><b>🎓 Экзамен</b><span>как отвечать на 67 вопросов</span></button>
      <button class="tile t3" onclick="go('cons')"><b>📚 Конспекты</b><span>коротко и для чайников</span></button>
      <button class="tile t4" onclick="go('lessons')"><b>🎬 Мини-уроки</b><span>с анимацией и тестом</span></button>
    </div>`;
  }
  window.askGo = function () {
    const q = document.getElementById('q').value.trim();
    if (!q) return;
    go('ask', { q, level: 1 });
  };

  // ---------------------------------------------------------------- спроси Эко (лесенка по вопросу)
  function ladder(q, lvl) {
    const w = where(q);
    if (!w.hits.length) return null;
    if (lvl === 1) return `<b>💡 Подсказка 1: где искать</b><ul>${w.list.map(([t, s]) => `<li>«${esc(t)}», слайды ${s.join(', ')}</li>`).join('')}</ul><p>Спроси себя: что в вопросе известно, что нужно найти и о каком понятии речь?</p>`;
    if (lvl === 2) {
      const h = w.hits[0], t = topicFor(q);
      return `<b>💡 Подсказка 2: что говорит теория</b> <small>(слайд ${h.slide}, «${esc(h.topic)}»)</small><p>${nl(clip(h.text, 500))}</p>` +
        (t && t.formulas.length ? `<div class="formulas">${t.formulas.map((x) => `<code>${esc(x)}</code>`).join('')}</div>` : '');
    }
    const kind = guessKind(q);
    if (kind) {
      const p = P.make(kind, Math.abs(q.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 1e6);
      return `<b>💡 Подсказка 3: разбор ПОХОЖЕЙ задачи</b> <small>(числа другие, ход тот же)</small><p class="quote">${nl(p.text)}</p><p class="solution">${nl(p.solution)}</p><p>Теперь повтори этот ход со своими числами.</p>`;
    }
    const t = topicFor(q);
    return t ? `<b>💡 Подсказка 3: конспект темы</b>${consBody(t)}` : null;
  }
  function vAsk() {
    const { q, level: lv } = state.ctx;
    if (!q) return vHome();
    const steps = [];
    for (let i = 1; i <= lv; i++) { const h = ladder(q, i); if (h) steps.push(`<div class="card hint">${h}</div>`); }
    const none = !steps.length ? `<div class="card"><p>В материалах курса ничего похожего не нашлось. Попробуй переформулировать вопрос другими словами или загляни в <a onclick="go('cons')">конспекты</a>.</p></div>` : '';
    return `${back_()}<div class="bubble me">${esc(q)}</div><div class="row-m">${mascot(lv >= 2 ? 'bulb' : 'think', 'sm')}<div class="grow">${steps.join('') || none}</div></div>` +
      (steps.length && lv < 3 ? `<button class="btn wide" onclick="state_.ctx.level++;go('ask',state_.ctx)">Ещё подсказка (${lv + 1}/3)</button>` : '') +
      `<form class="card ask" onsubmit="event.preventDefault();askGo()"><div class="inline"><input id="q" placeholder="Другой вопрос…"><button class="btn">→</button></div></form>`;
  }
  window.state_ = state;
  const back_ = () => `<button class="back" onclick="backGo()">← Назад</button>`;
  window.backGo = back;

  // ---------------------------------------------------------------- конспекты
  function vConsList() {
    return `<h2>📚 Конспекты для чайников</h2><div class="list">${D.TOPICS.map((t, i) => `<button class="item" onclick="go('cons:${t.id}')"><em>${i + 1}</em><span>${esc(t.title)}</span><i>›</i></button>`).join('')}</div>`;
  }
  function consBody(t) {
    return `<p class="simple">💡 ${esc(t.simple)}</p><ul>${t.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` +
      (t.formulas.length ? `<h4>🧮 Формулы</h4><div class="formulas">${t.formulas.map((x) => `<code>${esc(x)}</code>`).join('')}</div>` : '') +
      `<div class="note ex"><b>🌍 Пример</b><br>${esc(t.example)}</div><div class="note warn"><b>⚠️ Частая ошибка</b><br>${esc(t.mistake)}</div>`;
  }
  function vConsReal(id) {
    const t = D.TOPICS.find((x) => x.id === id);
    if (!t) return vConsList();
    if (!S.topics[id]) { S.topics[id] = 1; save(); }
    const tasks = Object.keys(P.GEN).length;
    return `${back_()}<h2>${esc(t.title)}</h2><div class="card">${consBody(t)}</div>
      <small class="muted">Подробнее в презентации курса: «${esc(t.kb)}».</small>`;
  }
  window.vCons = vConsReal;

  // ---------------------------------------------------------------- экзамен
  function vExamList() {
    const qf = (state.ctx.f || '').toLowerCase();
    const items = D.EXAMQ.map((q, i) => [i + 1, q]).filter(([, q]) => !qf || q.toLowerCase().includes(qf));
    return `<h2>🎓 Подготовка к экзамену</h2>
      <input class="search" id="ef" placeholder="Найти вопрос по слову…" value="${esc(state.ctx.f || '')}" oninput="examFilter(this.value)">
      <div class="list" id="elist">${items.map(([n, q]) => examItem(n, q)).join('') || '<p class="muted">Ничего не найдено.</p>'}</div>`;
  }
  const examItem = (n, q) => `<button class="item" onclick="go('exam:${n}')"><em class="${S.exam[n] ? 'done' : ''}">${S.exam[n] ? '✓' : n}</em><span>${esc(q)}</span><i>›</i></button>`;
  window.examFilter = function (v) {
    state.ctx.f = v;
    const qf = v.toLowerCase();
    document.getElementById('elist').innerHTML = D.EXAMQ.map((q, i) => [i + 1, q]).filter(([, q]) => !qf || q.toLowerCase().includes(qf)).map(([n, q]) => examItem(n, q)).join('') || '<p class="muted">Ничего не найдено.</p>';
  };
  function vExam(n) {
    const plan = D.PLANS[n];
    if (!plan) return vExamList();
    const [tid, pts, ex] = plan, t = D.TOPICS.find((x) => x.id === tid);
    const res = state.ctx.res;
    return `${back_()}<h2>Вопрос ${n}</h2><p class="q">${esc(D.EXAMQ[n - 1])}</p>
      <div class="card"><h4>Как строить ответ</h4><ol>${pts.map((p, i) => `<li class="${res ? (res.missed.includes(p) ? 'miss' : 'hit') : ''}">${esc(p)}</li>`).join('')}</ol>
      <div class="note ex"><b>💬 Пример / фишка</b><br>${esc(ex)}</div>
      ${t ? `<button class="btn ghost" onclick="go('cons:${t.id}')">📚 Конспект: ${esc(t.title)}</button>` : ''}</div>
      <div class="card"><h4>Проверь себя</h4><small>Напиши свой ответ своими словами. Эко посмотрит, какие пункты плана ты раскрыл.</small>
      <textarea id="ea" rows="5" placeholder="Твой ответ…">${esc(state.ctx.ans || '')}</textarea>
      <button class="btn wide" onclick="examCheck(${n})">Проверить</button>
      ${res ? `<div class="result ${res.ok ? 'good' : ''}">${mascot(res.ok ? 'happy' : 'think', 'sm')}<div>${res.ok ? 'Отлично, основные пункты раскрыты!' : 'Есть что добавить.'} Раскрыто ${res.hit} из ${pts.length}. ${res.missed.length ? 'Пропущенные пункты подсвечены в плане выше.' : ''}</div></div>` : ''}</div>`;
  }
  window.examCheck = function (n) {
    const ans = document.getElementById('ea').value.trim();
    if (ans.length < 15) { toast('Напиши ответ подлиннее'); return; }
    const at = new Set(tokens(ans)), pts = D.PLANS[n][1], missed = [];
    let hit = 0;
    pts.forEach((p) => {
      const pt = [...new Set(tokens(p))].filter((t) => t.length > 2);
      const share = pt.length ? pt.filter((t) => at.has(t)).length / pt.length : 1;
      if (share >= 0.3) hit++; else missed.push(p);
    });
    const ok = hit / pts.length >= 0.7;
    if (ok && !S.exam[n]) { S.exam[n] = 1; save(); addXp(5); haptic('ok'); } else haptic(ok ? 'ok' : 'bad');
    state.ctx = { ans, res: { ok, hit, missed } };
    render();
  };

  // ---------------------------------------------------------------- задачи
  const T = { p: null, hints: 0, wrong: 0, done: false, msg: '', shown: [] };
  function vTaskMenu() {
    const titles = {};
    P.KINDS.forEach((k) => { titles[k] = P.GEN[k](P.rng(1)).title; });
    return `<h2>🧮 Задачи</h2><p class="muted">Как на семинарах, но с другими числами каждый раз. Подсказки идут лесенкой, готовый ответ открывается после двух ошибок или трёх подсказок.</p>
      <button class="btn wide" onclick="newTask()">🎲 Случайная задача</button>
      <div class="list">${P.KINDS.map((k) => `<button class="item" onclick="newTask('${k}')"><span>${esc(titles[k])}</span><i>›</i></button>`).join('')}</div>`;
  }
  window.newTask = function (kind) {
    T.p = P.make(kind || null); T.hints = 0; T.wrong = 0; T.done = false; T.msg = ''; T.shown = []; T.mood = 'think';
    go('task:' + T.p.kind);
  };
  function vTask() {
    const p = T.p;
    if (!p) return vTaskMenu();
    const w = where(p.search);
    const hintBlocks = [];
    if (T.hints >= 1) hintBlocks.push(`<b>💡 Подсказка 1</b><p>${esc(p.idea)}</p>` + (w.list.length ? `<p>Где посмотреть: ${w.list.map(([t, s]) => `«${esc(t)}», слайды ${s.join(', ')}`).join('; ')}.</p>` : ''));
    if (T.hints >= 2) hintBlocks.push(`<b>💡 Подсказка 2</b><div class="formulas"><code>${esc(p.formula)}</code></div>`);
    if (T.hints >= 3) { const s = P.similar(p); hintBlocks.push(`<b>💡 Подсказка 3: разбор похожей задачи</b><p class="quote">${nl(s.text)}</p><p class="solution">${nl(s.solution)}</p><p>Повтори этот ход со своими числами.</p>`); }
    const canReveal = T.wrong >= 2 || T.hints >= 3;
    const mood = T.done ? 'cheer' : T.msgMood || (T.hints >= 2 ? 'bulb' : 'think');
    return `${back_()}<small class="muted">${esc(p.title)}</small>
      <div class="card task">${nl(p.text)}</div>
      ${hintBlocks.map((h) => `<div class="card hint">${h}</div>`).join('')}
      ${T.msg ? `<div class="row-m">${mascot(mood, 'sm')}<div class="card grow msg ${T.done ? 'good' : ''}">${T.msg}</div></div>` : ''}
      ${T.done ? `<div class="card good"><b>Разбор</b><p class="solution">${nl(p.solution)}</p></div>
        <button class="btn wide" onclick="newTask('${p.kind}')">Ещё такую же, другие числа</button><button class="btn ghost wide" onclick="go('tasks')">Другой тип задачи</button>` : `
      <form class="card ask" onsubmit="event.preventDefault();taskCheck()">
        <div class="inline"><input id="ans" inputmode="text" placeholder="${p.answers.length > 1 ? 'Ответы через пробел или запятую: ' + p.answers.map((a) => a[0]).join(', ') : 'Твой ответ (число)'}" autocomplete="off"><button class="btn">ОК</button></div>
        <small>${p.answers.length > 1 ? 'Нужно ' + p.answers.length + ' числа: ' + esc(p.answers.map((a) => a[0]).join(', ')) : 'Число можно писать с запятой.'}</small>
      </form>
      <div class="two"><button class="btn ghost" ${T.hints >= 3 ? 'disabled' : ''} onclick="taskHint()">💡 Подсказка (${Math.min(T.hints + 1, 3)}/3)</button>
      <button class="btn ghost" ${canReveal ? '' : 'disabled'} onclick="taskReveal()">${canReveal ? '👀 Показать решение' : '🔒 Решение закрыто'}</button></div>`}`;
  }
  window.taskHint = function () { if (T.hints < 3) { T.hints++; T.msg = ''; haptic(); render(); } };
  window.taskReveal = function () { T.done = true; T.msg = 'Вот решение. Попробуй потом такую же с новыми числами, уже сам.'; T.msgMood = 'oops'; render(); };
  window.taskCheck = function () {
    const v = document.getElementById('ans').value;
    if (!v.trim()) return;
    const r = P.check(T.p, v);
    if (r.ok) {
      const xp = Math.max(3, 10 - 3 * T.hints - 2 * T.wrong);
      T.done = true; T.msgMood = 'cheer'; S.solved = (S.solved || 0) + 1; haptic('ok');
      const up = addXp(xp);
      T.msg = `Верно! 🎉 ${r.found.length > 1 ? 'Все значения совпали. ' : ''}Заработано ${xp} XP${up ? ' и новый уровень' : ''}.`;
    } else {
      T.wrong++; haptic('bad'); T.msgMood = 'oops';
      const got = r.found.length ? `Верно: ${r.found.join(', ')}. ` : '';
      T.msg = `${got}Пока не сходится: ${r.missing.join(', ')}. ${r.hint || 'Проверь ход вычислений или возьми подсказку.'}` + (T.wrong >= 2 ? '<br><small>Теперь можно открыть решение.</small>' : '');
    }
    render();
  };

  // ---------------------------------------------------------------- мини-уроки
  function vLessonList() {
    return `<h2>🎬 Мини-уроки</h2><div class="list">${D.LESSONS.map((l) => `<button class="item" onclick="startLesson('${l.id}')"><em>${l.emoji}</em><span>${esc(l.title)}${S.lessons[l.id] ? ' ✓' : ''}</span><i>›</i></button>`).join('')}</div>`;
  }
  const L = { step: 0, picked: null };
  window.startLesson = function (id) { L.step = 0; L.picked = null; go('less:' + id); };
  function vLesson(id) {
    const l = D.LESSONS.find((x) => x.id === id);
    if (!l) return vLessonList();
    const n = l.steps.length, inQuiz = L.step >= n;
    const dots = `<div class="dots">${Array.from({ length: n + 1 }, (_, i) => `<i class="${i <= L.step ? 'on' : ''}"></i>`).join('')}</div>`;
    if (!inQuiz) {
      const [text, im] = l.steps[L.step];
      return `${back_()}<h2>${l.emoji} ${esc(l.title)}</h2>${dots}
        <div class="card step">${im ? `<img class="pic" src="${img(im)}" alt="">` : ''}<p>${esc(text)}</p></div>
        <button class="btn wide" onclick="L_.step++;render_()">${L.step === n - 1 ? 'К мини-тесту →' : 'Дальше →'}</button>`;
    }
    const [qq, opts, ok, why] = l.quiz;
    const picked = L.picked;
    return `${back_()}<h2>${l.emoji} Мини-тест</h2>${dots}<div class="card"><p class="q">${esc(qq)}</p>
      ${opts.map((o, i) => `<button class="opt ${picked != null ? (i === ok ? 'right' : i === picked ? 'wrong' : '') : ''}" ${picked != null ? 'disabled' : ''} onclick="quizPick('${l.id}',${i})">${esc(o)}</button>`).join('')}
      ${picked != null ? `<div class="row-m">${mascot(picked === ok ? 'happy' : 'oops', 'sm')}<div class="grow"><b>${picked === ok ? 'Верно!' : 'Не совсем.'}</b> ${esc(why)}</div></div>` : ''}</div>
      ${picked != null ? `<button class="btn wide" onclick="go('lessons')">К урокам</button>` : ''}`;
  }
  window.L_ = L; window.render_ = () => render();
  window.quizPick = function (id, i) {
    const l = D.LESSONS.find((x) => x.id === id);
    L.picked = i;
    if (i === l.quiz[2]) { haptic('ok'); if (!S.lessons[id]) { S.lessons[id] = 1; save(); addXp(5); } } else haptic('bad');
    render();
  };

  // ---------------------------------------------------------------- Telegram
  try {
    if (tg) {
      tg.ready(); tg.expand();
      tg.BackButton.onClick(back);
      document.documentElement.dataset.scheme = tg.colorScheme || 'light';
      try { tg.setHeaderColor && tg.setHeaderColor('secondary_bg_color'); } catch (e) {}
    }
  } catch (e) {}
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== state.route) { state.route = h; render(); } });
  render();
})();
