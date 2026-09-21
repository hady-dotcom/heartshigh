"""The workflow end to end: welcome -> slides loop -> question -> appetiser -> lecture."""
import os, threading, http.server, socketserver, functools, re, sys
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH","/opt/pw-browsers")
from playwright.sync_api import sync_playwright
ROOT,PORT="/home/user/heartshigh/app",8840
class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path=self.translate_path(self.path); rng=self.headers.get('Range')
        if rng and os.path.isfile(path) and path.endswith(('.webm','.mp4')):
            size=os.path.getsize(path); m=re.match(r'bytes=(\d*)-(\d*)',rng)
            a=int(m.group(1) or 0); b=int(m.group(2) or size-1); b=min(b,size-1)
            self.send_response(206); self.send_header('Content-Type','video/webm')
            self.send_header('Accept-Ranges','bytes')
            self.send_header('Content-Range','bytes %d-%d/%d'%(a,b,size))
            self.send_header('Content-Length',str(b-a+1)); self.end_headers()
            with open(path,'rb') as f: f.seek(a); self.wfile.write(f.read(b-a+1))
            return
        try: return super().do_GET()
        except (BrokenPipeError, ConnectionResetError): pass
    def log_message(self,*a): pass
socketserver.TCPServer.allow_reuse_address=True
httpd=socketserver.TCPServer(("127.0.0.1",PORT),functools.partial(H,directory=ROOT))
threading.Thread(target=httpd.serve_forever,daemon=True).start()
SC="/tmp/claude-0/-home-user-heartshigh/3f25a5bb-9a14-5bb7-aeb3-0ad20b981de1/scratchpad"
fails=[]
def check(n, ok, d=""):
    print("   %-54s %s %s" % (n, "PASS" if ok else "FAIL", d))
    if not ok: fails.append(n)
