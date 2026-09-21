import os, threading, http.server, socketserver, functools
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/pw-browsers")
from playwright.sync_api import sync_playwright
import sys as _s, os as _o
_s.path.insert(0,_o.path.dirname(_o.path.abspath(__file__)))
from onboard import onboard, to_mains
ROOT, PORT = "/home/user/heartshigh/app", 8768
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT))
threading.Thread(target=httpd.serve_forever, daemon=True).start()

DEVICES = [("Android small",360,640),("iPhone SE",375,667),("iPhone 14",390,844),
           ("iPhone 14 Plus",428,926),("Pixel 7",412,915),("iPad portrait",768,1024)]
SCREENS = [("home", None), ("hors", "hero"), ("mains","continue"), ("grow","grow"),
           ("jibril","jibril"), ("harvest","harvest"), ("workbook","workbook"), ("lanes","lanes")]
errs=[]
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args=["--no-sandbox"])
    print("%-16s %-10s %-8s %-9s %-26s %s" % ("device","screen","overflow","tabbar","cta/bottom-element","tap<44px"))
    for name,w,h in DEVICES:
        pg = b.new_page(viewport={"width":w,"height":h}, has_touch=True, is_mobile=True)
        pg.set_default_timeout(20000)
        pg.on("pageerror", lambda e: errs.append("%s: %s" % (name, e)))
        pg.goto("http://127.0.0.1:%d/index.html" % PORT, wait_until="domcontentloaded")
        pg.wait_for_timeout(700)
        onboard(pg)

        def probe(label):
            ov = pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1")
            # is any primary CTA hidden behind the tab bar?
            info = pg.evaluate("""() => {
              const tb = document.querySelector('.tabbar').getBoundingClientRect();
              const vis = [...document.querySelectorAll('.screen')].filter(n=>n.style.display!=='none').pop();
              if(!vis) return {ok:true, note:'no screen'};
              const cta = vis.querySelector('.cta, .cc-body .cta');
              let note='none', ok=true;
              if (cta) { const r = cta.getBoundingClientRect();
                 // a fixed-position CTA must sit clear of the bar; scrollable ones are fine
                 const fixedish = !!cta.closest('.cc-body');
                 note = Math.round(r.bottom) + ' vs bar ' + Math.round(tb.top);
                 if (fixedish && r.bottom > tb.top + 1) ok=false; }
              return {ok, note};
            }""")
            small = pg.evaluate("""() => {
              const vis=[...document.querySelectorAll('.screen')].filter(n=>n.style.display!=='none').pop();
              const btns=[...(vis?vis.querySelectorAll('button'):[]), ...document.querySelectorAll('.tab')];
              return btns.filter(b=>{const r=b.getBoundingClientRect();
                return r.width>0 && (r.height<38 || r.width<38);}).length;
            }""")
            tb = pg.evaluate("Math.round(document.querySelector('.tabbar').getBoundingClientRect().height)")
            print("%-16s %-10s %-8s %-9s %-26s %s" % (name, label, "YES!" if ov else "no",
                  str(tb)+"px", ("OK " if info["ok"] else "CLIPPED ")+info["note"], small))

        probe("home")
        probe("hors")                                  # home is the reel
        to_mains(pg); probe("mains")
        pg.eval_on_selector('[data-tab=grow]',"b=>b.click()"); pg.wait_for_timeout(600); probe("grow")
        for i,lab in [(1,"jibril"),(3,"harvest"),(4,"workbook")]:
            pg.eval_on_selector_all(".rowcard","(e,i)=>e[i].click()",i); pg.wait_for_timeout(700); probe(lab)
            pg.eval_on_selector(".navbar .back","b=>b.click()"); pg.wait_for_timeout(500)
        pg.eval_on_selector('[data-tab=lanes]',"b=>b.click()"); pg.wait_for_timeout(600); probe("lanes")
        if name=="iPhone 14":
            pg.eval_on_selector('[data-tab=home]',"b=>b.click()"); pg.wait_for_timeout(500)
            pg.eval_on_selector('[data-tab=home]',"b=>b.click()"); pg.wait_for_timeout(800)
            pg.screenshot(path="/tmp/claude-0/-home-user-heartshigh/3f25a5bb-9a14-5bb7-aeb3-0ad20b981de1/scratchpad/shots/14-iphone14-hors.png")
        pg.close()
    b.close()
print("\nPAGE ERRORS:", len(errs))
for e in errs[:8]: print("  ", e[:140])
