import os, threading, http.server, socketserver, functools
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH","/opt/pw-browsers")
from playwright.sync_api import sync_playwright
import sys as _s, os as _o
_s.path.insert(0,_o.path.dirname(_o.path.abspath(__file__)))
from onboard import onboard
ROOT,PORT="/home/user/heartshigh/app",8795
socketserver.TCPServer.allow_reuse_address=True
httpd=socketserver.TCPServer(("127.0.0.1",PORT),functools.partial(http.server.SimpleHTTPRequestHandler,directory=ROOT))
threading.Thread(target=httpd.serve_forever,daemon=True).start()
AUDIT = """() => {
  const vis=[...document.querySelectorAll('.screen')].filter(n=>n.style.display!=='none').pop();
  const scope = vis || document;
  const out=[];
  scope.querySelectorAll('button, .rowcard, .settingrow, .wb-foot .lnk, .lanetile').forEach(b=>{
    const r=b.getBoundingClientRect(); if(!r.width) return;
    const wired = !!(b.onclick || b.__wired || b.closest('.unfurlable'));
    out.push({t:(b.textContent||'').trim().slice(0,32), cls:b.className.split(' ')[0], wired});
  });
  return out;
}"""
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args=["--no-sandbox"])
    pg=b.new_page(viewport={"width":390,"height":844},has_touch=True,is_mobile=True); pg.set_default_timeout(20000)
    pg.goto("http://127.0.0.1:%d/index.html"%PORT,wait_until="domcontentloaded"); pg.wait_for_timeout(800)
    onboard(pg, 'home')
    def report(label):
        rows=pg.evaluate(AUDIT)
        dead=[r for r in rows if not r["wired"]]
        print("%-12s %2d buttons, %2d with no handler" % (label, len(rows), len(dead)))
        for d in dead: print("      DEAD  .%-14s %s" % (d["cls"], d["t"]))
    report("hors")                                    # home IS the reel now
    pg.eval_on_selector(".cardclip.slide:last-of-type .sl-cta","b=>b.click()")
    pg.wait_for_timeout(1300); report("appetiser")
    if pg.query_selector(".biolink"):
        pg.eval_on_selector_all(".biolink","e=>e[0].click()"); pg.wait_for_timeout(800); report("bio")
        pg.eval_on_selector(".navbar .back, .hero .back","b=>b.click()"); pg.wait_for_timeout(500)
    pg.eval_on_selector(".cta","b=>b.click()"); pg.wait_for_timeout(2600); report("mains")
    pg.evaluate("()=>{const sc=document.querySelector('#scrim'); sc&&sc.classList.contains('on')&&sc.click();}")
    pg.wait_for_timeout(400)
    pg.eval_on_selector('[data-tab=grow]',"b=>b.click()"); pg.wait_for_timeout(600); report("grow hub")
    for i,nm in [(0,"general"),(1,"jibril"),(2,"ghuniyya"),(3,"harvest"),(4,"workbook")]:
        pg.eval_on_selector_all(".rowcard","(e,i)=>e[i].click()",i); pg.wait_for_timeout(700); report(nm)
        pg.eval_on_selector(".navbar .back","b=>b.click()"); pg.wait_for_timeout(500)
    pg.eval_on_selector('[data-tab=me]',"b=>b.click()"); pg.wait_for_timeout(600); report("me")
    b.close()
