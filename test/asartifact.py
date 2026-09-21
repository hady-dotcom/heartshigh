"""Run the page exactly as the published artifact runs it: artifact.html, the artifact
wrapper's own reset, no external network at all. Then click the arrows and LOOK."""
import os, threading, http.server, socketserver, functools, sys
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH","/opt/pw-browsers")
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from onboard import onboard
ROOT, PORT = "/home/user/heartshigh/app", 8851
SC = "/tmp/claude-0/-home-user-heartshigh/3f25a5bb-9a14-5bb7-aeb3-0ad20b981de1/scratchpad/shots"
os.makedirs(SC, exist_ok=True)
socketserver.TCPServer.allow_reuse_address = True
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        if self.path == "/artifact-wrapped.html":
            page = open(ROOT + "/artifact.html").read()
            # byte-for-byte the shell the artifact service wraps around the file
            shell = ('<!doctype html><html><head><meta charset=utf8>'
                '<meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
                '<style>:root{color-scheme:light;box-sizing:border-box;'
                'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
                'html{scroll-padding-top:env(safe-area-inset-top,0px)}'
                'body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;'
                'background:#faf9f5;color:#141413}img{max-width:100%}'
                '[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>\n'
                + page + '\n</body></html>')
            b = shell.encode()
            self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b); return
        try: return super().do_GET()
        except (BrokenPipeError, ConnectionResetError): pass
httpd = socketserver.TCPServer(("127.0.0.1", PORT), functools.partial(H, directory=ROOT))
threading.Thread(target=httpd.serve_forever, daemon=True).start()

fails = []
def check(n, ok, d=""):
    print("   %-52s %s %s" % (n, "PASS" if ok else "FAIL", d))
    if not ok: fails.append(n)

READ = """(()=>{
  const cs=[...document.querySelectorAll('.cardclip.slide')];
  if(!cs.length) return {n:0};
  const card=cs[cs.length-1], r=card.getBoundingClientRect();
  const beats=[...card.querySelectorAll('.beat')].map(e=>{const b=e.getBoundingClientRect(),
    st=getComputedStyle(e); return {t:(e.textContent||'').trim().slice(0,28), o:+st.opacity,
      w:Math.round(b.width), h:Math.round(b.height), disp:st.display, vis:st.visibility};});
  const seen=beats.filter(b=>b.o>0.5 && b.w>0 && b.h>0 && b.t);
  return {n:cs.length, id:card.__clip&&card.__clip.id, cardW:Math.round(r.width), cardH:Math.round(r.height),
          beats, legible:seen.length, firstText:(seen[0]||{}).t||null};
})()"""

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
        args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"])
    ctx = b.new_context(viewport={"width":390,"height":844}, has_touch=True, is_mobile=True,
                        device_scale_factor=3)
    # the artifact's reality: nothing external resolves
    ctx.route("**://**", lambda r: r.abort() if "127.0.0.1" not in r.request.url else r.continue_())
    pg = ctx.new_page(); pg.set_default_timeout(30000)
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    # Blocked fonts and a blocked CDN are the point of this test, not a failure.
    def onconsole(m):
        if m.type == "error" and "Failed to load resource" not in m.text:
            errs.append("console: " + m.text)
    pg.on("console", onconsole)
    pg.goto("http://127.0.0.1:%d/artifact-wrapped.html" % PORT, wait_until="domcontentloaded")
    pg.wait_for_timeout(2500)
    pg.screenshot(path=SC+"/80-artifact-welcome.png")
    onboard(pg); pg.wait_for_timeout(1200)
    st = pg.evaluate(READ)
    print("   opening slide:", {k: st[k] for k in ("n","id","cardW","cardH","legible","firstText") if k in st})
    check("a slide is on screen", st.get("n") == 1)
    check("the card has real size", st.get("cardW",0) > 200 and st.get("cardH",0) > 300,
          "%sx%s" % (st.get("cardW"), st.get("cardH")))
    check("something is legible on it", st.get("legible",0) >= 1, str(st.get("beats"))[:200])
    pg.screenshot(path=SC+"/81-artifact-slide.png")

    pg.evaluate("""()=>{window.__NAV=[]; window.__CLICK=[];
      document.addEventListener('hudhud:nav', e=>window.__NAV.push(e.detail), true);
      document.addEventListener('click', e=>window.__CLICK.push(
        (e.target.className||'')+'#'+(e.target.tagName)), true);}""")
    print("\n== the arrows")
    for d in ("right","left","down","right","left"):
        before = pg.evaluate(READ)
        hit = pg.evaluate("""(()=>{const a=[...document.querySelectorAll('.cardclip.slide')].pop()
            .querySelector('.sl-arrow.%s'); if(!a) return null; const r=a.getBoundingClientRect();
            return {x:r.x+r.width/2, y:r.y+r.height/2, w:Math.round(r.width), h:Math.round(r.height)}})()""" % d)
        if not hit: check("%s arrow exists" % d, False); continue
        pg.mouse.click(hit["x"], hit["y"])          # a real tap, not a JS click
        pg.wait_for_timeout(250)
        mid = pg.evaluate(READ)
        pg.wait_for_timeout(450)
        after = pg.evaluate(READ)
        print("      deck:", pg.evaluate("""(()=>{const w=document.querySelector('.deck');
          return {kids:[...w.children].map(c=>({cls:c.className.slice(0,22), tr:c.style.transform,
            x:Math.round(c.getBoundingClientRect().x), tn:c.style.transition}))}})()"""))
        print("      hit:", hit, "| scroll:", pg.evaluate("[scrollY, innerHeight, document.documentElement.scrollHeight, document.activeElement.className]"))
        print("      nav events:", pg.evaluate("window.__NAV.slice(-3)"),
              "| clicks:", pg.evaluate("window.__CLICK.slice(-2)"),
              "| elementFromPoint:", pg.evaluate("(()=>{const e=document.elementFromPoint(%f,%f);return e?(e.className+'#'+e.tagName):null})()" % (hit["x"], hit["y"])))
        ok = after.get("id") != before.get("id") and mid.get("legible",0) >= 1 and after.get("legible",0) >= 1
        check("tap %-5s gives a new, legible slide" % d, ok,
              "%s -> %s | legible mid=%s after=%s | hit %sx%s" %
              (before.get("id"), after.get("id"), mid.get("legible"), after.get("legible"), hit["w"], hit["h"]))
    pg.screenshot(path=SC+"/82-artifact-after-arrows.png")
    check("no errors", not errs, "; ".join(errs[:3]))
    b.close()
print("\nFAIL=%d" % len(fails))
sys.exit(1 if fails else 0)
