/* Hud-hud — interactive demo. Vanilla JS, no framework.
   Data is baked at build time by build/generate.py (Hearts CMS + the three editorial sheets). */
(function () {
'use strict';

const D = window.HUDHUD;
const $ = (s, r) => (r || document).querySelector(s);
const screensEl = $('#screens'), viewport = $('#viewport'), sheetEl = $('#sheet'), scrim = $('#scrim');

/* ------------------------------------------------------------------ helpers */
function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const mmss = s => { s = Math.max(0, Math.floor(s)); const m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); };
const hhmm = s => { const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? h + 'h ' + m + 'm' : m + 'm'; };
const rnd = a => a[Math.floor(Math.random() * a.length)];

/* Some desktop browsers ship without H.264. Where a WebM twin exists, use it there. */
const CAN_H264 = (() => {
  try { return !!document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E"'); }
  catch (e) { return true; }
})();
const pickSrc = (mp4, webm) => (CAN_H264 || !webm) ? mp4 : webm;

const CREATOR = {}; D.creators.forEach(c => CREATOR[c.handle] = c);
const VIDEO = {};   D.videos.forEach(v => VIDEO[v.id] = v);
const SERIES = {};  D.series.forEach(s => SERIES[s.id] = s);

const photo  = h => CREATOR[h] ? 'https://cdn.hearts.foundation/cms/' + CREATOR[h].profilePhotoPath : '';
const thumb  = id => 'https://cdn.hearts.foundation/cms/videos/' + id + '/thumbnails/thumb_01.jpg';
const sname  = h => (CREATOR[h] || {}).name || h;
const shon   = h => (CREATOR[h] || {}).honorific || '';
const initials = h => sname(h).split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

/* Avatar that degrades to initials if the CDN image will not load. */
function avatar(handle, cls) {
  const n = el('div', 'avatar ' + (cls || ''), esc(initials(handle)));
  const img = new Image();
  img.onload = () => { n.textContent = ''; n.style.backgroundImage = 'url(' + img.src + ')'; n.style.backgroundSize = 'cover'; n.style.backgroundPosition = 'center'; };
  img.src = photo(handle);
  return n;
}
function imgFallback(imgEl, gradient) {
  // Swap a failed image for a painted box of the same size — never a broken-image icon,
  // and never the parent, or the whole card floods.
  imgEl.addEventListener('error', () => {
    const d = el('div', imgEl.className);
    d.style.cssText = imgEl.style.cssText;
    d.style.background = gradient || 'var(--oasis)';
    if (!d.style.width) { d.style.width = imgEl.offsetWidth ? imgEl.offsetWidth + 'px' : ''; }
    imgEl.replaceWith(d);
  }, { once: true });
}

/* ------------------------------------------------------------------ unfurl
   One disclosure gesture, used by every box on Grow. Tap anywhere on the card. */
const CHEV = '<span class="chev"><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></span>';

function unfurlable(card, headEl, buildDetail, opts) {
  opts = opts || {};
  card.classList.add('unfurlable');
  card.setAttribute('role', 'button');
  card.tabIndex = 0;
  card.setAttribute('aria-expanded', 'false');
  if (headEl && !$('.chev', headEl)) headEl.insertAdjacentHTML('beforeend', CHEV);

  const wrap = el('div', 'unf');
  const inner = el('div', 'unf-in');
  wrap.appendChild(inner);
  card.appendChild(wrap);

  let built = false;
  const toggle = e => {
    if (e && e.target.closest('a, .no-unfurl')) return;
    if (!built) { inner.appendChild(buildDetail()); built = true; }
    const open = card.classList.toggle('is-open');
    card.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  card.addEventListener('click', toggle);
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); }
  });
  return card;
}

/* ------------------------------------------------------------------ user state (mock, per the Grow board) */
const USER = {
  name: 'Leon', since: 'August', days: 38, restDays: 2,
  hors: 1140, appetisers: 96, parts: 31, coursesDone: 2, minutes: 31 * 60 + 40,
  week: [1, 1, 1, 0, 1, 1, 2],                 // 1 = done, 0 = not yet, 2 = rest day kept
  returned: [['Patience', 41, 1], ['Prayer', 28, .68], ['Family', 17, .41]],
  faves: new Set(), follows: new Set(), answers: {},
};

/* ------------------------------------------------------------------ video engine */
const VideoEngine = {
  make(container, video, opts) {
    opts = opts || {};
    const v = el('video', 'cc-video');
    v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
    v.preload = 'auto'; v.loop = false; v.crossOrigin = 'anonymous';
    container.appendChild(v);

    const state = { v, hls: null, dead: false, ok: false };
    const start = opts.whole ? 0 : (opts.start || 0);
    if (opts.whole) v.loop = true;

    // hls.js only for real HLS manifests; anything else goes straight to the element,
    // which also covers Safari's native HLS and any non-HLS source the CMS returns.
    const isHls = /\.m3u8(\?|$)/i.test(video.hls || '');
    const attach = () => {
      if (isHls && window.Hls && window.Hls.isSupported()) {
        const hls = new window.Hls({
          startPosition: start, maxBufferLength: 22, maxMaxBufferLength: 40,
          capLevelToPlayerSize: true, lowLatencyMode: false, enableWorker: true,
          startLevel: -1, backBufferLength: 12,
        });
        state.hls = hls;
        let netRetries = 0, mediaRetries = 0;
        hls.on(window.Hls.Events.ERROR, (_, d) => {
          if (!d.fatal) return;
          // Retry a couple of times, then hand over to the fallback. Retrying forever
          // leaves a dead frame on a blocked or offline network.
          if (d.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
            if (netRetries++ < 2) { try { hls.startLoad(); return; } catch (e) {} }
            return fail();
          }
          if (d.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
            if (mediaRetries++ < 1) { try { hls.recoverMediaError(); return; } catch (e) {} }
            return fail();
          }
          fail();
        });
        hls.loadSource(video.hls);
        hls.attachMedia(v);
        hls.on(window.Hls.Events.MANIFEST_PARSED, () => { seekAndPlay(); });
      } else {
        v.src = video.hls;
        v.addEventListener('loadedmetadata', seekAndPlay, { once: true });
        v.addEventListener('error', fail, { once: true });
      }
    };
    const seekAndPlay = () => {
      if (state.dead) return;
      try { if (start && Math.abs(v.currentTime - start) > 1) v.currentTime = start; } catch (e) {}
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    };
    let triedFallback = false;
    const fail = () => {
      // Primary source unreachable (blocked CDN, offline). Try the media that ships
      // with the build before giving up on the frame entirely.
      if (opts.fallbackSrc && !triedFallback) {
        triedFallback = true;
        if (state.hls) { try { state.hls.detachMedia(); state.hls.destroy(); } catch (e) {} state.hls = null; }
        try {
          v.removeAttribute('src');
          v.load();
          v.loop = true;
          v.src = opts.fallbackSrc;
          v.load();
          const p = v.play(); p && p.catch && p.catch(() => {});
        } catch (e) {}
        return;
      }
      state.ok = false; container.classList.add('novideo'); opts.onFail && opts.onFail();
    };

    v.addEventListener('loadedmetadata', () => {
      // A portrait source fills a portrait frame; a 16:9 lecture stays letterboxed
      // over the blurred backdrop rather than being cropped to ribbons.
      if (v.videoHeight > v.videoWidth) {
        const card = container.closest('.cardclip');
        if (card) card.dataset.fit = 'cover';
      }
    });
    v.addEventListener('playing', () => { state.ok = true; v.classList.add('on'); opts.onPlay && opts.onPlay(); }, { once: true });
    v.addEventListener('ended', () => {
      // Short or mis-tagged source: loop the clip instead of freezing on the last frame.
      try { v.currentTime = start; const p = v.play(); p && p.catch && p.catch(() => {}); } catch (e) {}
    });
    v.addEventListener('timeupdate', () => { opts.onTime && opts.onTime(v.currentTime); });

    // Never leave a dead frame: if nothing plays within 6s, fall back to the still.
    const guard = setTimeout(() => { if (!state.ok) fail(); }, 6000);
    v.addEventListener('playing', () => clearTimeout(guard), { once: true });

    attach();

    state.destroy = () => {
      state.dead = true; clearTimeout(guard);
      try { v.pause(); } catch (e) {}
      if (state.hls) { try { state.hls.destroy(); } catch (e) {} }
      try { v.removeAttribute('src'); v.load(); } catch (e) {}
      v.remove();
    };
    state.setMuted = m => { v.muted = m; if (!m) { const p = v.play(); p && p.catch && p.catch(() => {}); } };
    return state;
  }
};
let GLOBAL_MUTED = true;

/* YouTube-backed clips. The curated demo-10 bites live on YouTube, which needs no CORS,
   so these play anywhere the page is served from. Uses the IFrame API when it loads and
   falls back to URL parameters when it does not. */
let YT_READY = null;
function ytApi() {
  if (YT_READY) return YT_READY;
  YT_READY = new Promise(res => {
    if (window.YT && window.YT.Player) return res(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev && prev(); res(window.YT); };
    const t = document.createElement('script');
    t.src = 'https://www.youtube.com/iframe_api';
    t.onerror = () => res(null);
    document.head.appendChild(t);
    setTimeout(() => res(window.YT || null), 4000);
  });
  return YT_READY;
}

const YouTubeEngine = {
  make(container, clip, opts) {
    opts = opts || {};
    const start = Math.max(0, clip.start | 0), len = clip.len || 18;
    const end = start + len;
    const holder = el('div', 'cc-yt');
    const frameId = 'yt' + Math.random().toString(36).slice(2);
    holder.innerHTML = '<div id="' + frameId + '"></div>';
    container.appendChild(holder);

    const state = { dead: false, ok: false, player: null, timer: 0 };
    const params = {
      autoplay: 1, mute: 1, controls: 0, playsinline: 1, rel: 0, modestbranding: 1,
      iv_load_policy: 3, disablekb: 1, fs: 0, start: start, end: end,
    };

    ytApi().then(YT => {
      if (state.dead) return;
      if (!YT || !YT.Player) return fallbackIframe();
      try {
        state.player = new YT.Player(frameId, {
          videoId: clip.youtube, host: 'https://www.youtube-nocookie.com',
          playerVars: params,
          events: {
            onReady: e => {
              if (state.dead) return;
              try { e.target.mute(); e.target.seekTo(start, true); e.target.playVideo(); } catch (err) {}
              holder.classList.add('on');
              state.timer = setInterval(() => {
                if (!state.player || !state.player.getCurrentTime) return;
                const t = state.player.getCurrentTime();
                opts.onTime && opts.onTime(t);
                if (t >= end || t < start - 1) { try { state.player.seekTo(start, true); } catch (err) {} }
              }, 250);
            },
            onStateChange: e => { if (e.data === 1 && !state.ok) { state.ok = true; opts.onPlay && opts.onPlay(); } },
            onError: () => fallbackIframe(),
          },
        });
      } catch (err) { fallbackIframe(); }
    });

    function fallbackIframe() {
      if (state.dead || state.ok) return;
      const q = Object.keys(params).map(k => k + '=' + params[k]).join('&');
      holder.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + clip.youtube +
        '?' + q + '&loop=1&playlist=' + clip.youtube +
        '" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
      holder.classList.add('on');
      state.ok = true;
      opts.onPlay && opts.onPlay();
      animateFallbackProgress(opts.progressBar, len);
    }
    const guard = setTimeout(() => { if (!state.ok) { fallbackIframe(); } }, 5000);
    const guard2 = setTimeout(() => { if (!state.ok) { opts.onFail && opts.onFail(); } }, 9000);

    state.destroy = () => {
      state.dead = true; clearTimeout(guard); clearTimeout(guard2); clearInterval(state.timer);
      try { state.player && state.player.destroy && state.player.destroy(); } catch (e) {}
      holder.remove();
    };
    state.setMuted = m => {
      try { if (!state.player) return; m ? state.player.mute() : state.player.unMute(); } catch (e) {}
    };
    state.replay = () => { try { state.player && state.player.seekTo(start, true); } catch (e) {} };
    state.pause = () => { try { state.player && state.player.pauseVideo(); } catch (e) {} };
    state.play  = () => { try { state.player && state.player.playVideo(); } catch (e) {} };
    return state;
  }
};

