/* Hook, turn and land — timings, trim, and the kinetic stage.
   Plain code: caption cues are the clip's own words, laid across its window
   by length. No model, no paraphrase. Remotion is not a dependency here, so
   the stage is CSS/JS in the same treatments as the learner slides
   (Kinetic, Windows, Conversation, Cinema, Unfold). */
(function (root) {
  'use strict';

  var ROLES = ['hook', 'turn', 'land'];
  var FILE_LEN = { 'local-mikaeel': 17.7 };
  var STORE = 'hudhud.htl.v1';
  var memory = {};

  var STYLES = [
    { id: 'kinetic', name: 'Kinetic' },
    { id: 'windows', name: 'Windows' },
    { id: 'conversation', name: 'Conversation' },
    { id: 'cinema', name: 'Cinema' },
    { id: 'unfold', name: 'Unfold' }
  ];
  var BACKGROUNDS = [
    { id: 'blur', name: 'Blurred frame' },
    { id: 'mask', name: 'Mask' },
    { id: 'solid', name: 'Solid' },
    { id: 'gradient', name: 'Gradient' }
  ];
  var MASKS = [
    { id: 'arch', name: 'Arch' },
    { id: 'circle', name: 'Circle' },
    { id: 'diamond', name: 'Diamond' },
    { id: 'window', name: 'Window' }
  ];
  var SOLIDS = [
    { id: 'ground', name: 'Ground' },
    { id: 'night', name: 'Night' },
    { id: 'plum', name: 'Plum' },
    { id: 'cream', name: 'Cream' }
  ];
  var GRADIENTS = [
    { id: 'dusk', name: 'Dusk' },
    { id: 'oasis', name: 'Oasis' },
    { id: 'nightgold', name: 'Night gold' }
  ];

  function round1(n) { return Math.round(n * 10) / 10; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function normalize(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  }

  function wordCount(s) {
    var m = normalize(s).match(/\S+/g);
    return m ? m.length : 0;
  }

  function wordsOf(s) {
    var m = normalize(s).match(/\S+/g);
    return m || [];
  }

  function clipLen(clip) {
    if (clip && FILE_LEN[clip.id]) return FILE_LEN[clip.id];
    var n = clip && Number(clip.len);
    return n > 0 ? n : 18;
  }

  function span(clip) {
    var len = clipLen(clip);
    return { start: 0, end: len, len: len };
  }

  /* A run-on with no punctuation still has to become caption cues.
     Chunks stay on word boundaries, about 16 words, never a paraphrase. */
  function chunkLong(bit) {
    var ws = wordsOf(bit);
    if (ws.length <= 30) return [normalize(bit)];
    var out = [];
    var i = 0;
    while (i < ws.length) {
      var rest = ws.length - i;
      if (rest <= 25) { out.push(ws.slice(i).join(' ')); break; }
      var take = 16;
      if (rest - take < 8) take = Math.max(8, rest - 8);
      out.push(ws.slice(i, i + take).join(' '));
      i += take;
    }
    return out;
  }

  /* Sentence ends keep their punctuation. A line over ~30 words is also cut
     on a comma, semicolon, or dash — still a verbatim slice of the field. */
  function splitSentences(text) {
    var raw = normalize(text);
    if (!raw) return [];
    var bits = [];
    var cur = '';
    for (var i = 0; i < raw.length; i++) {
      var ch = raw.charAt(i);
      cur += ch;
      if (/[.!?…]/.test(ch) && (i === raw.length - 1 || /\s/.test(raw.charAt(i + 1)))) {
        if (cur.trim()) bits.push(cur.trim());
        cur = '';
        while (i + 1 < raw.length && /\s/.test(raw.charAt(i + 1))) i++;
      }
    }
    if (cur.trim()) bits.push(cur.trim());
    var out = [];
    bits.forEach(function (bit) {
      var clauses = [bit];
      if (wordCount(bit) > 30) {
        var split = bit.split(/\s*(?:;|—|--)\s*|\s*,\s+/).map(function (s) { return s.trim(); }).filter(Boolean);
        if (split.length > 1) clauses = split;
      }
      clauses.forEach(function (c) { chunkLong(c).forEach(function (piece) { out.push(piece); }); });
    });
    return out;
  }

  function timeWords(text, t0, t1) {
    var ws = wordsOf(text);
    var spanT = Math.max(0.1, t1 - t0);
    var weights = ws.map(function (w) { return Math.max(1, w.length); });
    var total = weights.reduce(function (a, b) { return a + b; }, 0) || 1;
    var t = t0;
    return ws.map(function (w, i) {
      var d = spanT * (weights[i] / total);
      var o = { w: w, t0: round1(t), t1: round1(Math.min(t1, t + d)) };
      t += d;
      return o;
    });
  }

  /* One cue per verbatim sentence, in hook → turn → land order, filling the window. */
  function captions(clip) {
    var len = clipLen(clip);
    var pieces = [];
    ROLES.forEach(function (role) {
      splitSentences(clip && clip[role]).forEach(function (text) {
        pieces.push({ role: role, text: text });
      });
    });
    if (!pieces.length) return [];
    var weights = pieces.map(function (p) { return Math.max(1, wordCount(p.text)); });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var gap = pieces.length > 1 ? Math.min(0.25, len / (pieces.length * 10)) : 0;
    var usable = Math.max(0.4, len - gap * (pieces.length - 1));
    var t = 0;
    return pieces.map(function (p, i) {
      var dur = Math.max(0.3, usable * (weights[i] / total));
      var start = t;
      var end = Math.min(len, t + dur);
      if (i === pieces.length - 1) end = len;
      t = end + gap;
      return {
        role: p.role,
        text: p.text,
        t0: round1(start),
        t1: round1(end),
        words: timeWords(p.text, start, end)
      };
    });
  }

  function storageGet() {
    try {
      if (typeof localStorage !== 'undefined') {
        return JSON.parse(localStorage.getItem(STORE) || '{}') || {};
      }
    } catch (e) {}
    return memory;
  }
  function storageSet(all) {
    memory = all;
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORE, JSON.stringify(all));
    } catch (e) {}
  }

  function styleFromTreatment(t) {
    if (t === 'conversation' || t === 'unfold' || t === 'cinema' || t === 'kinetic' || t === 'windows') return t;
    return 'cinema';
  }

  function beatOf(saved, role, caps, clip) {
    if (saved && saved.beats && saved.beats[role] && typeof saved.beats[role].text === 'string') {
      return {
        text: saved.beats[role].text,
        t0: Number(saved.beats[role].t0) || 0,
        t1: Number(saved.beats[role].t1) || 0
      };
    }
    var mine = caps.filter(function (c) { return c.role === role; });
    return {
      text: (clip && clip[role]) || '',
      t0: mine.length ? mine[0].t0 : 0,
      t1: mine.length ? mine[mine.length - 1].t1 : 0
    };
  }

  function draft(clip) {
    var caps = captions(clip);
    var win = span(clip);
    var saved = storageGet()[clip && clip.id] || null;
    var beats = {};
    ROLES.forEach(function (role) { beats[role] = beatOf(saved, role, caps, clip); });
    return {
      clip: clip,
      captions: caps,
      window: win,
      beats: beats,
      delivery: (saved && saved.delivery) || 'kinetic',
      style: (saved && saved.style) || styleFromTreatment(clip && clip.treatment),
      background: (saved && saved.background) || 'gradient',
      mask: (saved && saved.mask) || 'arch',
      solid: (saved && saved.solid) || 'ground',
      gradient: (saved && saved.gradient) || 'dusk',
      persisted: !!(saved && saved.delivery)
    };
  }

  function forFeed(clip) {
    var saved = storageGet()[clip && clip.id];
    if (!saved || !saved.delivery) return null;
    return draft(clip);
  }

  function save(clipId, state) {
    var all = storageGet();
    var beats = {};
    ROLES.forEach(function (role) {
      var b = state.beats[role] || { text: '', t0: 0, t1: 0 };
      beats[role] = { text: b.text, t0: round1(Number(b.t0) || 0), t1: round1(Number(b.t1) || 0) };
    });
    all[clipId] = {
      delivery: state.delivery,
      style: state.style,
      background: state.background,
      mask: state.mask,
      solid: state.solid,
      gradient: state.gradient,
      beats: beats
    };
    storageSet(all);
    return all[clipId];
  }

  function clearStore() {
    memory = {};
    try { if (typeof localStorage !== 'undefined') localStorage.removeItem(STORE); } catch (e) {}
  }

  /* Keep a line that is already one short beat and only snap its in/out.
     A run-on becomes the single caption sentence inside it that best fits 8–25 words. */
  function trimToSentence(fieldText, caps, role) {
    var field = normalize(fieldText);
    var n = wordCount(field);
    var pool = (caps || []).filter(function (c) { return !role || c.role === role; });
    var contained = pool.filter(function (c) { return c.text && field.indexOf(normalize(c.text)) !== -1; });
    if (n > 0 && n <= 25) {
      var spanCues = contained.length ? contained : [];
      var t0 = spanCues.length ? spanCues[0].t0 : null;
      var t1 = spanCues.length ? spanCues[spanCues.length - 1].t1 : null;
      if (t0 == null) {
        var roleCues = pool;
        if (roleCues.length && normalize(roleCues.map(function (c) { return c.text; }).join(' ')) === field) {
          t0 = roleCues[0].t0; t1 = roleCues[roleCues.length - 1].t1;
        }
      }
      return { ok: true, text: field, t0: t0, t1: t1, shortened: false };
    }
    if (!contained.length) {
      return { ok: false, reason: 'no-caption-sentence', text: field, t0: null, t1: null, shortened: false };
    }
    var inBand = contained.filter(function (c) {
      var w = wordCount(c.text);
      return w >= 8 && w <= 25;
    });
    var choices = inBand.length ? inBand : contained;
    choices = choices.slice().sort(function (a, b) {
      return Math.abs(wordCount(a.text) - 16) - Math.abs(wordCount(b.text) - 16) || a.t0 - b.t0;
    });
    var pick = choices[0];
    return { ok: true, text: pick.text, t0: pick.t0, t1: pick.t1, shortened: normalize(pick.text) !== field };
  }

  function assess(beats, win) {
    var notes = [];
    var start = win ? win.start : 0;
    var end = win ? win.end : 0;
    ROLES.forEach(function (role) {
      var b = (beats && beats[role]) || { text: '', t0: 0, t1: 0 };
      var n = wordCount(b.text);
      var label = role.charAt(0).toUpperCase() + role.slice(1);
      if (!normalize(b.text)) {
        notes.push({ level: 'bad', role: role, code: 'empty', text: label + ' is empty.' });
      } else if (n > 30) {
        notes.push({
          level: 'bad', role: role, code: 'long',
          text: label + ' is ' + n + ' words. One line, about 8–25 — over 30 is too long to land.'
        });
      }
      if (b.t1 < b.t0) {
        notes.push({ level: 'bad', role: role, code: 'range', text: label + ' ends before it starts.' });
      }
    });
    var outside = ROLES.filter(function (role) {
      var b = beats[role];
      return b.t0 < start - 0.05 || b.t1 > end + 0.05;
    });
    if (outside.length) {
      notes.push({
        level: 'bad', role: outside[0], code: 'contain',
        text: 'The clip window does not contain all three. ' +
          outside.map(function (r) { return r.charAt(0).toUpperCase() + r.slice(1); }).join(', ') +
          (outside.length > 1 ? ' sit' : ' sits') + ' outside ' + fmt(start) + '–' + fmt(end) + '.'
      });
    }
    var hs = beats.hook.t0, ts = beats.turn.t0, ls = beats.land.t0;
    if (!(hs <= ts + 0.001 && ts <= ls + 0.001)) {
      notes.push({
        level: 'bad', role: 'turn', code: 'order',
        text: 'Hook, turn and land are out of order. They should arrive Hook, then Turn, then Land.'
      });
    }
    return notes;
  }

  function fmt(s) {
    s = Math.max(0, Number(s) || 0);
    var m = Math.floor(s / 60);
    var sec = s - m * 60;
    var whole = Math.floor(sec);
    var tenth = Math.round((sec - whole) * 10);
    if (tenth === 10) { whole += 1; tenth = 0; }
    return m + ':' + (whole < 10 ? '0' : '') + whole + '.' + tenth;
  }

  function wordsFor(beat, caps, role) {
    var field = normalize(beat.text);
    var mine = (caps || []).filter(function (c) {
      return c.role === role && field.indexOf(normalize(c.text)) !== -1;
    });
    if (mine.length === 1 && normalize(mine[0].text) === field) return mine[0].words;
    if (mine.length && wordCount(field) > 25) {
      var all = [];
      mine.forEach(function (c) { c.words.forEach(function (w) { all.push(w); }); });
      return all;
    }
    var t0 = Number(beat.t0) || 0;
    var t1 = Number(beat.t1) || t0 + 0.4;
    if (t1 <= t0) t1 = t0 + 0.4;
    return timeWords(beat.text, t0, t1);
  }

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  /* Live stage. `getState()` is read every frame so the editor can retune
     lines, style, and background without restarting the clock. */
  function mount(host, opts) {
    opts = opts || {};
    host.classList.add('htl-stage');
    host.innerHTML = '';
    var bg = el('div', 'htl-bg');
    var video = el('video', 'htl-vid');
    video.setAttribute('playsinline', '');
    video.setAttribute('preload', 'auto');
    video.loop = true;
    var poster = el('img', 'htl-poster');
    poster.alt = '';
    var mask = el('div', 'htl-mask');
    var lines = el('div', 'htl-lines');
    var caption = el('div', 'htl-caption');
    var playBtn = el('button', 'htl-play');
    playBtn.type = 'button';
    playBtn.textContent = 'Play';
    var clock = el('div', 'htl-clock');
    host.appendChild(bg);
    host.appendChild(poster);
    host.appendChild(video);
    host.appendChild(mask);
    host.appendChild(lines);
    host.appendChild(caption);
    host.appendChild(clock);
    host.appendChild(playBtn);

    if (opts.poster) {
      poster.src = opts.poster;
      poster.addEventListener('error', function () { poster.hidden = true; });
    } else poster.hidden = true;
    video.addEventListener('playing', function () { poster.style.opacity = '0'; });

    var usingVideo = false;
    var origin = 0;
    var raf = 0;
    var destroyed = false;
    var paused = false;
    var lastT = 0;
    var builtSig = '';

    function state() {
      var s = opts.getState ? opts.getState() : {};
      s.beats = s.beats || { hook: { text: '', t0: 0, t1: 0 }, turn: { text: '', t0: 0, t1: 0 }, land: { text: '', t0: 0, t1: 0 } };
      s.window = s.window || { start: 0, end: 18, len: 18 };
      return s;
    }

    function applyChrome(s) {
      host.dataset.style = s.style || 'cinema';
      host.dataset.bg = s.background || 'gradient';
      host.dataset.mask = s.mask || 'arch';
      host.dataset.delivery = s.delivery || 'kinetic';
      host.dataset.solid = s.solid || 'ground';
      host.dataset.gradient = s.gradient || 'dusk';
      host.dataset.light = (s.background === 'solid' && s.solid === 'cream') ? '1' : '';
      var showCaption = s.delivery === 'video' && !opts.burnedIn && opts.captionText;
      caption.hidden = !showCaption;
      caption.textContent = showCaption ? opts.captionText : '';
      lines.hidden = s.delivery === 'video';
    }

    function rebuild(s) {
      lines.innerHTML = '';
      ROLES.forEach(function (role) {
        var beat = s.beats[role];
        var line = el('div', 'htl-line htl-line-' + role);
        line.dataset.role = role;
        var label = el('div', 'htl-line-label');
        label.textContent = role;
        line.appendChild(label);
        var body = el('div', 'htl-line-body');
        wordsFor(beat, s.captions || [], role).forEach(function (w, i) {
          var span = el('span', 'htl-word');
          span.textContent = w.w;
          span.dataset.t0 = String(w.t0);
          span.style.transitionDelay = (s.style === 'kinetic' ? Math.min(i, 12) * 28 : 0) + 'ms';
          body.appendChild(span);
        });
        if (!body.childNodes.length) {
          var empty = el('span', 'htl-word');
          empty.textContent = '—';
          body.appendChild(empty);
        }
        line.appendChild(body);
        lines.appendChild(line);
      });
    }

    function paint(t, len) {
      if (destroyed) return;
      var s = state();
      len = len || s.window.len || 18;
      t = Math.max(0, t);
      var sig = JSON.stringify({
        d: s.delivery, y: s.style, b: s.background, m: s.mask, so: s.solid, g: s.gradient,
        h: s.beats.hook, u: s.beats.turn, l: s.beats.land
      });
      applyChrome(s);
      if (sig !== builtSig) { rebuild(s); builtSig = sig; }
      var current = 'hook';
      ROLES.forEach(function (role) {
        if (t + 0.04 >= (Number(s.beats[role].t0) || 0)) current = role;
      });
      host.dataset.beat = current;
      host.dataset.t = t.toFixed(2);
      host.dataset.playing = paused ? '' : '1';
      var nodes = lines.querySelectorAll('.htl-line');
      for (var i = 0; i < nodes.length; i++) {
        var line = nodes[i];
        var role = line.dataset.role;
        var arrived = t + 0.04 >= (Number(s.beats[role].t0) || 0);
        line.classList.toggle('in', arrived);
        line.classList.toggle('now', role === current && arrived);
        var ws = line.querySelectorAll('.htl-word');
        for (var k = 0; k < ws.length; k++) {
          var wt = Number(ws[k].dataset.t0);
          ws[k].classList.toggle('on', arrived && (isNaN(wt) || t + 0.02 >= wt));
        }
      }
      clock.textContent = fmt(t) + ' / ' + fmt(len);
      playBtn.hidden = !paused;
      lastT = t;
      if (opts.onTime) opts.onTime(t, len);
    }

    function frame(now) {
      if (destroyed) return;
      raf = requestAnimationFrame(frame);
      if (paused) return;
      var len = state().window.len || 18;
      var t;
      if (usingVideo && video.readyState >= 2) {
        t = video.currentTime || 0;
        if (video.duration && t > video.duration - 0.08) t = 0;
      } else {
        t = ((now - origin) / 1000) % len;
      }
      paint(t, len);
    }

    function play() {
      if (destroyed) return;
      paused = false;
      playBtn.hidden = true;
      host.dataset.playing = '1';
      if (usingVideo) {
        var attempt = video.play();
        if (attempt && attempt.catch) {
          attempt.catch(function () {
            video.muted = true;
            var again = video.play();
            if (again && again.catch) again.catch(function () { usingVideo = false; origin = performance.now() - lastT * 1000; });
          });
        }
      } else {
        origin = performance.now() - lastT * 1000;
      }
      if (!raf) raf = requestAnimationFrame(frame);
    }

    function pause() {
      paused = true;
      host.dataset.playing = '';
      playBtn.hidden = false;
      try { video.pause(); } catch (e) {}
    }

    function destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) {}
    }

    playBtn.onclick = function (e) {
      e.stopPropagation();
      if (paused) play(); else pause();
    };

    if (opts.src) {
      usingVideo = true;
      video.src = opts.src;
      video.muted = false;
      video.addEventListener('error', function () {
        usingVideo = false;
        origin = performance.now();
      });
    } else {
      usingVideo = false;
    }
    origin = performance.now();
    paint(0, state().window.len || 18);
    if (opts.autoplay !== false) play();

    return {
      play: play,
      pause: pause,
      destroy: destroy,
      redraw: function () { builtSig = ''; },
      time: function () { return lastT; }
    };
  }

  var api = {
    ROLES: ROLES,
    STYLES: STYLES,
    BACKGROUNDS: BACKGROUNDS,
    MASKS: MASKS,
    SOLIDS: SOLIDS,
    GRADIENTS: GRADIENTS,
    wordCount: wordCount,
    normalize: normalize,
    captions: captions,
    span: span,
    draft: draft,
    forFeed: forFeed,
    save: save,
    clearStore: clearStore,
    trimToSentence: trimToSentence,
    assess: assess,
    fmt: fmt,
    mount: mount,
    splitSentences: splitSentences
  };

  root.HTL = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
