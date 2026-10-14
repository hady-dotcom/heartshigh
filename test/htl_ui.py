"""Hook / turn / land editor: timeline chips, kinetic preview, feed choice.

Screenshots at 1280x800 and 390x844 of the chips and the preview playing.
"""
import os, threading, http.server, socketserver, functools, shutil
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/pw-browsers")
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app"))
SHOTS = os.environ.get("HTL_SHOTS", "/tmp/htl-shots")
os.makedirs(SHOTS, exist_ok=True)
PORT = 8877

class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), functools.partial(H, directory=ROOT))
threading.Thread(target=httpd.serve_forever, daemon=True).start()

CHROME = os.environ.get("CHROME") or "/usr/local/bin/google-chrome"
errs = []
fails = []

def check(name, cond, extra=""):
    print(("  ok  " if cond else "  FAIL ") + name + ((" — " + extra) if extra and not cond else ""))
    if not cond:
        fails.append(name)

GEOM = """sel => {
  const e = document.querySelector(sel);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return {x: r.x, y: r.y, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight,
          t: (e.innerText || '').slice(0, 80)};
}"""

def in_view(b):
    if not b or b["w"] < 20 or b["h"] < 16: return False
    return b["x"] >= -1 and b["y"] >= -1 and b["x"] + b["w"] <= b["vw"] + 2 and b["y"] + b["h"] <= b["vh"] + 2

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROME, args=[
        "--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"])

    def open_editor(pg, clip="local-mikaeel"):
        pg.add_init_script("try{localStorage.clear()}catch(e){}")
        pg.goto("http://127.0.0.1:%d/index.html#/edit/%s" % (PORT, clip), wait_until="domcontentloaded")
        pg.wait_for_selector("[data-htl-timeline]", timeout=15000)
        pg.wait_for_function(
            "() => { const s=document.querySelector('.htl-stage'); return s && Number(s.dataset.t||0) > 0.4 && s.dataset.playing==='1'; }",
            timeout=8000)

    def shot(pg, name):
        path = os.path.join(SHOTS, name)
        pg.screenshot(path=path)
        print("  shot", path)
        return path

    print("== desktop 1280x800")
    pg = b.new_page(viewport={"width": 1280, "height": 800})
    pg.set_default_timeout(20000)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    open_editor(pg)
    chips = [pg.evaluate(GEOM, "[data-htl-chip='%s']" % r) for r in ("hook", "turn", "land")]
    preview = pg.evaluate(GEOM, "[data-htl-preview]")
    for role, box in zip(("hook", "turn", "land"), chips):
        check("desktop %s chip is on screen" % role, in_view(box), str(box))
    check("desktop chips run Hook then Turn then Land",
          chips[0]["x"] < chips[1]["x"] < chips[2]["x"], str([(c["x"], c["t"]) for c in chips]))
    check("desktop preview is on screen and playing",
          in_view(preview) and pg.evaluate("document.querySelector('.htl-stage').dataset.playing==='1'"),
          str(preview))
    t1 = float(pg.evaluate("document.querySelector('.htl-stage').dataset.t"))
    pg.wait_for_timeout(700)
    t2 = float(pg.evaluate("document.querySelector('.htl-stage').dataset.t"))
    check("desktop preview clock advances", t2 > t1, "%s -> %s" % (t1, t2))
    check("desktop kinetic line is visible",
          pg.evaluate("""() => {
            const w = document.querySelector('.htl-stage .htl-word.on');
            if (!w) return false;
            const r = w.getBoundingClientRect();
            const s = getComputedStyle(w);
            return r.width > 4 && r.height > 4 && Number(s.opacity) > 0.5;
          }"""))
    shot(pg, "htl_desktop_1280_timeline_preview.png")

    print("== trim, window warning, style")
    long_id = pg.evaluate("""() => {
      const all = [HUDHUD.appetiserHero, ...HUDHUD.reel];
      const c = all.find(x => HTL.wordCount(x.turn) > 30);
      return c.id;
    }""")
    pg.goto("http://127.0.0.1:%d/index.html#/edit/%s" % (PORT, long_id), wait_until="domcontentloaded")
    pg.wait_for_selector("[data-htl-warn]", timeout=15000)
    before = pg.evaluate("HTL.wordCount(document.querySelector('[data-htl-text=turn]').value)")
    original = pg.evaluate("document.querySelector('[data-htl-text=turn]').value")
    check("long turn warns", before > 30 and pg.evaluate("""() => {
      return [...document.querySelectorAll('[data-htl-warn] .htl-note')].some(n => n.dataset.code==='long');
    }"""), "words %s" % before)
    pg.click("[data-htl-trim=turn]")
    pg.wait_for_timeout(200)
    after_text = pg.evaluate("document.querySelector('[data-htl-text=turn]').value")
    after = pg.evaluate("HTL.wordCount(document.querySelector('[data-htl-text=turn]').value)")
    check("trim to sentence shortens the turn", after <= 25 and after < before and after_text in original,
          "%s words: %s" % (after, after_text[:70]))
    chips = [pg.evaluate(GEOM, "[data-htl-chip='%s']" % r) for r in ("hook", "turn", "land")]
    check("trimmed chips stay in Hook-Turn-Land order", chips[0]["x"] < chips[1]["x"] < chips[2]["x"])
    pg.fill("[data-htl-time=land-out]", "40")
    pg.wait_for_timeout(150)
    check("window warning when a beat leaves the clip",
          pg.evaluate("""() => [...document.querySelectorAll('[data-htl-warn] .htl-note')].some(n => n.dataset.code==='contain')"""))

    print("== phone 390x844")
    ph = b.new_page(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True, device_scale_factor=2)
    ph.set_default_timeout(20000)
    ph.on("pageerror", lambda e: errs.append("phone " + str(e)))
    open_editor(ph)
    chips = [ph.evaluate(GEOM, "[data-htl-chip='%s']" % r) for r in ("hook", "turn", "land")]
    preview = ph.evaluate(GEOM, "[data-htl-preview]")
    for role, box in zip(("hook", "turn", "land"), chips):
        check("phone %s chip is on screen" % role, in_view(box), str(box))
    check("phone chips run Hook then Turn then Land",
          chips[0]["x"] < chips[1]["x"] < chips[2]["x"])
    check("phone preview is on screen", in_view(preview), str(preview))
    check("phone preview is playing a line",
          ph.evaluate("""() => {
            const s = document.querySelector('.htl-stage');
            const w = s && s.querySelector('.htl-word.on');
            return !!(s && s.dataset.playing==='1' && Number(s.dataset.t) > 0.3 && w && w.getBoundingClientRect().height > 4);
          }"""))
    shot(ph, "htl_phone_390_timeline_preview.png")

    print("== review page has the same card")
    ph.goto("http://127.0.0.1:%d/index.html#/review" % PORT, wait_until="domcontentloaded")
    ph.wait_for_selector("[data-htl-timeline]", timeout=15000)
    check("review shows timeline chips",
          ph.evaluate("document.querySelectorAll('[data-htl-chip]').length===3"))
    check("review shows the preview",
          in_view(ph.evaluate(GEOM, "[data-htl-preview]")) or ph.evaluate("""() => {
            const e = document.querySelector('[data-htl-preview]');
            const r = e.getBoundingClientRect();
            return r.width > 40 && r.height > 40;
          }"""))

    print("== saved choice changes the learner feed")
    pg.goto("http://127.0.0.1:%d/index.html#/edit/local-mikaeel" % PORT, wait_until="domcontentloaded")
    pg.wait_for_selector("[data-style=windows]", timeout=15000)
    pg.click("[data-style=windows]")
    pg.click("[data-bg=mask]")
    pg.click("[data-mask=arch]")
    pg.click("[data-delivery=kinetic]")
    pg.click("[data-htl-save]")
    pg.click("[data-htl-feed]")
    pg.wait_for_selector(".cardclip", timeout=10000)
    pg.wait_for_timeout(600)
    feed = pg.evaluate("""() => {
      const c = document.querySelector('.cardclip');
      const line = c && c.querySelector('.htl-line-hook .htl-line-body');
      return {delivery: c && c.dataset.delivery, style: c && c.dataset.style, bg: c && c.dataset.bg,
              mask: c && c.querySelector('.htl-stage') && c.querySelector('.htl-stage').dataset.mask,
              text: line ? line.innerText : '', playing: c && c.querySelector('.htl-stage') && c.querySelector('.htl-stage').dataset.playing};
    }""")
    check("feed honours kinetic windows + mask",
          feed["delivery"] == "kinetic" and feed["style"] == "windows" and feed["bg"] == "mask" and feed["mask"] == "arch",
          str(feed))
    check("feed kinetic card speaks the hook", "beautiful" in (feed["text"] or "").lower(), str(feed))

    pg.goto("http://127.0.0.1:%d/index.html#/edit/local-mikaeel" % PORT, wait_until="domcontentloaded")
    pg.wait_for_selector("[data-delivery=video]", timeout=15000)
    pg.click("[data-delivery=video]")
    pg.click("[data-htl-save]")
    pg.click("[data-htl-feed]")
    pg.wait_for_selector(".cardclip video", timeout=10000)
    video = pg.evaluate("""() => {
      const c = document.querySelector('.cardclip');
      const v = c && c.querySelector('video');
      return {delivery: c.dataset.delivery, quote: !!c.querySelector('.cc-quote'),
              kinetic: !!c.querySelector('.htl-lines'), src: v && (v.currentSrc||v.src||'').split('/').pop()};
    }""")
    check("feed honours the video clip, burned-in captions left alone",
          video["delivery"] == "video" and video["quote"] is False and video["kinetic"] is False and "mikaeel" in (video["src"] or ""),
          str(video))

    # a non-burned clip keeps the existing land caption when sent as video
    other = pg.evaluate("""() => HUDHUD.reel.find(c => c.land && !c.burnedIn).id""")
    land = pg.evaluate("""id => HUDHUD.reel.find(c => c.id===id).land""", other)
    pg.evaluate("""id => { HTL.save(id, Object.assign(HTL.draft(HUDHUD.reel.find(c => c.id===id)), {delivery:'video'})); }""", other)
    pg.evaluate("""id => HUDHUD_UI.openHors(HUDHUD.reel.find(c => c.id===id))""", other)
    pg.wait_for_timeout(400)
    shown = pg.evaluate("""() => {
      const q = document.querySelector('.cardclip .cc-quote');
      return q ? q.innerText : '';
    }""")
    check("video hors d'oeuvre keeps the existing caption", land[:24] in shown, shown[:80])

    pg.evaluate("localStorage.removeItem('hudhud.htl.v1')")
    pg.evaluate("HUDHUD_UI.openHors(HUDHUD.reel[0])")
    pg.wait_for_timeout(300)
    check("unsaved hors d'oeuvres stay on the existing slides",
          pg.evaluate("""() => !!document.querySelector('.cardclip.slide .sl-bubble, .cardclip.slide .sl-cine-hook, .cardclip.slide .sl-card') && !document.querySelector('.htl-feed')"""))

    b.close()

print("PAGE ERRORS:", len(errs))
for e in errs[:8]:
    print(" ", e[:200])
if fails or errs:
    raise SystemExit(1)
print("all ui checks passed")