/* ------------------------------------------------------------------ screen stack */
const stack = [];
function chrome(mode) { viewport.dataset.chrome = mode; }

/* A covered screen must never keep playing — two talks at once kills the illusion. */
function pauseMedia(node) {
  node.querySelectorAll('video').forEach(v => { try { v.pause(); } catch (e) {} });
  node.querySelectorAll('.cardclip').forEach(c => { c.__player && c.__player.pause && c.__player.pause(); });
}
function resumeMedia(node) {
  node.querySelectorAll('video').forEach(v => { try { const p = v.play(); p && p.catch && p.catch(() => {}); } catch (e) {} });
  node.querySelectorAll('.cardclip').forEach(c => { c.__player && c.__player.play && c.__player.play(); });
}

function push(builder, meta) {
  const node = builder();
  node.classList.add('screen');
  if (meta && meta.dark) node.classList.add('dark');
  screensEl.appendChild(node);
  const prev = stack[stack.length - 1];
  if (prev) {
    pauseMedia(prev.node);
    prev.node.classList.add('push-out');
    setTimeout(() => { prev.node.classList.remove('push-out'); prev.node.style.display = 'none'; prev.node.setAttribute('aria-hidden','true'); }, 340);
  }
  node.classList.add('push-in');
  stack.push({ node, meta: meta || {} });
  chrome((meta && meta.chrome) || 'dark');
  return node;
}
function pop() {
  if (stack.length < 2) return;
  const top = stack.pop();
  top.meta.onLeave && top.meta.onLeave();
  const under = stack[stack.length - 1];
  under.node.style.display = '';
  under.node.removeAttribute('aria-hidden');
  resumeMedia(under.node);
  under.node.classList.add('pop-in');
  setTimeout(() => under.node.classList.remove('pop-in'), 300);
  top.node.classList.add('pop-out');
  setTimeout(() => top.node.remove(), 300);
  chrome(under.meta.chrome || 'dark');
  syncTabs(under.meta.tab);
}
function resetTo(builder, meta) {
  while (stack.length) { const s = stack.pop(); s.meta.onLeave && s.meta.onLeave(); s.node.remove(); }
  screensEl.innerHTML = '';
  const node = builder();
  node.classList.add('screen');
  if (meta && meta.dark) node.classList.add('dark');
  node.style.animation = 'fadeUp .3s var(--ease) both';
  screensEl.appendChild(node);
  stack.push({ node, meta: meta || {} });
  chrome((meta && meta.chrome) || 'dark');
  syncTabs(meta && meta.tab);
  return node;
}
function navbar(title, onBack, onWarm) {
  const n = el('div', 'navbar' + (onWarm ? ' on-warm' : ''));
  const b = el('button', 'back', '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg><span>' + esc(title) + '</span>');
  b.onclick = onBack || pop;
  n.appendChild(b);
  return n;
}

/* ------------------------------------------------------------------ clip picking */
const REEL = D.reel;
const byLane = {}, bySpeaker = {};
REEL.forEach(c => { (byLane[c.lane] = byLane[c.lane] || []).push(c); (bySpeaker[c.speaker] = bySpeaker[c.speaker] || []).push(c); });
const LANES = Object.keys(byLane).sort((a, b) => byLane[b].length - byLane[a].length);
const recent = [];
function fresh(pool, cur) {
  const avail = pool.filter(c => c !== cur && recent.indexOf(c.id) < 0);
  const pick = rnd(avail.length ? avail : pool.filter(c => c !== cur));
  if (pick) { recent.push(pick.id); if (recent.length > 22) recent.shift(); }
  return pick || cur;
}
const Pick = {
  any:      () => fresh(REEL, null),
  lane:     cur => { const others = LANES.filter(l => l !== cur.lane); return fresh(byLane[rnd(others)] || REEL, cur); },
  topic:    cur => { const same = (byLane[cur.lane] || []).filter(c => c.speaker !== cur.speaker); return fresh(same.length ? same : byLane[cur.lane], cur); },
  speaker:  cur => { const same = (bySpeaker[cur.speaker] || []).filter(c => c.lane !== cur.lane); return fresh(same.length ? same : bySpeaker[cur.speaker], cur); },
};

/* ------------------------------------------------------------------ 01 Hors d'oeuvre card */
/* Clip windows. Board: hors d'oeuvre 15-20s, appetiser 30s-3min. Overridable so the
   harness can drive short windows without touching playback logic. */
const CFG = window.HUDHUD_CONFIG || {};
const HORS_LEN = CFG.horsLen || 18;
const APP_LEN  = CFG.appLen  || 95;

function buildClipCard(clip, kind) {
  const isApp = kind === 'appetiser';
  const isYT = clip.source === 'youtube';
  const isFile = clip.source === 'file';
  const len = isApp ? APP_LEN : (clip.len || HORS_LEN);
  const video = VIDEO[clip.videoId];
  const card = el('div', 'cardclip' + (clip.burnedIn ? ' graded' : ''));

  const media = el('div', 'cc-media');
  const blur = el('div', 'cc-blur');
  if (!isFile) blur.style.backgroundImage = 'url(' + (isYT
    ? 'https://i.ytimg.com/vi/' + clip.youtube + '/hqdefault.jpg'
    : thumb(clip.videoId)) + ')';
  media.appendChild(blur);
  card.appendChild(media);

  const prog = el('div', 'cc-prog', '<i></i>');
  card.appendChild(prog);
  const progBar = $('i', prog);

  const top = el('div', 'cc-top');
  top.appendChild(el('span', 'pill lane', 'Lane · ' + esc(clip.lane)));
  const durPill = el('span', 'pill dur', isApp ? 'Extended cut' : mmss(len));
  top.appendChild(durPill);
  if (clip.form && !isApp) top.appendChild(el('span', 'pill form', esc(clip.form)));
  card.appendChild(top);

  const unmute = el('button', 'cc-unmute',
    '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M19 6a8 8 0 0 1 0 12"/></svg><span>Tap for sound</span>');
  card.appendChild(unmute);
  if (!GLOBAL_MUTED) unmute.classList.add('hide');

  const rail = el('div', 'cc-rail');
  const fav = el('button', 'railbtn' + (USER.faves.has(clip.id) ? ' on' : ''),
    '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-9.2A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.8C19 15.6 12 20 12 20z"/></svg><span>Fave</span>');
  fav.onclick = e => { e.stopPropagation(); USER.faves.has(clip.id) ? USER.faves.delete(clip.id) : USER.faves.add(clip.id); fav.classList.toggle('on'); };
  const share = el('button', 'railbtn',
    '<svg viewBox="0 0 24 24"><path d="M12 15V4"/><path d="m8 8 4-4 4 4"/><path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6"/></svg><span>Share</span>');
  share.onclick = e => { e.stopPropagation(); shareClip(clip); };
  rail.appendChild(share); rail.appendChild(fav);
  card.appendChild(rail);

  const hookCard = el('div', 'cc-hookcard',
    '<div class="mk">' + blossomMark(true, '#F6EFE3') + '</div><p>' + esc(clip.lane) + '</p>');
  card.appendChild(hookCard);

  const ghost = el('div', 'swipe-ghost', '<b></b>');
  card.appendChild(ghost);
  card.appendChild(el('div', 'cc-hint', '↑ swipe up to replay'));

  const body = el('div', 'cc-body');
  const who = el('div', 'cc-who');
  who.appendChild(avatar(clip.speaker));
  who.appendChild(el('div', '', '<b>' + esc((shon(clip.speaker) ? shon(clip.speaker) + ' ' : '') + sname(clip.speaker)) + '</b><i>on ' + esc(clip.theme.split('/')[0].trim()) + '</i>'));
  body.appendChild(who);

  if (!clip.burnedIn || isApp) {
    const q = el('p', 'cc-quote');
    q.innerHTML = esc(clip.land) + (isApp && clip.turn ? '<span class="turn">' + esc(clip.turn) + '</span>' : '');
    body.appendChild(q);
  }

  if (isApp) {
    const bio = el('div', 'bio-bar');
    bio.appendChild(avatar(clip.speaker, 'sm'));
    const w = el('div', 'who');
    w.appendChild(el('b', '', esc(sname(clip.speaker))));
    const bl = el('button', 'biolink', 'Speaker bio <svg width="9" height="9" viewBox="0 0 24 24" style="stroke:currentColor;fill:none;stroke-width:3"><path d="m6 9 6 6 6-6"/></svg>');
    bl.onclick = e => { e.stopPropagation(); openBio(clip.speaker); };
    w.appendChild(bl); bio.appendChild(w);
    const f = el('button', 'follow' + (USER.follows.has(clip.speaker) ? ' on' : ''), USER.follows.has(clip.speaker) ? 'Following' : 'Follow');
    f.onclick = e => {
      e.stopPropagation();
      USER.follows.has(clip.speaker) ? USER.follows.delete(clip.speaker) : USER.follows.add(clip.speaker);
      f.classList.toggle('on'); f.textContent = USER.follows.has(clip.speaker) ? 'Following' : 'Follow';
    };
    bio.appendChild(f);
    bio.style.margin = '0 0 13px'; bio.style.boxShadow = 'none';
    body.appendChild(bio);
  }

  const cta = el('button', 'cta', isApp ? 'Start this course ›' : 'Watch the full clip ›');
  cta.onclick = e => { e.stopPropagation(); isApp ? openMains(clip) : openAppetiser(clip); };
  body.appendChild(cta);
  card.appendChild(body);

  card.__clip = clip;
  card.__mount = () => {
    if (isYT) {
      card.__player = YouTubeEngine.make(media, { youtube: clip.youtube, start: clip.start, len: len }, {
        progressBar: progBar,
        onTime: t => { progBar.style.width = (Math.min(1, Math.max(0, (t - clip.start) / len)) * 100) + '%'; },
        onPlay: () => { card.__player.setMuted(GLOBAL_MUTED); setTimeout(() => card.classList.add('show-hint'), 2600); },
        onFail: () => { card.classList.add('show-hint', 'nomedia'); animateFallbackProgress(progBar, len); },
      });
      return;
    }
    card.__player = VideoEngine.make(media, {
      hls: isFile ? pickSrc(clip.src, clip.srcAlt) : (video && video.hls) }, {
      start: clip.start,
      whole: !!clip.wholeFile,
      onTime: t => {
        const v = card.__player && card.__player.v;
        const span = clip.wholeFile ? ((v && v.duration) || len) : len;
        const base = clip.wholeFile ? 0 : clip.start;
        progBar.style.width = (Math.min(1, Math.max(0, (t - base) / span)) * 100) + '%';
        if (!clip.wholeFile && (t > clip.start + len || t < clip.start - 2)) {
          try { v.currentTime = clip.start; } catch (e) {}
        }
      },
      onPlay: () => {
        card.__player.setMuted(GLOBAL_MUTED);
        const v = card.__player.v;
        if (!isApp && clip.wholeFile && v && v.duration) durPill.textContent = mmss(v.duration);
        setTimeout(() => card.classList.add('show-hint'), 2600);
      },
      onFail: () => { card.classList.add('show-hint', 'nomedia'); animateFallbackProgress(progBar, len); },
    });
    card.__player.setMuted(GLOBAL_MUTED);
  };
  card.__unmount = () => { card.__player && card.__player.destroy(); card.__player = null; };
  card.__replay = () => {
    const p = card.__player; if (!p) return;
    if (p.replay) return p.replay();
    try { p.v.currentTime = clip.start; p.v.play(); } catch (e) {}
  };

  unmute.onclick = e => {
    e.stopPropagation();
    GLOBAL_MUTED = !GLOBAL_MUTED;
    card.__player && card.__player.setMuted(GLOBAL_MUTED);
    unmute.classList.toggle('hide', !GLOBAL_MUTED);
  };
  card.__ghost = ghost;
  return card;
}

