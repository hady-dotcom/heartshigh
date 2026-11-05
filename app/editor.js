/* Talk / clip editor and the Review page.
   Both host the same Hook, turn and land card: three timed chips, a trim
   helper, and a live kinetic (or video) preview. Choices save per hors d'oeuvre. */
(function () {
  'use strict';

  var UI = function () { return window.HUDHUD_UI; };
  var HTL = function () { return window.HTL; };

  var cms = null;

  function clips() {
    var ui = UI();
    var list = [];
    if (ui.hero) list.push(ui.hero);
    (ui.reel || []).forEach(function (c) { list.push(c); });
    return list;
  }

  function byId(id) {
    var all = clips();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return all[0];
  }

  function labelOf(c) {
    return c.title || c.talk || c.hook || c.land || c.id;
  }

  function needsWork(c) {
    var d = HTL().draft(c);
    return HTL().assess(d.beats, d.window).some(function (n) {
      return n.code === 'long' || n.code === 'contain' || n.code === 'order' || n.code === 'empty';
    });
  }

  function open(mode, clipId) {
    var ui = UI();
    close();
    document.body.classList.add('cms-on');
    var root = document.createElement('div');
    root.id = 'cms';
    root.dataset.mode = mode === 'review' ? 'review' : 'edit';
    document.body.appendChild(root);
    cms = { root: root, mode: root.dataset.mode, card: null };
    renderShell();
    var initial = clipId ? byId(clipId) : (cms.mode === 'review' ? (queue()[0] || clips()[0]) : (ui.hero || clips()[0]));
    select(initial);
    try {
      var hash = '#/' + cms.mode + (initial ? '/' + encodeURIComponent(initial.id) : '');
      if (location.hash !== hash) history.replaceState(null, '', hash);
    } catch (e) {}
  }

  function close() {
    if (cms && cms.card) cms.card.destroy();
    var node = document.getElementById('cms');
    if (node) node.remove();
    document.body.classList.remove('cms-on');
    cms = null;
  }

  function queue() {
    var q = clips().filter(needsWork);
    q.sort(function (a, b) {
      return worst(b) - worst(a);
    });
    return q;
  }

  function worst(c) {
    var d = HTL().draft(c);
    var n = 0;
    HTL().ROLES.forEach(function (r) { n = Math.max(n, HTL().wordCount(d.beats[r].text)); });
    return n;
  }

  function renderShell() {
    var ui = UI();
    var root = cms.root;
    root.innerHTML = '';
    var head = document.createElement('header');
    head.className = 'cms-head';
    var brand = document.createElement('div');
    brand.className = 'cms-brand';
    brand.innerHTML = 'Hud-hud <span>editorial</span>';
    var tabs = document.createElement('nav');
    tabs.className = 'cms-tabs';
    [['edit', 'Talk / clip editor'], ['review', 'Review']].forEach(function (pair) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cms-tab' + (cms.mode === pair[0] ? ' on' : '');
      b.textContent = pair[1];
      b.onclick = function () { open(pair[0]); };
      tabs.appendChild(b);
    });
    var done = document.createElement('button');
    done.type = 'button';
    done.className = 'cms-done';
    done.textContent = 'Back to the app';
    done.onclick = function () {
      close();
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
      ui.openHors && ui.reel && ui.reel[0] && ui.openHors(ui.reel[0]);
    };
    head.appendChild(brand);
    head.appendChild(tabs);
    head.appendChild(done);
    root.appendChild(head);

    var body = document.createElement('div');
    body.className = 'cms-body';

    var aside = document.createElement('aside');
    aside.className = 'cms-list';
    var search = document.createElement('input');
    search.className = 'cms-search';
    search.type = 'search';
    search.placeholder = cms.mode === 'review' ? 'Search the review queue' : 'Search talks and clips';
    search.setAttribute('aria-label', 'Search clips');
    var list = document.createElement('div');
    list.className = 'cms-items';
    aside.appendChild(search);
    aside.appendChild(list);

    var main = document.createElement('section');
    main.className = 'cms-main';
    var cardHost = document.createElement('div');
    cardHost.className = 'cms-card-host';
    main.appendChild(cardHost);

    body.appendChild(aside);
    body.appendChild(main);
    root.appendChild(body);

    cms.list = list;
    cms.search = search;
    cms.cardHost = cardHost;
    search.oninput = function () { fillList(search.value); };
    fillList('');
  }

  function fillList(q) {
    var ui = UI();
    var src = cms.mode === 'review' ? queue() : clips();
    q = (q || '').trim().toLowerCase();
    var shown = [];
    for (var i = 0; i < src.length && shown.length < 40; i++) {
      var c = src[i];
      var hay = (labelOf(c) + ' ' + (ui.sname(c.speaker) || '') + ' ' + (c.hook || '') + ' ' + (c.land || '') + ' ' + c.id).toLowerCase();
      if (q && hay.indexOf(q) === -1) continue;
      shown.push(c);
    }
    cms.list.innerHTML = '';
    var note = document.createElement('div');
    note.className = 'cms-list-note';
    if (cms.mode === 'review') {
      note.textContent = queue().length + ' hors d’oeuvres with a long line, an empty beat, or a window that does not hold all three.';
    } else {
      note.textContent = 'One hors d’oeuvre is one hook, turn and land. Pick the moment, then trim it to the caption.';
    }
    cms.list.appendChild(note);
    if (!shown.length) {
      var empty = document.createElement('div');
      empty.className = 'cms-list-note';
      empty.textContent = 'Nothing in this queue matches.';
      cms.list.appendChild(empty);
    }
    shown.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cms-item' + (cms.current && cms.current.id === c.id ? ' on' : '');
      b.dataset.clipId = c.id;
      var d = HTL().draft(c);
      var maxW = 0;
      HTL().ROLES.forEach(function (r) { maxW = Math.max(maxW, HTL().wordCount(d.beats[r].text)); });
      var title = document.createElement('b');
      title.textContent = labelOf(c);
      var meta = document.createElement('i');
      meta.textContent = ui.sname(c.speaker) + ' · ' + (maxW > 30 ? maxW + ' words' : (d.persisted ? d.delivery : 'unreviewed'));
      b.appendChild(title);
      b.appendChild(meta);
      b.onclick = function () { select(c); };
      cms.list.appendChild(b);
    });
    cms.shown = shown;
  }

  function select(clip) {
    if (!clip) return;
    cms.current = clip;
    fillList(cms.search ? cms.search.value : '');
    if (cms.card) cms.card.destroy();
    cms.cardHost.innerHTML = '';
    cms.card = mountCard(cms.cardHost, clip);
    try {
      history.replaceState(null, '', '#/' + cms.mode + '/' + encodeURIComponent(clip.id));
    } catch (e) {}
  }

  function mountCard(host, clip) {
    var ui = UI();
    var htl = HTL();
    var state = htl.draft(clip);
    var win = state.window;

    var card = document.createElement('div');
    card.className = 'htl-card';
    card.dataset.clipId = clip.id;

    var top = document.createElement('div');
    top.className = 'htl-top';
    var h = document.createElement('h1');
    h.textContent = labelOf(clip);
    var sub = document.createElement('p');
    sub.textContent = ui.sname(clip.speaker) + ' · ' + (clip.lane || '') +
      ' · window ' + htl.fmt(win.start) + '–' + htl.fmt(win.end) +
      (clip.start ? ' · in the talk at ' + ui.mmss(clip.start) : '');
    top.appendChild(h);
    top.appendChild(sub);

    var pick = document.createElement('select');
    pick.className = 'cms-pick';
    pick.setAttribute('aria-label', 'Choose an hors d’oeuvre');
    var options = (cms.shown || []).slice();
    if (!options.some(function (c) { return c.id === clip.id; })) options.unshift(clip);
    options.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c.id;
      o.textContent = ui.sname(c.speaker) + ' — ' + labelOf(c);
      if (c.id === clip.id) o.selected = true;
      pick.appendChild(o);
    });
    pick.onchange = function () { select(byId(pick.value)); };

    var timeline = document.createElement('div');
    timeline.className = 'htl-timeline';
    timeline.dataset.htlTimeline = '1';
    var lanes = document.createElement('div');
    lanes.className = 'htl-lanes';
    var playhead = document.createElement('div');
    playhead.className = 'htl-playhead';
    var scale = document.createElement('div');
    scale.className = 'htl-scale';
    scale.innerHTML = '<span>' + htl.fmt(0) + '</span><span>' + htl.fmt(win.len / 2) + '</span><span>' + htl.fmt(win.len) + '</span>';
    var chips = {};
    htl.ROLES.forEach(function (role) {
      var lane = document.createElement('div');
      lane.className = 'htl-lane';
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'htl-chip htl-chip-' + role;
      chip.dataset.htlChip = role;
      chip.onclick = function () {
        var field = card.querySelector('[data-htl-text="' + role + '"]');
        if (field) field.focus();
      };
      lane.appendChild(chip);
      lanes.appendChild(lane);
      chips[role] = chip;
      wireDrag(chip, role);
    });
    lanes.appendChild(playhead);
    timeline.appendChild(lanes);
    timeline.appendChild(scale);

    var previewSlot = document.createElement('div');
    previewSlot.className = 'cms-preview-slot';
    var preview = document.createElement('div');
    preview.className = 'htl-preview';
    preview.dataset.htlPreview = '1';
    var stage = document.createElement('div');
    stage.className = 'htl-stage-mount';
    preview.appendChild(stage);
    previewSlot.appendChild(preview);

    var fields = document.createElement('div');
    fields.className = 'htl-fields';
    htl.ROLES.forEach(function (role) { fields.appendChild(fieldBlock(role)); });

    var warn = document.createElement('div');
    warn.className = 'htl-warns';
    warn.dataset.htlWarn = '1';

    var controls = document.createElement('div');
    controls.className = 'htl-controls';
    controls.appendChild(deliveryBlock());
    controls.appendChild(styleBlock());
    controls.appendChild(backgroundBlock());

    var actions = document.createElement('div');
    actions.className = 'htl-actions';
    var trimAll = document.createElement('button');
    trimAll.type = 'button';
    trimAll.className = 'htl-btn';
    trimAll.textContent = 'Trim all to a sentence';
    trimAll.onclick = function () { htl.ROLES.forEach(applyTrim); };
    var save = document.createElement('button');
    save.type = 'button';
    save.className = 'htl-btn htl-btn-primary';
    save.dataset.htlSave = '1';
    save.textContent = 'Save for learners';
    save.onclick = function () {
      htl.save(clip.id, state);
      state.persisted = true;
      ui.toast && ui.toast('Saved · learners get this as ' + (state.delivery === 'video' ? 'the video clip' : 'kinetic cards'));
      paint();
      fillList(cms.search ? cms.search.value : '');
    };
    var feed = document.createElement('button');
    feed.type = 'button';
    feed.className = 'htl-btn';
    feed.dataset.htlFeed = '1';
    feed.textContent = 'Open in the feed';
    feed.onclick = function () {
      htl.save(clip.id, state);
      close();
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
      ui.openHors(clip);
    };
    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'htl-btn';
    next.textContent = 'Next in review';
    next.hidden = cms.mode !== 'review';
    next.onclick = function () {
      var q = queue();
      var i = 0;
      for (var k = 0; k < q.length; k++) if (q[k].id === clip.id) i = k;
      select(q[(i + 1) % Math.max(1, q.length)] || clip);
    };
    actions.appendChild(trimAll);
    actions.appendChild(save);
    actions.appendChild(feed);
    actions.appendChild(next);

    card.appendChild(top);
    card.appendChild(pick);
    card.appendChild(timeline);
    card.appendChild(warn);
    card.appendChild(previewSlot);
    card.appendChild(controls);
    card.appendChild(fields);
    card.appendChild(actions);
    host.appendChild(card);

    var player = htl.mount(stage, {
      src: ui.clipMediaSrc(clip),
      poster: ui.clipPoster(clip),
      burnedIn: !!clip.burnedIn,
      captionText: clip.land || '',
      getState: function () { return state; },
      autoplay: true,
      onTime: function (t, len) {
        var x = len ? (t / len) * 100 : 0;
        playhead.style.left = Math.max(0, Math.min(100, x)) + '%';
      }
    });

    function fieldBlock(role) {
      var wrap = document.createElement('div');
      wrap.className = 'htl-field';
      wrap.dataset.role = role;
      var lab = document.createElement('div');
      lab.className = 'htl-field-lab';
      var name = document.createElement('b');
      name.textContent = role;
      var count = document.createElement('span');
      count.className = 'htl-count';
      count.dataset.htlCount = role;
      lab.appendChild(name);
      lab.appendChild(count);
      var ta = document.createElement('textarea');
      ta.dataset.htlText = role;
      ta.rows = 2;
      ta.addEventListener('input', function () {
        state.beats[role].text = ta.value;
        paint();
      });
      var times = document.createElement('div');
      times.className = 'htl-times';
      ['t0', 't1'].forEach(function (key) {
        var label = document.createElement('label');
        label.textContent = key === 't0' ? 'In' : 'Out';
        var input = document.createElement('input');
        input.type = 'number';
        input.step = '0.1';
        input.dataset.htlTime = role + '-' + (key === 't0' ? 'in' : 'out');
        input.addEventListener('input', function () {
          state.beats[role][key] = Number(input.value);
          paint();
        });
        label.appendChild(input);
        times.appendChild(label);
      });
      var trim = document.createElement('button');
      trim.type = 'button';
      trim.className = 'htl-btn htl-trim';
      trim.dataset.htlTrim = role;
      trim.textContent = 'Trim to sentence';
      trim.onclick = function () { applyTrim(role); };
      times.appendChild(trim);
      wrap.appendChild(lab);
      wrap.appendChild(ta);
      wrap.appendChild(times);
      return wrap;
    }

    function deliveryBlock() {
      var box = document.createElement('div');
      box.className = 'htl-pick';
      var lab = document.createElement('div');
      lab.className = 'htl-pick-lab';
      lab.textContent = 'Learners get';
      box.appendChild(lab);
      var note = document.createElement('p');
      note.className = 'htl-delivery-note';
      note.textContent = 'Kinetic cards are this same moment, text only: hook, then turn, then land, each on its own audio. No picture of the clip.';
      box.appendChild(note);
      var row = document.createElement('div');
      row.className = 'htl-picks';
      row.dataset.htlDelivery = '1';
      [['video', 'Video clip'], ['kinetic', 'Kinetic cards']].forEach(function (pair) {
        var b = document.createElement('button');
        b.type = 'button';
        b.dataset.delivery = pair[0];
        b.textContent = pair[1];
        b.onclick = function () { state.delivery = pair[0]; paint(); };
        row.appendChild(b);
      });
      box.appendChild(row);
      return box;
    }

    function styleBlock() {
      var box = document.createElement('div');
      box.className = 'htl-pick';
      var lab = document.createElement('div');
      lab.className = 'htl-pick-lab';
      lab.textContent = 'Typography';
      box.appendChild(lab);
      var row = document.createElement('div');
      row.className = 'htl-picks';
      row.dataset.htlStyle = '1';
      htl.STYLES.forEach(function (s) {
        var b = document.createElement('button');
        b.type = 'button';
        b.dataset.style = s.id;
        b.textContent = s.name;
        b.onclick = function () { state.style = s.id; paint(); };
        row.appendChild(b);
      });
      box.appendChild(row);
      return box;
    }

    function backgroundBlock() {
      var box = document.createElement('div');
      box.className = 'htl-pick';
      var lab = document.createElement('div');
      lab.className = 'htl-pick-lab';
      lab.textContent = 'Background';
      box.appendChild(lab);
      var row = document.createElement('div');
      row.className = 'htl-picks';
      row.dataset.htlBg = '1';
      htl.BACKGROUNDS.forEach(function (s) {
        var b = document.createElement('button');
        b.type = 'button';
        b.dataset.bg = s.id;
        b.textContent = s.name;
        b.onclick = function () { state.background = s.id; paint(); };
        row.appendChild(b);
      });
      box.appendChild(row);
      var masks = document.createElement('div');
      masks.className = 'htl-picks htl-masks';
      masks.dataset.htlMask = '1';
      htl.MASKS.forEach(function (s) {
        var b = document.createElement('button');
        b.type = 'button';
        b.dataset.mask = s.id;
        b.textContent = s.name;
        b.onclick = function () { state.mask = s.id; state.background = 'mask'; paint(); };
        masks.appendChild(b);
      });
      var solids = document.createElement('div');
      solids.className = 'htl-picks htl-solids';
      solids.dataset.htlSolid = '1';
      htl.SOLIDS.forEach(function (s) {
        var b = document.createElement('button');
        b.type = 'button';
        b.dataset.solid = s.id;
        b.textContent = s.name;
        b.onclick = function () { state.solid = s.id; state.background = 'solid'; paint(); };
        solids.appendChild(b);
      });
      var grads = document.createElement('div');
      grads.className = 'htl-picks htl-grads';
      grads.dataset.htlGradient = '1';
      htl.GRADIENTS.forEach(function (s) {
        var b = document.createElement('button');
        b.type = 'button';
        b.dataset.gradient = s.id;
        b.textContent = s.name;
        b.onclick = function () { state.gradient = s.id; state.background = 'gradient'; paint(); };
        grads.appendChild(b);
      });
      box.appendChild(masks);
      box.appendChild(solids);
      box.appendChild(grads);
      return box;
    }

    function applyTrim(role) {
      var beat = state.beats[role];
      var result = htl.trimToSentence(beat.text, state.captions, role);
      if (!result.ok) {
        ui.toast && ui.toast('No caption sentence inside ' + role);
        return;
      }
      beat.text = result.text;
      if (result.t0 != null) beat.t0 = result.t0;
      if (result.t1 != null) beat.t1 = result.t1;
      var ta = card.querySelector('[data-htl-text="' + role + '"]');
      if (ta) ta.value = beat.text;
      paint();
    }

    function wireDrag(chip, role) {
      chip.addEventListener('pointerdown', function (e) {
        if (e.button != null && e.button !== 0) return;
        var beat = state.beats[role];
        var origin = { x: e.clientX, t0: Number(beat.t0) || 0, t1: Number(beat.t1) || 0 };
        var bar = lanes.getBoundingClientRect();
        chip.setPointerCapture && chip.setPointerCapture(e.pointerId);
        function move(ev) {
          var dt = ((ev.clientX - origin.x) / Math.max(1, bar.width)) * win.len;
          var dur = Math.max(0.3, origin.t1 - origin.t0);
          var t0 = origin.t0 + dt;
          var t1 = t0 + dur;
          if (t0 < -1) { t1 += -1 - t0; t0 = -1; }
          if (t1 > win.len + 1) { t0 -= t1 - (win.len + 1); t1 = win.len + 1; }
          beat.t0 = Math.round(t0 * 10) / 10;
          beat.t1 = Math.round(t1 * 10) / 10;
          paint();
        }
        function up() {
          chip.removeEventListener('pointermove', move);
          chip.removeEventListener('pointerup', up);
        }
        chip.addEventListener('pointermove', move);
        chip.addEventListener('pointerup', up);
      });
    }

    function paint() {
      htl.ROLES.forEach(function (role) {
        var beat = state.beats[role];
        var n = htl.wordCount(beat.text);
        var count = card.querySelector('[data-htl-count="' + role + '"]');
        count.textContent = n + (n === 1 ? ' word' : ' words');
        count.classList.toggle('bad', n > 30);
        count.classList.toggle('ok', n >= 8 && n <= 25);
        var ta = card.querySelector('[data-htl-text="' + role + '"]');
        if (ta && document.activeElement !== ta && ta.value !== beat.text) ta.value = beat.text;
        var inn = card.querySelector('[data-htl-time="' + role + '-in"]');
        var out = card.querySelector('[data-htl-time="' + role + '-out"]');
        if (inn && document.activeElement !== inn) inn.value = String(Math.round((Number(beat.t0) || 0) * 10) / 10);
        if (out && document.activeElement !== out) out.value = String(Math.round((Number(beat.t1) || 0) * 10) / 10);
        var chip = chips[role];
        var left = (Number(beat.t0) || 0) / win.len * 100;
        var width = ((Number(beat.t1) || 0) - (Number(beat.t0) || 0)) / win.len * 100;
        left = Math.max(-4, Math.min(92, left));
        width = Math.max(12, width);
        if (left + width > 100) width = Math.max(12, 100 - left);
        chip.style.left = left + '%';
        chip.style.width = width + '%';
        chip.innerHTML = '<b>' + role.charAt(0).toUpperCase() + role.slice(1) + '</b><i>' +
          htl.fmt(beat.t0).replace(/\.\d$/, '') + '–' + htl.fmt(beat.t1).replace(/\.\d$/, '') + '</i>';
        var outside = beat.t0 < win.start - 0.05 || beat.t1 > win.end + 0.05;
        chip.classList.toggle('bad', outside || n > 30);
      });
      var notes = htl.assess(state.beats, win);
      warn.innerHTML = '';
      if (!notes.length) {
        var ok = document.createElement('p');
        ok.className = 'htl-ok';
        ok.textContent = 'Three short lines, in order, inside the clip window.';
        warn.appendChild(ok);
      } else {
        notes.forEach(function (n) {
          var p = document.createElement('p');
          p.className = 'htl-note ' + n.level;
          p.dataset.code = n.code;
          p.textContent = n.text;
          warn.appendChild(p);
        });
      }
      card.querySelectorAll('[data-delivery]').forEach(function (b) {
        b.classList.toggle('on', b.dataset.delivery === state.delivery);
      });
      card.querySelectorAll('[data-style]').forEach(function (b) {
        b.classList.toggle('on', b.dataset.style === state.style);
      });
      card.querySelectorAll('[data-bg]').forEach(function (b) {
        b.classList.toggle('on', b.dataset.bg === state.background);
      });
      card.querySelectorAll('[data-mask]').forEach(function (b) {
        b.classList.toggle('on', b.dataset.mask === state.mask);
      });
      card.querySelectorAll('[data-solid]').forEach(function (b) {
        b.classList.toggle('on', b.dataset.solid === state.solid);
      });
      card.querySelectorAll('[data-gradient]').forEach(function (b) {
        b.classList.toggle('on', b.dataset.gradient === state.gradient);
      });
      card.querySelector('[data-htl-mask]').hidden = state.background !== 'mask';
      card.querySelector('[data-htl-solid]').hidden = state.background !== 'solid';
      card.querySelector('[data-htl-gradient]').hidden = state.background !== 'gradient';
      card.dataset.delivery = state.delivery;
      card.dataset.persisted = state.persisted ? '1' : '';
    }

    paint();
    return {
      destroy: function () { player.destroy(); },
      state: state
    };
  }

  function bootHash() {
    var m = (location.hash || '').match(/^#\/(edit|review)(?:\/([^/?#]+))?/);
    if (!m) return;
    open(m[1], m[2] ? decodeURIComponent(m[2]) : null);
  }

  window.HUDHUD_CMS = { open: open, close: close };

  document.getElementById('openCms') && (document.getElementById('openCms').onclick = function () { open('edit'); });

  if (document.documentElement.dataset.cmsBoot === '1' || /^#\/(edit|review)/.test(location.hash)) bootHash();
  window.addEventListener('hashchange', function () {
    if (/^#\/(edit|review)/.test(location.hash)) bootHash();
  });
})();
