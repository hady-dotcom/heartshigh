import os, threading, http.server, socketserver, functools
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH","/opt/pw-browsers")
from playwright.sync_api import sync_playwright
ROOT,PORT="/home/user/heartshigh/app",8790
socketserver.TCPServer.allow_reuse_address=True
httpd=socketserver.TCPServer(("127.0.0.1",PORT),functools.partial(http.server.SimpleHTTPRequestHandler,directory=ROOT))
threading.Thread(target=httpd.serve_forever,daemon=True).start()
SHOT="/tmp/claude-0/-home-user-heartshigh/3f25a5bb-9a14-5bb7-aeb3-0ad20b981de1/scratchpad/shots"
errs=[]
def H(pg): return "(()=>{const s=[...document.querySelectorAll('.screen')].filter(n=>n.style.display!=='none');return s[s.length-1]})()"
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args=["--no-sandbox"])
    pg=b.new_page(viewport={"width":390,"height":844},device_scale_factor=2,has_touch=True,is_mobile=True)
    pg.set_default_timeout(20000); pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto("http://127.0.0.1:%d/index.html"%PORT,wait_until="domcontentloaded"); pg.wait_for_timeout(900)

    print("== UNFURL on each Grow page")
    pg.eval_on_selector('[data-tab=grow]',"b=>b.click()"); pg.wait_for_timeout(600)
    pages=[(0,"general"),(1,"jibril"),(2,"ghuniyya"),(3,"harvest"),(4,"workbook")]
    for i,nm in pages:
        pg.eval_on_selector_all(".rowcard","(e,i)=>e[i].click()",i); pg.wait_for_timeout(700)
        n_unf = pg.evaluate("%s.querySelectorAll('.unfurlable').length"%H(pg))
        n_chev= pg.evaluate("%s.querySelectorAll('.chev').length"%H(pg))
        # open the first two and measure that the detail actually gains height
        before = pg.evaluate("(()=>{const c=%s.querySelector('.unfurlable');return c?Math.round(c.getBoundingClientRect().height):0})()"%H(pg))
        pg.evaluate("%s.querySelector('.unfurlable').click()"%H(pg)); pg.wait_for_timeout(600)
        after  = pg.evaluate("(()=>{const c=%s.querySelector('.unfurlable');return c?Math.round(c.getBoundingClientRect().height):0})()"%H(pg))
        opened = pg.evaluate("%s.querySelectorAll('.is-open').length"%H(pg))
        print("   %-10s unfurlable=%-3d chev=%-3d  height %d -> %d  %s" %
              (nm, n_unf, n_chev, before, after, "GREW" if after>before+10 else "NO CHANGE"))
        pg.screenshot(path=SHOT+"/30-unfurl-%s.png"%nm)
        pg.eval_on_selector(".navbar .back","b=>b.click()"); pg.wait_for_timeout(500)

    print("== YOUTUBE clips present in the reel")
    yt = pg.evaluate("window.HUDHUD.reel.filter(c=>c.source==='youtube').length")
    tot= pg.evaluate("window.HUDHUD.reel.length")
    print("   %d of %d reel clips are YouTube-backed" % (yt,tot))
    print("   sample:", pg.evaluate("(()=>{const c=window.HUDHUD.reel.find(c=>c.source==='youtube');return c.youtube+' @'+c.start+'s ('+c.len+'s) '+c.land.slice(0,50)})()"))

    print("== ENGAGEMENT: clip-grounded question")
    pg.eval_on_selector('[data-tab=home]',"b=>b.click()"); pg.wait_for_timeout(500)
    pg.eval_on_selector_all(".list .rowcard","e=>e[0].click()"); pg.wait_for_timeout(1100)
    print("   dots:", pg.evaluate("%s.querySelectorAll('.tl-dot').length"%H(pg)))
    pg.eval_on_selector_all(".tl-dot","e=>e[0].click()"); pg.wait_for_timeout(800)
    print("   title :", pg.eval_on_selector(".sheet .eyebrow","e=>e.textContent"))
    print("   quote :", (pg.eval_on_selector(".sheet .unf-detail, .sheet div[style*='border-left']","e=>e.textContent") or "")[:80])
    print("   prompt:", (pg.eval_on_selector(".q-text","e=>e.textContent") or "")[:90])
    print("   source:", pg.eval_on_selector(".q-src","e=>e.textContent"))
    pg.screenshot(path=SHOT+"/31-engagement-grounded.png")
    # multi-choice point
    pg.evaluate("document.querySelector('#scrim').click()"); pg.wait_for_timeout(500)
    idx = pg.evaluate("window.HUDHUD.course.points.findIndex(p=>p.kind==='Multi-choice')")
    if idx>=0:
        pg.eval_on_selector_all(".tl-dot","(e,i)=>e[i].click()",idx); pg.wait_for_timeout(800)
        print("   multi-choice options:", pg.eval_on_selector_all(".sheet .opt","e=>e.map(x=>x.textContent)"))
        pg.screenshot(path=SHOT+"/32-multichoice.png")
    b.close()
print("PAGE ERRORS:",len(errs),errs[:3])