/* If video cannot load (offline / blocked CDN) the clip still reads and the bar still moves. */
function animateFallbackProgress(bar, len) {
  let t0 = performance.now();
  (function step(now) {
    if (!bar.isConnected) return;
    const p = ((now - t0) / 1000 % len) / len;
    bar.style.width = (p * 100) + '%';
    requestAnimationFrame(step);
  })(t0);
}

/* ------------------------------------------------------------------ deck + gestures */
function buildDeck(startClip, kind) {
  const wrap = el('div', 'deck');
  let current = buildClipCard(startClip, kind);
  wrap.appendChild(current);
  requestAnimationFrame(() => current.__mount());

  let sx = 0, sy = 0, dx = 0, dy = 0, dragging = false, axis = null, t0 = 0, busy = false;
  const TH = 58, LOCK = 11;

  const label = { up: 'Replay', down: 'Switch lane', left: 'More on this topic', right: 'More from this speaker' };

  function onDown(e) {
    if (busy || e.target.closest('button')) return;
    dragging = true; axis = null; dx = dy = 0; t0 = Date.now();
    sx = e.clientX; sy = e.clientY;
    wrap.setPointerCapture && wrap.setPointerCapture(e.pointerId);
  }
  function onMove(e) {
    if (!dragging) return;
    dx = e.clientX - sx; dy = e.clientY - sy;
    if (!axis && Math.hypot(dx, dy) > LOCK) axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (!axis) return;
    const ox = axis === 'x' ? dx : 0, oy = axis === 'y' ? dy : 0;
    current.style.transform = 'translate3d(' + ox * .82 + 'px,' + oy * .82 + 'px,0)';
    const dir = axis === 'x' ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    const mag = Math.min(1, Math.hypot(ox, oy) / 110);
    current.__ghost.style.opacity = mag > .25 ? mag : 0;
    $('b', current.__ghost).textContent = label[dir];
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    const dt = Math.max(1, Date.now() - t0);
    const vx = Math.abs(dx) / dt * 1000, vy = Math.abs(dy) / dt * 1000;
    current.__ghost.style.opacity = 0;
    const passed = axis === 'x' ? (Math.abs(dx) > TH || vx > 520) : (Math.abs(dy) > TH || vy > 520);
    if (!passed || !axis) { snapBack(); return; }
    const dir = axis === 'x' ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    if (dir === 'up') { snapBack(); current.__replay(); pulse('Replaying'); return; }
    go(dir);
  }
  function snapBack() {
    current.style.transition = 'transform .32s var(--ease)';
    current.style.transform = '';
    setTimeout(() => current.style.transition = '', 330);
  }
  function go(dir) {
    if (busy) return; busy = true;
    const cur = current.__clip;
    const next = dir === 'down' ? Pick.lane(cur) : dir === 'left' ? Pick.topic(cur) : Pick.speaker(cur);
    const incoming = buildClipCard(next, kind);
    const from = { left: '100%,0', right: '-100%,0', down: '0,100%', up: '0,-100%' }[dir];
    const to   = { left: '-100%,0', right: '100%,0', down: '0,-100%', up: '0,100%' }[dir];
    incoming.style.transform = 'translate3d(' + from.replace(',', 'px,').replace(/%px/g, '%') + ',0)';
    incoming.style.transform = 'translate3d(' + from.split(',')[0] + ',' + from.split(',')[1] + ',0)';
    wrap.appendChild(incoming);
    requestAnimationFrame(() => {
      incoming.style.transition = 'transform .38s var(--ease)';
      current.style.transition = 'transform .38s var(--ease), opacity .38s';
      incoming.style.transform = 'translate3d(0,0,0)';
      current.style.transform = 'translate3d(' + to.split(',')[0] + ',' + to.split(',')[1] + ',0)';
      current.style.opacity = '.4';
    });
    const old = current;
    current = incoming;
    setTimeout(() => {
      old.__unmount(); old.remove();
      incoming.style.transition = '';
      incoming.__mount();
      busy = false;
      pulse(label[dir]);
    }, 390);
  }

  wrap.addEventListener('pointerdown', onDown);
  wrap.addEventListener('pointermove', onMove);
  wrap.addEventListener('pointerup', onUp);
  wrap.addEventListener('pointercancel', onUp);
  wrap.addEventListener('keydown', e => {
    const m = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ArrowUp: 'up' }[e.key];
    if (m) { e.preventDefault(); m === 'up' ? current.__replay() : go(m); }
  });
  wrap.tabIndex = 0;
  wrap.__teardown = () => { current && current.__unmount(); };
  wrap.__current = () => current.__clip;
  return wrap;
}

let toastTimer;
function pulse(t) { toast(t); }
function toast(msg) {
  let t = $('#toast');
  if (!t) {
    t = el('div', '', '');
    t.id = 'toast';
    t.style.cssText = 'position:absolute;bottom:calc(var(--tab-h) + 18px);left:50%;transform:translateX(-50%) translateY(8px);z-index:80;background:rgba(17,16,24,.86);backdrop-filter:blur(14px);color:#fff;padding:9px 16px;border-radius:999px;font-size:12.5px;font-weight:600;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;white-space:nowrap';
    viewport.appendChild(t);
  }
  t.textContent = msg;
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(8px)'; }, 1400);
}

/* ------------------------------------------------------------------ 01 / 02 screens */
function openHors(clip) {
  let deck;
  resetTo(() => {
    const s = el('div', '');
    deck = buildDeck(clip || Pick.any(), 'hors');
    s.appendChild(deck);
    return s;
  }, { chrome: 'light', tab: 'home', dark: true, onLeave: () => deck && deck.__teardown() });
}
function openAppetiser(clip) {
  let deck;
  push(() => {
    const s = el('div', '');
    deck = buildDeck(clip, 'appetiser');
    s.appendChild(deck);
    const back = el('button', 'back', '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg><span>More</span>');
    back.style.cssText = 'position:absolute;top:58px;left:16px;z-index:9;color:#fff;background:rgba(17,16,24,.45);backdrop-filter:blur(12px);padding:8px 13px;border-radius:999px';
    back.onclick = pop;
    s.appendChild(back);
    return s;
  }, { chrome: 'light', dark: true, onLeave: () => deck && deck.__teardown() });
}

/* ------------------------------------------------------------------ 02b speaker bio */
function openBio(handle) {
  const c = CREATOR[handle] || {};
  const mine = D.videos.filter(v => v.speaker === handle);
  const sIds = [...new Set(mine.map(v => v.seriesId))];
  push(() => {
    const s = el('div', '');
    const hero = el('div', 'hero');
    const hb = el('button', 'back', '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg><span>Back</span>');
    hb.onclick = pop; hero.appendChild(hb);
    if (mine[0]) { const im = el('img'); im.src = thumb(mine[0].id); im.style.cssText = 'width:100%;height:100%;object-fit:cover'; imgFallback(im, 'var(--oasis)'); hero.appendChild(im); }
    s.appendChild(hero);

    const head = el('div', 'bio-head');
    const av = avatar(handle, 'lg'); av.style.margin = '0 auto'; head.appendChild(av);
    head.appendChild(el('h2', '', esc(c.name || handle)));
    head.appendChild(el('div', 'hon', esc((c.honorific ? c.honorific + ' · ' : '') + (c.shortBio || ''))));
    head.appendChild(el('div', 'learners', (c.videoCount || 0) + ' talks in the library · 12k learners'));
    s.appendChild(head);

    const acts = el('div', 'bio-actions');
    const f = el('button', 'cta teal', USER.follows.has(handle) ? 'Following' : 'Follow');
    f.onclick = () => { USER.follows.has(handle) ? USER.follows.delete(handle) : USER.follows.add(handle); f.textContent = USER.follows.has(handle) ? 'Following' : 'Follow'; };
    const ask = el('button', 'ghost', 'Ask a question');
    ask.onclick = () => askSheikh(handle);
    acts.appendChild(f); acts.appendChild(ask);
    s.appendChild(acts);

    const bio = el('p', 'bio-text clamp', esc(c.longBio || c.shortBio || ''));
    s.appendChild(bio);
    if ((c.longBio || '').length > 240) {
      const m = el('button', 'more', 'Read more');
      m.onclick = () => { bio.classList.toggle('clamp'); m.textContent = bio.classList.contains('clamp') ? 'Read more' : 'Read less'; };
      s.appendChild(m);
    }

    if (mine[0]) {
      s.appendChild(el('div', 'section-title', 'Start here'));
      const intro = el('button', 'rowcard');
      intro.style.margin = '0 14px';
      const it = el('img', 'thumb'); it.src = thumb(mine[0].id); imgFallback(it, 'var(--oasis)'); intro.appendChild(it);
      intro.appendChild(el('div', 'meta', '<b>Watch the intro</b><i>' + esc(sname(handle)) + ' · 1:10 · what this teacher is for</i>'));
      intro.appendChild(el('span', 'startbtn', 'Play'));
      intro.onclick = () => {
        const c = (bySpeaker[handle] || [])[0] || Pick.any();
        pop(); setTimeout(() => openAppetiser(c), 320);
      };
      s.appendChild(intro);
    }

    s.appendChild(el('div', 'section-title', 'Courses by this speaker'));
    const list = el('div', 'list scroll-pad');
    sIds.forEach(id => {
      const ser = SERIES[id]; if (!ser) return;
      const parts = mine.filter(v => v.seriesId === id);
      const row = el('button', 'rowcard');
      const im = el('img', 'thumb'); im.src = ser.thumb; imgFallback(im, 'var(--oasis)'); row.appendChild(im);
      row.appendChild(el('div', 'meta', '<b>' + esc(ser.title) + '</b><i>' + ser.videoCount + ' parts · ' + parts.length + ' ready to play</i>'));
      row.appendChild(el('span', 'startbtn', 'Start'));
      row.onclick = () => openMains({ videoId: parts[0] ? parts[0].id : D.course.videoId, speaker: handle, lane: 'Course', theme: ser.title, start: 0 });
      list.appendChild(row);
    });
    s.appendChild(list);
    return s;
  }, { chrome: 'dark' });
}

/* ------------------------------------------------------------------ ask the sheikh */
function askSheikh(handle) {
  contentSheet('Ask ' + sname(handle), () => {
    const w = el('div', '');
    const ta = el('textarea', 'answerbox');
    ta.id = 'ask' + handle;
    ta.placeholder = 'What would you like to ask?';
    w.appendChild(ta);
    w.appendChild(el('div', 'unf-note', 'Questions go to the teacher’s team, not to the teacher’s inbox. They answer the ones that come up most, on video.'));
    $('.unf-note', w).style.margin = '11px 0 0';
    const send = el('button', 'cta teal');
    send.style.marginTop = '14px';
    send.textContent = 'Send to the team';
    send.onclick = () => { closeSheet(); toast(ta.value.trim() ? 'Sent — you will get the answer in your lane' : 'Write a question first'); };
    w.appendChild(send);
    return w;
  });
}