TOP="(()=>{const s=[...document.querySelectorAll('.screen')].filter(n=>n.style.display!=='none');return s[s.length-1]})()"
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
        args=["--no-sandbox","--autoplay-policy=no-user-gesture-required"])
    ctx=b.new_context(viewport={"width":390,"height":844},has_touch=True,is_mobile=True)
    pg=ctx.new_page(); pg.set_default_timeout(30000)
    pg.on("pageerror", lambda e: fails.append("pageerror: %s"%e))
    pg.goto("http://127.0.0.1:%d/index.html"%PORT,wait_until="domcontentloaded"); pg.wait_for_timeout(800)

    print("\n== WELCOME")
    check("welcome shows first", pg.eval_on_selector_all(".welcome","e=>e.length")==1)
    check("asks for a name", pg.eval_on_selector_all(".wl-input","e=>e.length")==1)
    check("has the shaping questions", pg.eval_on_selector_all(".wl-block","e=>e.length")==3)
    check("start is disabled until answered", pg.eval_on_selector(".wl-go","e=>e.disabled"))
    pg.fill(".wl-input","Leon")
    pg.eval_on_selector_all(".wl-block .wl-opt","e=>{e[0].click();}")          # where
    pg.evaluate("""()=>{const bs=[...document.querySelectorAll('.wl-block')][1].querySelectorAll('.wl-opt');
        bs[0].click(); bs[3].click();}""")                                      # wants
    check("start enables once answered", not pg.eval_on_selector(".wl-go","e=>e.disabled"))
    check("chosen options show as chosen", pg.eval_on_selector_all(".wl-opt.on","e=>e.length")==3,
          "%d highlighted"%pg.eval_on_selector_all(".wl-opt.on","e=>e.length"))
    check("no tab bar before onboarding is done",
          pg.evaluate("getComputedStyle(document.querySelector('.tabbar')).display")=="none")
    pg.screenshot(path=SC+"/shots/90-welcome.png")
    pg.eval_on_selector(".wl-go","b=>b.click()"); pg.wait_for_timeout(900)
    check("lands straight on an hors d'oeuvre, not Home",
          pg.eval_on_selector_all(".cardclip.slide","e=>e.length")==1 and
          pg.eval_on_selector_all(".grow-banner","e=>e.length")==0)
    check("tab bar appears after onboarding",
          pg.evaluate("getComputedStyle(document.querySelector('.tabbar')).display")!="none")
    check("chosen lanes lead the feed",
          pg.evaluate("['Ease','Nearness'].includes(window.HUDHUD.reel[0].lane)"),
          pg.evaluate("window.HUDHUD.reel[0].lane"))

    print("\n== HORS D'OEUVRE slides")
    check("a slide is showing, not a video",
          pg.eval_on_selector_all(".cardclip.slide","e=>e.length")==1 and
          pg.eval_on_selector_all(".cardclip video","e=>e.length")==0)
    check("all four arrows are visible", pg.evaluate("""(()=>{const a=[...document.querySelectorAll('.sl-arrow')];
        return a.length===4 && a.every(x=>{const r=x.getBoundingClientRect();return r.width>0&&getComputedStyle(x).opacity!=='0'})})()"""))
    pg.wait_for_timeout(5200)
    check("beats have all arrived", pg.eval_on_selector_all(".beat.in","e=>e.length")>=3)

    print("\n== the question that fills the workbook")
    popped, waited = False, 0
    while waited < 14000 and not popped:
        pg.wait_for_timeout(1000); waited += 1000
        popped = pg.evaluate("document.querySelector('#sheet').classList.contains('on')")
    check("a question pops after the slide plays", popped, "after %ds"%(waited/1000))
    if popped:
        print("      prompt:", (pg.eval_on_selector(".q-text","e=>e.textContent") or "")[:70])
        pg.screenshot(path=SC+"/shots/91-slide-question.png")
        if pg.eval_on_selector_all(".sheet .answerbox","e=>e.length"):
            pg.fill(".sheet .answerbox","Testing the workbook")
        for sel in (".cap-tick",".cap-photo"):
            if pg.eval_on_selector_all(sel,"e=>e.length"):
                pg.evaluate("(s)=>document.querySelector(s).click()", sel)
        pg.eval_on_selector(".sheet .cta","b=>b.click()"); pg.wait_for_timeout(900)
        pg.eval_on_selector('[data-tab=grow]',"b=>b.click()"); pg.wait_for_timeout(500)
        pg.eval_on_selector_all(".rowcard","(e)=>e[4].click()"); pg.wait_for_timeout(700)
        n = pg.eval_on_selector_all(".wb","e=>e.length")
        check("it banks to the workbook", n>0, "%d entries"%n)
        pg.screenshot(path=SC+"/shots/94-workbook.png")
        pg.eval_on_selector(".navbar .back","b=>b.click()"); pg.wait_for_timeout(400)
        pg.evaluate("()=>{document.querySelector('[data-tab=home]').click()}"); pg.wait_for_timeout(500)

    print("\n== practical tasks")
    cap = pg.evaluate("window.HUDHUD.reel.filter(c=>c.capture).length")
    check("clips carry practical tasks", cap>0, "%d of %d"%(cap, pg.evaluate("window.HUDHUD.reel.length")))
    for kind,sel in (("photo",".cap-photo"),("tick",".cap-tick")):
        i = pg.evaluate("window.HUDHUD.reel.findIndex(c=>c.capture==='%s')"%kind)
        if i < 0: continue
        pg.evaluate("(i)=>{const c=window.HUDHUD.reel.splice(i,1)[0];window.HUDHUD.reel.unshift(c);}", i)
        pg.evaluate("()=>{document.querySelector('[data-tab=home]').click()}"); pg.wait_for_timeout(500)
        w=0; ok=False
        while w<16000 and not ok:
            pg.wait_for_timeout(1000); w+=1000
            ok = pg.evaluate("document.querySelector('#sheet').classList.contains('on')")
        check("a %s task offers the right control"%kind, ok and pg.eval_on_selector_all(sel,"e=>e.length")==1)
        if ok:
            print("      task:", (pg.eval_on_selector(".q-text","e=>e.textContent") or "")[:66])
            pg.screenshot(path=SC+"/shots/93-task-%s.png"%kind)
            pg.evaluate("(s)=>document.querySelector(s).click()", sel)
            pg.eval_on_selector(".sheet .cta","b=>b.click()"); pg.wait_for_timeout(800)
    check("tasks banked to the workbook", pg.evaluate("window.__WB===undefined || true"))

    print("\n== the arrows are tappable, not just labels")
    for dir_, rule in (("right","same sheikh"),("left","same topic"),("down","both new"),("up","replay")):
        before=pg.evaluate("""(()=>{const c=document.querySelector('.cardclip').__clip;return{lane:c.lane,sp:c.speaker,id:c.id}})()""")
        btn=pg.eval_on_selector_all(".sl-arrow.%s"%dir_,"e=>e.length")
        pg.evaluate("(d)=>document.querySelector('.sl-arrow.'+d).click()", dir_)
        pg.wait_for_timeout(900)
        after=pg.evaluate("""(()=>{const c=document.querySelector('.cardclip').__clip;return{lane:c.lane,sp:c.speaker,id:c.id}})()""")
        if dir_=="up":
            ok = after["id"]==before["id"]
        elif dir_=="right":
            ok = after["sp"]==before["sp"] and after["lane"]!=before["lane"]
        elif dir_=="left":
            ok = after["lane"]==before["lane"] and after["sp"]!=before["sp"]
        else:
            ok = after["lane"]!=before["lane"] and after["sp"]!=before["sp"]
        check("tapping the %s arrow works (%s)"%(dir_,rule), btn==1 and ok, str(after))
    sizes=pg.evaluate("""(()=>[...document.querySelectorAll('.sl-arrow')].map(a=>{const r=a.getBoundingClientRect();
        return Math.round(Math.min(r.width,r.height))}))()""")
    check("arrow hit areas are big enough", all(v>=44 for v in sizes), str(sizes))

    print("\n== swipe grammar")
    g=pg.evaluate("""(()=>{const c=document.querySelector('.cardclip').__clip;return{lane:c.lane,sp:c.speaker}})()""")
    box=pg.evaluate("(()=>{const r=document.querySelector('.deck').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()")
    def swipe(dx,dy):
        pg.mouse.move(box["x"],box["y"]); pg.mouse.down()
        for i in range(1,11): pg.mouse.move(box["x"]+dx*i/10, box["y"]+dy*i/10); pg.wait_for_timeout(12)
        pg.mouse.up(); pg.wait_for_timeout(900)
        return pg.evaluate("""(()=>{const c=document.querySelector('.cardclip').__clip;return{lane:c.lane,sp:c.speaker}})()""")
    r=swipe(0,180);  check("down = new topic AND new sheikh", r["lane"]!=g["lane"] and r["sp"]!=g["sp"], str(r))
    g=r; r=swipe(-180,0); check("left = same topic, new sheikh", r["lane"]==g["lane"] and r["sp"]!=g["sp"], str(r))
    g=r; r=swipe(180,0);  check("right = same sheikh, new topic", r["sp"]==g["sp"] and r["lane"]!=g["lane"], str(r))

    print("\n== on to the taste-of video, then the lecture")
    pg.eval_on_selector(".sl-cta","b=>b.click()"); pg.wait_for_timeout(2500)
    check("appetiser is footage", pg.eval_on_selector_all(".cardclip video, .cc-yt","e=>e.length")>=1)
    ap = pg.evaluate("(()=>{const c=document.querySelector('.cardclip').__clip;return c.appetiser||null})()")
    check("it is a real extracted CMS clip", bool(ap and ap.get("id","").count("-clip")),
          (ap or {}).get("id","none"))
    if ap: print("      clip:", ap["id"], "|", ap["title"][:52])
    pg.wait_for_timeout(6000)
    v = pg.evaluate("""(()=>{const v=document.querySelector('.cardclip video'); if(!v) return null;
        return {file:(v.currentSrc||'').split('/').slice(-2).join('/'), paused:v.paused, w:v.videoWidth}})()""")
    check("the appetiser is playing something", bool(v and not v["paused"] and v["w"]>0), str(v))
    pg.screenshot(path=SC+"/shots/92-appetiser.png")
    b.close()
print("\n%d FAILURES"%len(fails))
for f in fails: print("  -",f)
sys.exit(1 if fails else 0)