/* ------------------------------------------------------------------ 03 Mains — course player */
function openMains(fromClip) {
  const C = D.course;
  const video = VIDEO[C.videoId];
  let player = null, rafId = 0, cooldownUntil = 0;
  const answered = new Set(C.points.filter(p => p.answered).map(p => p.at));

  let current = { videoId: C.videoId, hls: C.hls, durationSec: C.durationSec, title: C.partLabel };
  push(() => {
    const s = el('div', 'mains');
    s.appendChild(navbar(SERIES[C.seriesId] ? SERIES[C.seriesId].title : 'Course', pop));

    const pl = el('div', 'player');
    const playBtn = el('button', 'av-play', '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>');
    pl.appendChild(el('div', 'part-label', esc(C.partLabel)));
    pl.appendChild(playBtn);
    s.appendChild(pl);

    const meta = el('div', '');
    meta.style.cssText = 'padding:13px 18px 0';
    meta.appendChild(el('div', 'eyebrow', 'With ' + esc(sname(C.speaker))));
    const th = el('p', '', esc(C.thesis));
    th.style.cssText = 'margin:6px 0 0;font-size:14px;line-height:1.5;color:var(--text)';
    meta.appendChild(th);
    s.appendChild(meta);

    // timeline with engagement dots at their real timestamps
    const tl = el('div', 'timeline');
    tl.appendChild(el('div', 'tl-track'));
    const played = el('div', 'tl-played'); tl.appendChild(played);
    const dots = [];
    C.points.forEach(p => {
      const d = el('button', 'tl-dot' + (answered.has(p.at) ? ' done' : ''));
      d.style.left = (p.at / C.durationSec * 100) + '%';
      d.title = p.kind + ' · ' + mmss(p.at);
      d.onclick = () => { seekTo(Math.max(0, p.at - 6)); openEngagement(p, d); };
      tl.appendChild(d); dots.push({ p, d });
    });
    s.appendChild(tl);
    const noPoints = el('div', 'note');
    noPoints.style.cssText = 'display:none;margin:2px 20px 0;line-height:1.5';
    noPoints.textContent = 'Engagement points for this part arrive with the tagging pass.';
    s.appendChild(noPoints);
    const leg = el('div', 'tl-legend');
    leg.appendChild(el('span', '', '<span id="tlNow">0:00</span>'));
    leg.appendChild(el('span', '', esc(C.points.length + ' engagement points · ' + hhmm(C.durationSec))));
    s.appendChild(leg);

    // course garden
    const gc = el('div', 'garden-card');
    const top = el('div', 'gc-top');
    top.appendChild(el('div', 'eyebrow', 'My garden'));
    top.appendChild(el('b', '', answered.size + ' of ' + C.points.length + ' fruits'));
    gc.appendChild(top);
    const fr = el('div', 'fruitrow');
    C.points.forEach(p => {
      const f = el('div', 'fruit' + (answered.has(p.at) ? ' on' : ''), blossomSVG(answered.has(p.at)));
      f.title = p.kind + ' · ' + mmss(p.at);
      fr.appendChild(f);
    });
    gc.appendChild(fr);
    gc.appendChild(el('div', 'bar', '<i style="width:' + (answered.size / C.points.length * 100) + '%"></i>'));
    const og = el('button', 'cta', 'Open garden');
    og.style.cssText = 'margin-top:14px;background:rgba(255,255,255,.14);color:#fff;box-shadow:none';
    og.onclick = () => openCourseGarden(C, answered, at => { s.__seek(Math.max(0, at - 6)); });
    gc.appendChild(og);
    s.appendChild(gc);

    s.appendChild(el('div', 'section-title', 'Parts in this course'));
    const list = el('div', 'list scroll-pad');
    C.parts.forEach(p => {
      const row = el('button', 'rowcard');
      const im = el('img', 'thumb'); im.src = thumb(p.videoId); imgFallback(im, 'var(--oasis)'); row.appendChild(im);
      const isNow = p.videoId === current.videoId;
      row.appendChild(el('div', 'meta', '<b>' + esc(p.title.replace(/^.*?[-—]\s*/, '')) + '</b><i>' + hhmm(p.durationSec) +
        (isNow ? ' · playing now' : '') + '</i>'));
      row.appendChild(el('span', 'startbtn', isNow ? 'Now' : 'Start'));
      row.onclick = () => { if (!isNow) loadPart(p); };
      list.appendChild(row);
    });
    s.appendChild(list);

    /* Switching part reloads the player against that part's own stream. Engagement
       points are mapped for this part only; others say so rather than faking dots. */
    function loadPart(p) {
      current = { videoId: p.videoId, hls: p.hls, durationSec: p.durationSec, title: p.title };
      if (player) { player.destroy(); player = null; }
      $('.part-label', pl).textContent = p.title.replace(/^.*?[-—]\s*/, '');
      const mapped = p.videoId === C.videoId;
      tl.style.display = mapped ? '' : 'none';
      noPoints.style.display = mapped ? 'none' : '';
      played.style.width = '0%';
      mount();
      resetTo === null;
      toast('Now playing ' + p.title.replace(/^.*?[-—]\s*/, ''));
      [...list.children].forEach((row, i) => {
        const isNow = C.parts[i] && C.parts[i].videoId === p.videoId;
        const st = $('.startbtn', row); if (st) st.textContent = isNow ? 'Now' : 'Start';
        const it = $('.meta i', row);
        if (it && C.parts[i]) it.textContent = hhmm(C.parts[i].durationSec) + (isNow ? ' · playing now' : '');
      });
    }

    // mount player
    function mount() {
    requestAnimationFrame(() => {
      player = VideoEngine.make(pl, { hls: current.hls }, {
        start: 0, fallbackSrc: pickSrc(C.fallbackSrc, C.fallbackSrcAlt),
        onPlay: () => { playBtn.classList.add('hide'); player.setMuted(false); },
        onTime: t => {
          played.style.width = (t / current.durationSec * 100) + '%';
          const now = $('#tlNow'); if (now) now.textContent = mmss(t);
          dots.forEach(o => o.d.classList.toggle('live', Math.abs(t - o.p.at) < 4));
          // pause and open the panel when an unanswered point is reached
          const hit = current.videoId === C.videoId
            ? C.points.find(p => !answered.has(p.at) && t >= p.at && t < p.at + 1.2) : null;
          if (hit && !sheetEl.classList.contains('on') && Date.now() > cooldownUntil) {
            try { player.v.pause(); } catch (e) {}
            const d = dots.find(o => o.p === hit);
            openEngagement(hit, d && d.d);
          }
        },
        onFail: () => { playBtn.classList.remove('hide'); },
      });
    });
    }
    mount();
    playBtn.onclick = () => {
      if (!player) return;
      if (player.v.paused) { player.v.play().then(() => playBtn.classList.add('hide')).catch(() => {}); }
      else { player.v.pause(); playBtn.classList.remove('hide'); }
    };
    function seekTo(t) { if (player) { try { player.v.currentTime = t; player.v.play().catch(() => {}); playBtn.classList.add('hide'); } catch (e) {} } }
    s.__seek = seekTo;
    s.__pause = () => { try { player && player.v.pause(); } catch (e) {} };

    function openEngagement(p, dotEl) {
      s.__pause();
      showEngagement(p, () => {
        answered.add(p.at);
        dotEl && dotEl.classList.add('done');
        const fruits = fr.children;
        const idx = C.points.indexOf(p);
        if (fruits[idx]) { fruits[idx].className = 'fruit on'; fruits[idx].innerHTML = blossomSVG(true); }
        $('b', top).textContent = answered.size + ' of ' + C.points.length + ' fruits';
        $('i', $('.bar', gc)).style.width = (answered.size / C.points.length * 100) + '%';
        cooldownUntil = Date.now() + 2000;   // never stack two panels back to back
        if (player) { try { player.v.play().catch(() => {}); } catch (e) {} }
      }, () => { cooldownUntil = Date.now() + 2000; if (player) { try { player.v.play().catch(() => {}); } catch (e) {} } });
    }

    return s;
  }, { chrome: 'dark', onLeave: () => { player && player.destroy(); cancelAnimationFrame(rafId); closeSheet(); } });
}

function blossomSVG(on) {
  return on
    ? '<svg viewBox="0 0 24 24"><g fill="#fff"><circle cx="12" cy="6.5" r="3.3"/><circle cx="17.5" cy="10.5" r="3.3"/><circle cx="15.4" cy="17" r="3.3"/><circle cx="8.6" cy="17" r="3.3"/><circle cx="6.5" cy="10.5" r="3.3"/></g><circle cx="12" cy="12" r="2.4" fill="#D9A441"/></svg>'
    : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1.6"/></svg>';
}
function blossomMark(on, tone) {
  const c = tone || '#D9A441';
  return on
    ? '<svg viewBox="0 0 24 24"><g fill="' + c + '"><circle cx="12" cy="6.5" r="3.4"/><circle cx="17.5" cy="10.5" r="3.4"/><circle cx="15.4" cy="17" r="3.4"/><circle cx="8.6" cy="17" r="3.4"/><circle cx="6.5" cy="10.5" r="3.4"/></g><circle cx="12" cy="12" r="2.5" fill="#FFFDF8"/></svg>'
    : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5.2" fill="none" stroke="#DBD0BC" stroke-width="1.7"/></svg>';
}

/* ------------------------------------------------------------------ share a clip */
function shareClip(clip) {
  const line = '“' + clip.land + '” — ' + sname(clip.speaker);
  contentSheet('Share this clip', () => {
    const w = el('div', '');
    const card = el('div', 'card');
    card.style.cssText = 'background:var(--dark);color:#fff;border:0;padding:18px;border-radius:18px';
    card.innerHTML = '<div style="font-size:17px;font-weight:700;line-height:1.35;letter-spacing:-.02em">' +
        esc(clip.land) + '</div>' +
      '<div style="font-size:12.5px;color:rgba(255,255,255,.62);margin-top:11px">' +
        esc(sname(clip.speaker)) + ' · ' + esc(clip.lane) + ' · Hud-hud</div>';
    w.appendChild(card);
    const row = el('div', '');
    row.style.cssText = 'display:grid;gap:9px;margin-top:15px';
    const nat = el('button', 'cta', 'Send to someone ›');
    nat.onclick = () => {
      if (navigator.share) {
        navigator.share({ title: 'Hud-hud', text: line }).catch(() => {});
      } else { copy(line); }
      closeSheet();
    };
    const cp = el('button', 'ghost');
    cp.style.cssText = 'padding:14px;border-radius:14px;font-weight:700;font-size:14px;text-align:center';
    cp.textContent = 'Copy the line';
    cp.onclick = () => { copy(line); closeSheet(); };
    row.appendChild(nat); row.appendChild(cp);
    w.appendChild(row);
    w.appendChild(el('div', 'unf-note', 'Sharing a clip never shares your workbook or your answers.'));
    $('.unf-note', w).style.marginTop = '13px';
    return w;
  });
}
function copy(t) {
  try { navigator.clipboard && navigator.clipboard.writeText(t); } catch (e) {}
  toast('Copied');
}

/* ------------------------------------------------------------------ 03b engagement + swarm */
const PEERS = [
  ['Amina', 'Saying alḥamdulillāh at every meal.', '2 hours ago'],
  ['Yusuf', 'My mum’s health, and the time I still have with her.', 'yesterday'],
  ['Bilal', 'That I still get up for Fajr even on the bad weeks.', '3 days ago'],
  ['Hafsa', 'A teacher who never gave up on me when I had given up.', '4 days ago'],
  ['Idris', 'Being able to walk. I never once thanked Allah for it before this.', 'last week'],
];

function showEngagement(p, onShare, onSkip) {
  const KINDS = ['Question', 'Task', 'Reflection', 'Multi-choice'];
  let priv = true, shared = false;

  sheetEl.innerHTML = '';
  sheetEl.appendChild(el('div', 'grab'));
  const inr = el('div', 'sheet-in');

  const chips = el('div', 'chips');
  KINDS.forEach(k => chips.appendChild(el('span', 'chip' + (k === p.kind ? ' on' : ''), k)));
  inr.appendChild(chips);

  inr.appendChild(el('div', 'eyebrow', '❚❚ paused at ' + mmss(p.at) + (p.title ? ' · ' + esc(p.title) : '')));

  if (p.quote) {
    const qq = el('div', '', '“' + esc(p.quote) + '”');
    qq.style.cssText = 'font-size:13.5px;line-height:1.5;color:var(--text);border-left:2.5px solid var(--purple);padding:3px 0 3px 11px;margin:9px 0 0';
    inr.appendChild(qq);
  }
  if (p.arabic) {
    const ar = el('div', 'ar', esc(p.arabic));
    ar.style.cssText += ';font-size:16px;margin:10px 0 2px';
    inr.appendChild(ar);
  }

  inr.appendChild(el('p', 'q-text', esc(p.prompt)));
  inr.appendChild(el('div', 'q-src', esc(p.promptSource)));

  let ta = null, chosen = null;
  if (p.kind === 'Multi-choice' && p.options && p.options.length) {
    const opts = el('div', 'opts');
    p.options.forEach(o => {
      const b = el('button', 'opt', esc(o));
      b.onclick = () => { chosen = o; [...opts.children].forEach(x => x.classList.remove('on')); b.classList.add('on'); };
      opts.appendChild(b);
    });
    inr.appendChild(opts);
  } else {
    ta = el('textarea', 'answerbox');
    ta.id = 'ans' + p.at;
    ta.placeholder = 'Type or record…';
    inr.appendChild(ta);
  }

  const rec = el('div', 'rec-row');
  if (p.kind === 'Multi-choice') rec.style.display = 'none';
  const rb = el('button', 'recbtn', '<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z"/><path d="M6 11a6 6 0 0 0 12 0" stroke="#fff" stroke-width="1.8" fill="none"/><path d="M12 17v3" stroke="#fff" stroke-width="1.8"/></svg>');
  let recording = false, recT = 0, recTimer = 0;
  const recLbl = el('span', 'note', 'Or answer out loud — voice notes are kept the same way as text.');
  rb.onclick = () => {
    recording = !recording;
    rb.classList.toggle('rec-on', recording);
    if (recording) {
      recT = 0;
      recLbl.textContent = 'Recording  0:00';
      recTimer = setInterval(() => { recT++; recLbl.textContent = 'Recording  ' + mmss(recT); }, 1000);
    } else {
      clearInterval(recTimer);
      recLbl.textContent = 'Voice note ' + mmss(recT) + ' · ready to bank';
      if (ta) ta.placeholder = 'Voice note attached — add a note if you like';
    }
  };
  rec.appendChild(rb);
  rec.appendChild(recLbl);
  inr.appendChild(rec);

  const pv = el('div', 'privacy');
  pv.appendChild(el('span', 'lbl', 'Keep my answer private'));
  const sw = el('button', 'switch on');
  sw.appendChild(el('i'));
  sw.onclick = () => { priv = !priv; sw.classList.toggle('on', priv); sw.classList.toggle('off', !priv); renderSwarm(); };
  pv.appendChild(sw);
  inr.appendChild(pv);
  inr.appendChild(el('div', 'note', 'Private answers still bank to your workbook. Only sharing shows them to your sheikh’s team.'));

  const share = el('button', 'cta purple', 'Share my reflection');
  share.style.marginTop = '15px';
  share.onclick = () => {
    shared = true;
    USER.answers[p.at] = { text: ta ? ta.value : chosen, private: priv };
    renderSwarm();
    toast(priv ? 'Banked privately' : 'Shared with your sheikh’s team');
    setTimeout(() => { closeSheet(); onShare && onShare(); }, 620);
  };
  inr.appendChild(share);

  const swarm = el('div', 'swarm');
  inr.appendChild(swarm);
  function renderSwarm() {
    swarm.innerHTML = '';
    swarm.appendChild(el('div', 'eyebrow', 'What others said'));
    const show = shared ? PEERS : PEERS.slice(0, 2);
    show.forEach(([n, t, w]) => {
      const row = el('div', 'peer');
      const a = el('div', 'avatar sm', n[0]);
      a.style.borderColor = 'var(--purple)'; a.style.color = 'var(--purple)';
      row.appendChild(a);
      row.appendChild(el('div', 'meta', '<b>' + esc(n) + ' <span class="when">· ' + esc(w) + '</span></b><p>' + esc(t) + '</p>'));
      swarm.appendChild(row);
    });
    if (!shared) swarm.appendChild(el('div', 'locked', 'Answer to see the rest of the room.<br>' + (PEERS.length - 2) + ' more reflections on this point.'));
  }
  renderSwarm();

  sheetEl.appendChild(inr);
  openSheet(onSkip);
}

/* A plain content sheet — used by share, ask, tafsir, hadith and the year card. */
function contentSheet(title, build, opts) {
  opts = opts || {};
  sheetEl.innerHTML = '';
  sheetEl.appendChild(el('div', 'grab'));
  const inr = el('div', 'sheet-in');
  if (title) inr.appendChild(el('div', 'eyebrow', esc(title)));
  inr.appendChild(build());
  sheetEl.appendChild(inr);
  openSheet(opts.onDismiss);
}

function openSheet(onDismiss) {
  sheetEl.setAttribute('aria-hidden', 'false');
  sheetEl.classList.add('on'); scrim.classList.add('on');
  scrim.onclick = () => { closeSheet(); onDismiss && onDismiss(); };
}
function closeSheet() {
  sheetEl.classList.remove('on'); scrim.classList.remove('on');
  sheetEl.setAttribute('aria-hidden', 'true');
}

/* ------------------------------------------------------------------ course garden */
function openCourseGarden(C, answered, onJump) {
  push(() => {
    const s = el('div', '');
    s.appendChild(navbar('Course', pop));
    const head = el('div', 'card');
    head.style.cssText = 'margin:0 14px 14px;background:var(--dark);color:#fff;border:0;border-radius:20px;padding:18px';
    head.innerHTML = '<div class="eyebrow" style="color:rgba(255,255,255,.5)">My garden</div>' +
      '<div style="font-size:30px;font-weight:700;letter-spacing:-.03em;margin-top:7px">' +
        answered.size + ' of ' + C.points.length + ' fruits</div>' +
      '<div style="font-size:12.5px;color:rgba(255,255,255,.62);margin-top:5px">' +
        esc(C.partLabel) + '</div>';
    s.appendChild(head);
    s.appendChild(el('div', 'note', '<span style="padding:0 18px;display:block;line-height:1.5">Every fruit is a moment in the talk. Tap one to go back to it.</span>'));
    const list = el('div', 'list scroll-pad');
    list.style.marginTop = '12px';
    C.points.forEach(p => {
      const done = answered.has(p.at);
      const row = el('button', 'rowcard');
      const f = el('div', 'fruit' + (done ? ' on' : ''), blossomSVG(done));
      f.style.cssText += ';width:38px;height:38px;flex:0 0 auto';
      row.appendChild(f);
      row.appendChild(el('div', 'meta', '<b>' + esc(p.title) + '</b><i>' + mmss(p.at) + ' · ' + esc(p.kind) +
        (done ? ' · answered' : ' · not yet') + '</i>'));
      row.appendChild(el('span', 'startbtn', done ? 'Revisit' : 'Go'));
      row.onclick = () => { pop(); setTimeout(() => onJump && onJump(p.at), 320); };
      list.appendChild(row);
    });
    s.appendChild(list);
    return s;
  }, { chrome: 'dark' });
}

/* ------------------------------------------------------------------ the year card */
function openYearCard(mode) {
  const entries = buildWorkbook();
  contentSheet(mode === 'read' ? 'Your year, in your own words' : 'Your year', () => {
    const w = el('div', '');
    const card = el('div', '');
    card.style.cssText = 'border-radius:20px;padding:20px;color:#fff;background:var(--dusk);position:relative;overflow:hidden';
    card.innerHTML =
      '<div class="eyebrow" style="color:rgba(255,255,255,.6)">Since ' + esc(USER.since) + '</div>' +
      '<div style="font-size:40px;font-weight:700;letter-spacing:-.035em;line-height:1.05;margin-top:9px">' +
        Math.floor(USER.minutes / 60) + ' hours<br>with the ʿulamāʾ</div>' +
      '<div style="font-size:13px;color:rgba(255,255,255,.78);margin-top:12px;line-height:1.5">' +
        USER.hors.toLocaleString() + ' tastes · ' + USER.parts + ' course parts · ' +
        D.jibril.sectionsOpened + ' of ' + D.jibril.sectionsTotal + ' sections of Ḥadīth Jibrīl opened</div>' +
      '<div style="font-size:13px;color:rgba(255,255,255,.78);margin-top:6px;line-height:1.5">' +
        entries.length + ' reflections written. ' + entries.filter(e => e.private).length + ' kept private.</div>';
    w.appendChild(card);
    if (mode === 'read') {
      const l = el('div', '');
      l.style.marginTop = '16px';
      entries.slice(0, 6).forEach(e => {
        const q = el('div', '');
        q.style.cssText = 'padding:13px 0;border-bottom:1px solid var(--border)';
        q.innerHTML = '<div class="eyebrow">' + e.date + '</div>' +
          '<div style="font-size:15px;font-weight:600;color:var(--dark);line-height:1.4;margin-top:6px">“' + esc(e.a) + '”</div>';
        l.appendChild(q);
      });
      w.appendChild(l);
      w.appendChild(el('div', 'unf-note', 'Your own words, oldest first. Nothing here was scored.'));
    } else {
      const b = el('button', 'cta');
      b.style.marginTop = '15px';
      b.textContent = 'Copy this to share';
      b.onclick = () => { copy(Math.floor(USER.minutes / 60) + ' hours with the ʿulamāʾ since ' + USER.since + ' — Hud-hud'); closeSheet(); };
      w.appendChild(b);
      w.appendChild(el('div', 'unf-note', 'One number, and nothing anyone can rank you against.'));
    }
    return w;
  });
}

/* ------------------------------------------------------------------ 00 Home */
function ring(pct, value, cap, color) {
  const r = 20, c = 2 * Math.PI * r;
  const n = el('div', 'ring');
  n.innerHTML =
    '<div class="dial"><svg viewBox="0 0 46 46">' +
      '<circle class="bg" cx="23" cy="23" r="' + r + '"></circle>' +
      '<circle cx="23" cy="23" r="' + r + '" stroke="' + color + '" stroke-dasharray="' + c + '" stroke-dashoffset="' + (c * (1 - pct)) + '"></circle>' +
    '</svg><div class="val">' + esc(value) + '</div></div>' +
    '<div class="cap">' + esc(cap) + '</div>';
  return n;
}

function homeScreen() {
  const s = el('div', '');
  const nb = el('div', 'navbar');
  nb.innerHTML = '<h1>Home</h1>';
  const av = avatar('yasirfahmy', 'sm'); av.style.marginLeft = 'auto';
  nb.appendChild(av);
  s.appendChild(nb);

  // Grow banner — the way in
  const b = el('div', 'grow-banner');
  const inr = el('div', 'gb-in');
  inr.appendChild(el('div', 'eyebrow', 'Your growth'));
  inr.appendChild(el('div', 'gb-head', USER.days + ' days in, and<br>it is showing.'));
  inr.appendChild(el('div', 'gb-sub', blossomInline() + ' five ways to see it'));
  const rings = el('div', 'rings');
  const J = D.jibril, G = D.ghuniyya;
  rings.appendChild(ring(.62, '214', 'Watched', '#E8793A'));
  rings.appendChild(ring(J.sectionsOpened / J.sectionsTotal, J.sectionsOpened + '/' + J.sectionsTotal, 'Sections', '#D9A441'));
  rings.appendChild(ring(.04, (G.lit / G.denominator * 100).toFixed(1) + '%', 'Plot', '#7A4FA3'));
  rings.appendChild(ring(.45, String(D.harvest.filter(h => h.kind === 'quran').length), 'Harvest', '#1F8A84'));
  rings.appendChild(ring(.6, '18', 'Workbook', '#D8546A'));
  inr.appendChild(rings);
  const cta = el('button', 'cta', 'See how I’ve grown ›');
  cta.onclick = () => openGrow();
  inr.appendChild(cta);
  b.appendChild(inr);
  s.appendChild(b);

  // Continue
  s.appendChild(el('div', 'section-title', 'Continue'));
  const list = el('div', 'list');
  const cont = el('button', 'rowcard');
  const im = el('img', 'thumb'); im.src = thumb(D.course.videoId); imgFallback(im); cont.appendChild(im);
  cont.appendChild(el('div', 'meta', '<b>' + esc(D.course.partLabel) + '</b><i>4 min left · ' + esc(sname(D.course.speaker)) + '</i>'));
  cont.appendChild(el('span', 'startbtn', 'Resume'));
  cont.onclick = () => openMains();
  list.appendChild(cont);

  const nextClip = Pick.any();
  const na = el('button', 'rowcard');
  const im2 = el('img', 'thumb'); im2.src = thumb(nextClip.videoId); imgFallback(im2); na.appendChild(im2);
  na.appendChild(el('div', 'meta', '<b>' + esc(sname(nextClip.speaker)) + '</b><i>new appetiser · ' + esc(nextClip.lane) + '</i>'));
  na.appendChild(el('span', 'startbtn', 'Play'));
  na.onclick = () => openAppetiser(nextClip);
  list.appendChild(na);
  s.appendChild(list);

  // the feed door
  s.appendChild(el('div', 'section-title', 'Today’s table'));
  const feed = el('div', 'list scroll-pad');
  const hero = el('button', '');
  hero.style.cssText = 'width:100%;border-radius:20px;overflow:hidden;position:relative;height:188px;background:var(--dusk);text-align:left;display:block';
  const hc = REEL.find(c => c.source === 'file') || Pick.any();
  const hi = el('img'); hi.src = thumb(hc.videoId);
  hi.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.55';
  imgFallback(hi, 'var(--dusk)');
  hero.appendChild(hi);
  const ov = el('div', '', '<div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 28%,rgba(17,16,24,.86))"></div>');
  hero.appendChild(ov);
  const ht = el('div', '');
  ht.style.cssText = 'position:absolute;left:15px;right:15px;bottom:14px;color:#fff;z-index:2';
  ht.innerHTML = '<div class="pill lane" style="margin-bottom:9px">Hors d’oeuvre · 0:18</div>' +
                 '<div style="font-size:17.5px;font-weight:700;line-height:1.28;letter-spacing:-.02em">' + esc(hc.land.slice(0, 92)) + (hc.land.length > 92 ? '…' : '') + '</div>' +
                 '<div style="font-size:12px;opacity:.78;margin-top:6px">' + esc(sname(hc.speaker)) + ' · start here</div>';
  hero.appendChild(ht);
  hero.onclick = () => openHors(hc);
  feed.appendChild(hero);
  s.appendChild(feed);
  return s;
}
function blossomInline() {
  return '<svg width="12" height="12" viewBox="0 0 24 24" style="display:inline-block;vertical-align:-1px"><g fill="#D9A441"><circle cx="12" cy="6.5" r="3.4"/><circle cx="17.5" cy="10.5" r="3.4"/><circle cx="15.4" cy="17" r="3.4"/><circle cx="8.6" cy="17" r="3.4"/><circle cx="6.5" cy="10.5" r="3.4"/></g><circle cx="12" cy="12" r="2.5" fill="#2B2356"/></svg>';
}

/* ------------------------------------------------------------------ Grow hub + five pages */
function openGrow() { resetTo(growHub, { chrome: 'dark', tab: 'grow' }); }

function growHub() {
  const s = el('div', '');
  const nb = el('div', 'navbar'); nb.innerHTML = '<h1>Grow</h1>'; s.appendChild(nb);

  const pr = el('div', 'card');
  pr.style.cssText = 'margin:0 14px;background:var(--dark);border:0;color:#fff;border-radius:20px;padding:17px';
  pr.innerHTML = '<div class="eyebrow" style="color:rgba(255,255,255,.5)">Principle</div>' +
    '<p style="margin:9px 0 0;font-size:13.5px;line-height:1.55;color:rgba(255,255,255,.88)">' + esc(D.meta.principle) + '</p>';
  s.appendChild(pr);

  s.appendChild(el('div', 'section-title', 'The five'));
  const J = D.jibril, G = D.ghuniyya;
  const pages = [
    ['General', 'watched · minutes · streak', '#E8793A', growGeneral],
    ['Ḥadīth Jibrīl', J.sectionsOpened + ' of ' + J.sectionsTotal + ' sections', '#D9A441', growJibril],
    ['al-Ghūniyya', G.lit + ' of ' + G.denominator.toLocaleString() + ' cells', '#7A4FA3', growGhuniyya],
    ['Harvest', 'Qurʾān & ḥadīth met', '#1F8A84', growHarvest],
    ['Workbook', 'their answers · sheikh-visible', '#D8546A', growWorkbook],
  ];
  const list = el('div', 'list scroll-pad');
  pages.forEach(([t, sub, col, fn]) => {
    const row = el('button', 'rowcard');
    const dot = el('div', '');
    dot.style.cssText = 'width:38px;height:38px;border-radius:12px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;background:' + col + '1f';
    dot.innerHTML = '<span style="width:11px;height:11px;border-radius:50%;background:' + col + '"></span>';
    row.appendChild(dot);
    row.appendChild(el('div', 'meta', '<b>' + esc(t) + '</b><i>' + esc(sub) + '</i>'));
    row.appendChild(el('span', '', '<svg width="16" height="16" viewBox="0 0 24 24" style="stroke:#8A8499;fill:none;stroke-width:2.4;stroke-linecap:round"><path d="m9 5 7 7-7 7"/></svg>'));
    row.onclick = () => push(fn, { chrome: 'dark' });
    list.appendChild(row);
  });
  s.appendChild(list);
  return s;
}

function growGeneral() {
  const s = el('div', '');
  s.appendChild(navbar('Grow', pop));

  const big = el('div', 'bigstat');
  big.innerHTML = '<div class="eyebrow" style="color:rgba(255,255,255,.5)">Time given</div>' +
    '<div class="n">' + Math.floor(USER.minutes / 60) + 'h ' + (USER.minutes % 60) + 'm</div>' +
    '<div class="c">since ' + esc(USER.since) + '</div>';
  s.appendChild(big);

  const BANKING = {
    'Hors d’oeuvres': ['Counted here, never banked to the maps.',
      'A taste is not a sitting. They build the streak and the minutes, and they decide what you are shown next — but they do not light a section on Ḥadīth Jibrīl or a cell on al-Ghūniyya.'],
    'Appetisers': ['May bank, once the clip carries its tagging.',
      'An appetiser banks when it arrives with its āyāt, aḥādīth and its Jibrīl section attached. Until the tagging pass is done, most do not.'],
    'Course parts': ['Always bank.',
      'A finished part banks its section, its cells and everything the part passed through. This is what keeps the maps honest.'],
    'Courses done': ['Two finished, end to end.',
      'How to Live Like the Prophet ﷺ, and Allah’s Promises in the Qur’ān.'],
  };
  const g = el('div', 'statgrid'); g.style.marginTop = '11px';
  [['o', USER.hors.toLocaleString(), 'Hors d’oeuvres'], ['o', USER.appetisers, 'Appetisers'],
   ['t', USER.parts, 'Course parts'], ['t', USER.coursesDone, 'Courses done']]
   .forEach(([c, n, cap]) => {
      const cell = el('div', 'statcell ' + c);
      const head = el('div', 'unf-head');
      head.appendChild(el('div', 'hd', '<div class="n">' + n + '</div><div class="c">' + cap + '</div>'));
      cell.appendChild(head);
      unfurlable(cell, head, () => {
        const d = el('div', 'unf-detail');
        const [rule, why] = BANKING[cap];
        d.appendChild(el('div', '', '<b style="font-size:12.5px;color:var(--dark)">' + esc(rule) + '</b>'));
        d.appendChild(el('div', 'unf-note', esc(why)));
        return d;
      });
      g.appendChild(cell);
   });
  s.appendChild(g);

  const st = el('div', 'streak');
  const top = el('div', 'streak-top');
  top.innerHTML = '<b>' + USER.days + '-day streak</b><span class="note">' + USER.restDays + ' rest days kept</span>';
  st.appendChild(top);
  const wk = el('div', 'week');
  ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach((d, i) => {
    const k = USER.week[i];
    wk.appendChild(el('div', 'day' + (k === 1 ? ' on' : k === 2 ? ' rest' : ''), d));
  });
  st.appendChild(wk);
  st.appendChild(el('div', 'note', 'A missed day spends a rest day, not the streak.'));
  unfurlable(st, top, () => {
    const d = el('div', 'unf-detail');
    d.appendChild(el('div', 'unf-row', '<b>Longest</b><span>41 days, ending 3 August.</span>'));
    d.appendChild(el('div', 'unf-row', '<b>Rest days</b><span>2 of 4 still unspent this month. They refill monthly.</span>'));
    d.appendChild(el('div', 'unf-row', '<b>Broken</b><span>Never — a missed day spends a rest day first.</span>'));
    d.appendChild(el('div', 'unf-note', 'An app for people who lapse has to forgive a missed day, or it becomes another thing they failed at.'));
    return d;
  });
  s.appendChild(st);

  s.appendChild(el('div', 'section-title', 'Most returned to'));
  const mr = el('div', 'card'); mr.style.margin = '0 14px';
  USER.returned.forEach(([n, c, p]) => {
    const r = el('div', 'barrow');
    r.innerHTML = '<span class="nm">' + esc(n) + '</span><span class="tr"><i style="width:' + (p * 100) + '%"></i></span><span class="ct">' + c + ' clips</span>';
    mr.appendChild(r);
  });
  s.appendChild(mr);

  const share = el('button', 'cta');
  share.style.cssText = 'margin:18px 14px 0;width:calc(100% - 28px)';
  share.textContent = 'Share my year';
  share.onclick = () => openYearCard('share');
  s.appendChild(share);
  s.appendChild(el('div', 'scroll-pad'));
  return s;
}

function growJibril() {
  const J = D.jibril;
  const s = el('div', '');
  s.appendChild(navbar('Grow', pop));

  const head = el('div', 'card');
  head.style.cssText = 'margin:0 14px;background:rgba(217,164,65,.11);border-color:rgba(217,164,65,.4)';
  head.innerHTML = '<div style="font-size:19px;font-weight:700;color:var(--dark);letter-spacing:-.02em">' +
      J.sectionsOpened + ' of ' + J.sectionsTotal + ' sections opened</div>' +
    '<div style="font-size:12.5px;color:var(--muted);margin-top:4px">' + J.piecesOpened + ' pieces of about ' + J.piecesTotal + '</div>';
  s.appendChild(head);

  const list = el('div', ''); list.style.marginTop = '12px';
  J.branches.forEach(b => {
    const tone = { gold: '#D9A441', orange: '#E8793A', teal: '#1F8A84', purple: '#7A4FA3', rose: '#D8546A' }[b.tone];
    const c = el('div', 'branch');
    const t = el('div', 'branch-top');
    t.innerHTML = '<b>' + esc(b.branch) + '</b><span class="frac">' + b.userSections + '/' + b.sectionsTotal + '</span>';
    c.appendChild(t);
    const bl = el('div', 'blossoms');
    b.sections.forEach(sec => bl.appendChild(el('span', 'bl', blossomMark(sec.userOpened, tone))));
    c.appendChild(bl);
    c.appendChild(el('div', 'lib', b.userPieces + ' pieces here · the library holds ' +
      b.sections.reduce((a, x) => a + Math.min(x.chefs, J.perSection), 0) + ' covering places from ' +
      b.sections.reduce((a, x) => a + x.clips, 0) + ' mapped clips'));
    unfurlable(c, t, () => {
      const d = el('div', 'unf-detail');
      b.sections.forEach(sec => {
        const r = el('div', 'sec' + (sec.userOpened ? ' open' : ''));
        r.innerHTML = '<span class="n">' + sec.n + '</span><span class="lb">' + esc(sec.label.toLowerCase()) + '</span>' +
          '<span class="ch">' + (sec.chefs ? sec.chefs + ' teachers' : 'not yet') + '</span>';
        d.appendChild(r);
      });
      const names = [...new Set(b.sections.flatMap(x => x.chefNames || []))].slice(0, 5);
      if (names.length) d.appendChild(el('div', 'unf-note', 'Taught here by ' + names.map(esc).join(', ') + '.'));
      d.appendChild(el('div', 'unf-note', 'A blossom is one piece banked. An outline is one still to come.'));
      return d;
    });
    list.appendChild(c);
  });
  s.appendChild(list);

  const note = el('div', 'note');
  note.style.cssText = 'margin:4px 18px 0;line-height:1.55';
  note.innerHTML = 'Tap a branch to see its sections. Library coverage is real: <b>' + J.library.sectionsCovered + ' of ' +
    J.sectionsTotal + '</b> sections already have content across <b>' + J.library.clips.toLocaleString() + '</b> mapped clips.';
  s.appendChild(note);

  const cta = el('button', 'cta');
  cta.style.cssText = 'margin:18px 14px 0;width:calc(100% - 28px)';
  cta.textContent = 'Open the next piece ›';
  cta.onclick = () => {
    // the first section this learner has not opened that the library can actually teach
    let want = null;
    J.branches.forEach(b => b.sections.forEach(sec => {
      if (!want && !sec.userOpened && sec.chefs > 0) want = sec;
    }));
    const pool = want ? REEL.filter(c => c.clause === want.n) : [];
    toast(want ? 'Next: clause ' + want.n + ' · ' + want.label.toLowerCase() : 'Next piece');
    openHors(pool.length ? rnd(pool) : Pick.any());
  };
  s.appendChild(cta);
  s.appendChild(el('div', 'scroll-pad'));
  return s;
}

function growGhuniyya() {
  const G = D.ghuniyya;
  const s = el('div', 'dark');
  s.style.background = 'var(--night)';
  const nb = navbar('Grow', pop);
  nb.style.background = 'linear-gradient(180deg,#111018 72%,rgba(17,16,24,0))';
  $('.back', nb).style.color = '#fff';
  s.appendChild(nb);

  const p = el('div', 'plot');
  p.appendChild(el('div', 'eyebrow', 'Your plot of it'));
  p.appendChild(el('div', 'n', G.lit + ' of ' + G.denominator.toLocaleString()));
  p.appendChild(el('div', 'c', 'cells of the tradition in bloom'));
  const grid = el('div', 'grid-cells');
  const lit = new Set();
  while (lit.size < G.lit) lit.add(Math.floor(Math.random() * 216));
  for (let i = 0; i < 216; i++) grid.appendChild(el('div', 'cell' + (lit.has(i) ? (i % 3 ? ' on' : ' on g') : '')));
  p.appendChild(grid);
  p.appendChild(el('div', 'c', G.note));
  s.appendChild(p);

  const ch = el('div', 'card');
  ch.style.cssText = 'margin:12px 14px 0;background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.12);color:#fff';
  const chHead = el('div', 'unf-head');
  chHead.appendChild(el('div', 'hd',
    '<span class="pill hadith" style="background:rgba(122,79,163,.3);color:#D9C6EE">ḤADĪTH</span>' +
    '<div style="font-size:16px;font-weight:700;margin-top:10px;letter-spacing:-.015em">' + esc(G.chapter.title) + '</div>' +
    '<div style="font-size:12px;color:rgba(255,255,255,.6);margin-top:4px">' + esc(G.chapter.sub) + '</div>'));
  chHead.style.color = '#fff';
  ch.appendChild(chHead);
  unfurlable(ch, chHead, () => {
    const d = el('div', 'unf-detail on-dark');
    d.style.color = 'rgba(255,255,255,.75)';
    d.appendChild(el('div', 'unf-row', '<b style="color:#fff">Cells lit</b><span>3 of about 40 in this chapter.</span>'));
    d.appendChild(el('div', 'unf-row', '<b style="color:#fff">Where from</b><span>Part 4 · Sabr in practice, with Shaykh Yasir Fahmy.</span>'));
    d.appendChild(el('div', 'unf-note', 'One cell is one narration, chapter or masʾala. The plot fills as course parts bank — never from a hors d’oeuvre.'));
    return d;
  });
  s.appendChild(ch);

  if (G.namedSeats && G.namedSeats.length) {
    const t = el('div', 'section-title', 'Seats named on the map');
    t.style.color = 'rgba(255,255,255,.45)';
    s.appendChild(t);
    const wrap = el('div', ''); wrap.style.padding = '0 14px';
    G.namedSeats.slice(0, 4).forEach(ns => {
      const r = el('div', '');
      r.style.cssText = 'padding:11px 13px;border-radius:13px;background:rgba(255,255,255,.05);margin-bottom:8px;color:#fff';
      r.innerHTML = '<div style="font-size:12.5px;font-weight:600">' + esc(ns.seat) + '</div>' +
        '<div style="font-size:11px;color:rgba(255,255,255,.55);margin-top:3px">' + esc(ns.theme) + ' · ' + esc(sname(ns.speaker)) + '</div>';
      wrap.appendChild(r);
    });
    s.appendChild(wrap);
  }

  const cta = el('button', 'cta purple');
  cta.style.cssText = 'margin:16px 14px 0;width:calc(100% - 28px)';
  cta.textContent = 'Zoom into a chapter';
  cta.onclick = () => openChapter(G);
  s.appendChild(cta);
  s.appendChild(el('div', 'scroll-pad'));
  return s;
}

function growHarvest() {
  const s = el('div', '');
  s.appendChild(navbar('Grow', pop));
  const nq = D.harvest.filter(h => h.kind === 'quran').length;
  const nh = D.harvest.filter(h => h.kind === 'hadith').length;

  const head = el('div', 'card');
  head.style.cssText = 'margin:0 14px 12px;background:rgba(31,138,132,.1);border-color:rgba(31,138,132,.35)';
  head.innerHTML = '<div style="font-size:19px;font-weight:700;color:var(--dark);letter-spacing:-.02em">' +
      nq + ' āyāt · ' + nh + ' aḥādīth</div>' +
    '<div style="font-size:12.5px;color:var(--muted);margin-top:4px">collected without trying</div>';
  s.appendChild(head);

  D.harvest.forEach(h => {
    const c = el('div', 'harvcard');
    const top = el('div', 'hc-top');
    top.innerHTML = '<span class="pill ' + (h.kind) + '">' + esc(h.tag) + '</span>' +
      '<span class="hc-ref" style="flex:1;text-align:right">' + esc(h.ref) + '</span>';
    c.appendChild(top);
    if (h.arabic) c.appendChild(el('div', 'ar', esc(h.arabic)));
    c.appendChild(el('div', 'hc-tr', '“' + esc(h.text) + '”'));
    const met = el('div', 'hc-met');
    met.innerHTML = h.metIn
      ? 'Met in: ' + esc(h.metIn) + '<br>' + esc(h.speaker) + ' · at ' + esc(h.ts)
      : 'Met in the library' + (h.narrator ? ' · narrated by ' + esc(h.narrator) : '');
    c.appendChild(met);
    unfurlable(c, top, () => {
      const d = el('div', 'unf-detail');
      if (h.kind === 'hadith') {
        d.appendChild(el('div', 'unf-row', '<b>Collection</b><span>' + esc(h.ref) + '</span>'));
        if (h.narrator) d.appendChild(el('div', 'unf-row', '<b>Narrated by</b><span>' + esc(h.narrator) + '</span>'));
        if (h.grading) d.appendChild(el('div', 'unf-row', '<b>Grading</b><span>' + esc(h.grading) + '</span>'));
      } else {
        d.appendChild(el('div', 'unf-row', '<b>Reference</b><span>' + esc(h.ref) + '</span>'));
      }
      if (h.metIn) {
        d.appendChild(el('div', 'unf-row', '<b>You met it</b><span>in ' + esc(h.metIn) + ', with ' + esc(h.speaker) + ', at ' + esc(h.ts) + '.</span>'));
        d.appendChild(el('div', 'unf-note', 'You did not go looking for this one. It arrived inside something you were already watching.'));
      }
      const a = el('button', 'hc-act no-unfurl ' + (h.kind === 'quran' ? 'q' : 'h'), esc(h.cta));
      a.onclick = ev => {
        ev.stopPropagation();
        openMains();
        const at = h.ts ? (String(h.ts).split(':').reduce((a, b) => a * 60 + (+b), 0)) : 0;
        setTimeout(() => {
          const top = stack[stack.length - 1];
          if (top && top.node.__seek && at) top.node.__seek(Math.max(0, at - 5));
          toast(h.metIn ? 'Jumping to ' + h.ts + ' in ' + h.metIn.replace(/^.*?[-—]\s*/, '') : 'Opening the lecture');
        }, 420);
      };
      d.appendChild(a);
      return d;
    });
    s.appendChild(c);
  });

  s.appendChild(el('div', 'note', 'Grouped by sūrah, by collection, or by when you met it.'));
  $('.note', s).style.cssText = 'margin:6px 18px 0;text-align:center';
  s.appendChild(el('div', 'scroll-pad'));
  return s;
}

function growWorkbook() {
  const s = el('div', '');
  s.appendChild(navbar('Grow', pop));

  const entries = buildWorkbook();
  const head = el('div', 'card');
  head.style.cssText = 'margin:0 14px 12px;background:rgba(216,84,106,.09);border-color:rgba(216,84,106,.35)';
  head.innerHTML = '<div style="font-size:19px;font-weight:700;color:var(--dark);letter-spacing:-.02em">' +
      entries.length + ' entries · since ' + esc(USER.since) + '</div>' +
    '<div style="font-size:12.5px;color:var(--muted);margin-top:4px">Visible to your sheikh’s team</div>';
  s.appendChild(head);

  const chips = el('div', 'chips'); chips.style.padding = '0 14px 12px';
  const body = el('div', '');
  const render = mode => {
    body.innerHTML = '';
    const groups = {};
    entries.forEach(e => {
      const k = mode === 'By course' ? e.where : mode === 'By sheikh' ? e.speaker : '';
      (groups[k] = groups[k] || []).push(e);
    });
    Object.keys(groups).forEach(k => {
      if (k) body.appendChild(el('div', 'section-title', k));
      groups[k].forEach(e => body.appendChild(workbookCard(e)));
    });
  };
  ['All', 'By course', 'By sheikh'].forEach((t, i) => {
    const ch = el('button', 'chip' + (i === 0 ? ' on rose' : ''), t);
    ch.onclick = () => {
      [...chips.children].forEach(x => x.className = 'chip');
      ch.className = 'chip on rose';
      render(t);
    };
    chips.appendChild(ch);
  });
  s.appendChild(chips);
  s.appendChild(body);
  render('All');

  function workbookCard(e) {
    const c = el('div', 'wb');
    const head = el('div', 'unf-head');
    head.appendChild(el('div', 'hd', '<div class="date">' + e.date + ' · ' + e.kind + '</div>' +
      '<div class="a">“' + esc(e.a) + '”</div>'));
    c.appendChild(head);
    unfurlable(c, head, () => {
      const d = el('div', 'unf-detail');
      d.appendChild(el('div', 'qlab', 'Video question was:'));
      d.appendChild(el('div', 'q', esc(e.q)));
      const f = el('div', 'wb-foot');
      const im = el('img', 'thumb'); im.src = thumb(e.videoId); imgFallback(im); f.appendChild(im);
      f.appendChild(el('div', 'lnk', '<b>' + esc(e.where) + '</b>back to the lecture ›'));
      const p = el('span', 'pill');
      p.textContent = e.private ? 'kept private' : 'visible to your sheikh’s team';
      p.style.cssText = e.private
        ? 'background:rgba(217,164,65,.18);color:#8A6A18;flex:0 0 auto'
        : 'background:rgba(31,138,132,.15);color:#166E69;flex:0 0 auto';
      f.appendChild(p);
      d.appendChild(f);
      d.appendChild(el('div', 'unf-note', e.private
        ? 'Private is the default. You can change it on any entry, at any time, after the fact.'
        : 'Shared entries can be made private again whenever you want.'));
      const back = el('button', 'hc-act no-unfurl h');
      back.textContent = 'Back to the lecture ›';
      back.onclick = ev => { ev.stopPropagation(); openMains(); };
      d.appendChild(back);
      return d;
    });
    return c;
  }

  const cta = el('button', 'cta rose');
  cta.style.cssText = 'margin:16px 14px 0;width:calc(100% - 28px)';
  cta.textContent = 'Read my year back';
  cta.onclick = () => openYearCard('read');
  s.appendChild(cta);
  s.appendChild(el('div', 'scroll-pad'));
  return s;
}

/* Workbook entries: CMS reflection questions (real) + placeholder answers (per the board). */
const ANSWERS = [
  'My mum’s health, and the time I still have with her.',
  'My old teacher. I wrote to him this week.',
  'That I came back at all after two years away.',
  'I stopped arguing with my brother mid-sentence and just let it go.',
  'The job I did not get. I see now what it saved me from.',
  'Being able to pray standing. I never thanked Allah for it before.',
  'A neighbour who fed us for a week and never mentioned it again.',
  'I kept the fast even on the day it was hardest.',
  'That He kept the door open while I was not knocking.',
  'My daughter asking me why we pray — and me not having a good answer yet.',
  'Reading two pages a night instead of none.',
  'Forgiving someone who never apologised.',
  'The morning I woke before Fajr without an alarm.',
  'I said salaam first, properly, and meant it.',
  'That my worst year taught me more than my easiest five.',
  'Sitting with my father in silence and it being enough.',
  'I gave away the thing I actually wanted to keep.',
  'Coming back on a Tuesday, for no reason at all.',
];
const KIND_ROTA = ['REFLECTION', 'TASK', 'QUESTION', 'REFLECTION', 'MULTI-CHOICE'];
function buildWorkbook() {
  const out = [];
  const qs = D.reflectionQuestions;
  for (let i = 0; i < 18; i++) {
    const q = qs[i % qs.length];
    const v = VIDEO[q.sourceVideoId] || VIDEO[D.course.videoId];
    const day = 14 - i;
    out.push({
      date: (day > 0 ? day : 30 + day) + ' SEPT',
      kind: KIND_ROTA[i % KIND_ROTA.length],
      q: q.prompt,
      a: ANSWERS[i % ANSWERS.length],
      where: v ? v.title.replace(/^.*?[-—]\s*/, '') : D.course.partLabel,
      videoId: v ? v.id : D.course.videoId,
      private: i % 3 === 1,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ a Ghuniyya chapter */
function openChapter(G) {
  push(() => {
    const s = el('div', 'dark');
    s.style.background = 'var(--night)';
    const nb = navbar('Your plot', pop);
    nb.style.background = 'linear-gradient(180deg,#111018 72%,rgba(17,16,24,0))';
    $('.back', nb).style.color = '#fff';
    s.appendChild(nb);

    const p = el('div', 'plot');
    p.appendChild(el('div', 'eyebrow', 'Chapter'));
    p.appendChild(el('div', '', '<div style="font-size:24px;font-weight:700;letter-spacing:-.025em;margin-top:6px">' +
      esc(G.chapter.title) + '</div>'));
    p.appendChild(el('div', 'c', '3 of about 40 cells in bloom here'));
    const grid = el('div', 'grid-cells');
    grid.style.gridTemplateColumns = 'repeat(8,1fr)';
    for (let i = 0; i < 40; i++) grid.appendChild(el('div', 'cell' + (i < 3 ? ' on' : '')));
    p.appendChild(grid);
    p.appendChild(el('div', 'c', G.note));
    s.appendChild(p);

    const t = el('div', 'section-title', 'The three you have lit');
    t.style.color = 'rgba(255,255,255,.45)';
    s.appendChild(t);
    const wrap = el('div', ''); wrap.style.padding = '0 14px';
    [['Water that has changed', 'Part 4 · Sabr in practice'],
     ['What breaks wudūʾ', 'Part 4 · Sabr in practice'],
     ['Washing over a dressing', 'Part 6 · Ease as the governing spirit']].forEach(([n, where]) => {
      const r = el('button', 'rowcard');
      r.style.cssText = 'background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.1)';
      const f = el('div', 'fruit on', blossomSVG(true));
      f.style.cssText += ';flex:0 0 auto';
      r.appendChild(f);
      r.appendChild(el('div', 'meta', '<b style="color:#fff">' + esc(n) + '</b><i style="color:rgba(255,255,255,.55)">lit from ' + esc(where) + '</i>'));
      r.onclick = () => { pop(); setTimeout(() => openMains(), 320); };
      wrap.appendChild(r);
    });
    s.appendChild(wrap);
    s.appendChild(el('div', 'scroll-pad'));
    return s;
  }, { chrome: 'light', dark: true });
}

/* ------------------------------------------------------------------ Lanes + Me */
function lanesScreen() {
  const s = el('div', '');
  const nb = el('div', 'navbar'); nb.innerHTML = '<h1>Lanes</h1>'; s.appendChild(nb);
  s.appendChild(el('div', 'note', '<span style="padding:0 18px;display:block;line-height:1.5">Swipe down inside a clip to change lane. Every lane is a different table.</span>'));
  const g = el('div', 'lanegrid'); g.style.marginTop = '12px';
  LANES.forEach((l, i) => {
    const pool = byLane[l];
    const t = el('button', 'lanetile');
    const im = el('img'); im.src = thumb(pool[0].videoId);
    im.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.5';
    imgFallback(im, 'var(--dusk)');
    t.appendChild(im);
    if (i % 2) t.style.background = 'var(--oasis)';
    t.appendChild(el('b', '', esc(l)));
    t.appendChild(el('i', '', pool.length + ' clips · ' + new Set(pool.map(c => c.speaker)).size + ' teachers'));
    t.onclick = () => openHors(rnd(pool));
    g.appendChild(t);
  });
  s.appendChild(g);
  s.appendChild(el('div', 'scroll-pad'));
  return s;
}

function meScreen() {
  const s = el('div', '');
  const nb = el('div', 'navbar'); nb.innerHTML = '<h1>Me</h1>'; s.appendChild(nb);
  const h = el('div', 'me-head');
  const a = el('div', 'avatar lg', 'L'); a.style.margin = '0 auto';
  h.appendChild(a);
  h.appendChild(el('h2', '', esc(USER.name)));
  h.appendChild(el('p', '', USER.days + ' days in · since ' + esc(USER.since)));
  s.appendChild(h);

  const g = el('div', 'statgrid'); g.style.marginTop = '18px';
  [['o', USER.hors.toLocaleString(), 'Clips watched'], ['g', USER.days, 'Day streak'],
   ['t', USER.parts, 'Course parts'], ['p', '18', 'Reflections']]
   .forEach(([c, n, cap]) => g.appendChild(el('div', 'statcell ' + c, '<div class="n">' + n + '</div><div class="c">' + cap + '</div>')));
  s.appendChild(g);

  s.appendChild(el('div', 'section-title', 'Following'));
  const fl = el('div', 'list');
  const follows = USER.follows.size ? [...USER.follows] : ['yasirfahmy', 'mikaeelsmith'];
  follows.forEach(hd => {
    const r = el('button', 'rowcard');
    r.appendChild(avatar(hd));
    r.appendChild(el('div', 'meta', '<b>' + esc(sname(hd)) + '</b><i>' + esc((CREATOR[hd] || {}).shortBio || '') + '</i>'));
    r.onclick = () => openBio(hd);
    fl.appendChild(r);
  });
  s.appendChild(fl);

  s.appendChild(el('div', 'section-title', 'Settings'));
  const SETTINGS = [
    ['Answers are private by default', 'rgba(217,164,65,.16)', '#D9A441', true,
     'New answers bank to your workbook and stay yours until you share them.'],
    ['Rest days forgive a missed day', 'rgba(31,138,132,.14)', '#1F8A84', true,
     '2 left this month. A missed day spends one instead of breaking the streak.'],
    ['My sheikh’s team can read shared answers', 'rgba(216,84,106,.14)', '#D8546A', true,
     'Only the entries you chose to share. Never the private ones.'],
  ];
  SETTINGS.forEach(([t, bg, col, on, why]) => {
    const r = el('div', 'settingrow');
    const i = el('div', 'ico'); i.style.background = bg;
    i.innerHTML = '<svg viewBox="0 0 24 24" style="stroke:' + col + '"><path d="M5 12l5 5L20 7"/></svg>';
    r.appendChild(i);
    r.appendChild(el('span', '', esc(t)));
    const sw = el('button', 'switch no-unfurl' + (on ? ' on' : ' off'));
    sw.appendChild(el('i'));
    sw.style.marginLeft = 'auto';
    sw.onclick = ev => {
      ev.stopPropagation();
      const now = sw.classList.toggle('on');
      sw.classList.toggle('off', !now);
      toast(now ? 'On · ' + why : 'Off');
    };
    r.appendChild(sw);
    r.onclick = () => sw.click();          // the whole row is the control
    r.style.cursor = 'pointer';
    s.appendChild(r);
  });
  s.appendChild(el('div', 'scroll-pad'));
  return s;
}

/* ------------------------------------------------------------------ tabs */
function syncTabs(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name));
}
document.querySelectorAll('.tab').forEach(t => {
  t.onclick = () => {
    closeSheet();
    const k = t.dataset.tab;
    if (k === 'home') resetTo(homeScreen, { chrome: 'dark', tab: 'home' });
    if (k === 'lanes') resetTo(lanesScreen, { chrome: 'dark', tab: 'lanes' });
    if (k === 'grow') openGrow();
    if (k === 'me') resetTo(meScreen, { chrome: 'dark', tab: 'me' });
  };
});

/* ------------------------------------------------------------------ boot */
const c = D.meta.counts;
$('#snCounts').innerHTML =
  '<div><b>' + c.canonClips.toLocaleString() + '</b> editorially-mapped clips</div>' +
  '<div><b>' + c.reelClips + '</b> in the reel across <b>' + LANES.length + '</b> lanes</div>' +
  '<div><b>' + c.playableVideos + '</b> real HLS streams from Hearts CMS</div>' +
  '<div><b>' + c.quran + '</b> āyāt · <b>' + c.hadith + '</b> aḥādīth with real provenance</div>';

resetTo(homeScreen, { chrome: 'dark', tab: 'home' });
window.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSheet(); pop(); } });

})();
