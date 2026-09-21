"""Can a person actually operate the player? Asserts reachable controls, not media state."""
import os, threading, http.server, socketserver, functools, re, sys
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH","/opt/pw-browsers")
from playwright.sync_api import sync_playwright
ROOT="/home/user/heartshigh/app"; PORT=8820
class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path=self.translate_path(self.path); rng=self.headers.get('Range')
        if rng and os.path.isfile(path) and (path.endswith('.webm') or path.endswith('.mp4')):
            size=os.path.getsize(path); m=re.match(r'bytes=(\d*)-(\d*)',rng)
            a=int(m.group(1) or 0); b=int(m.group(2) or size-1); b=min(b,size-1)
            self.send_response(206)
            self.send_header('Content-Type','video/webm'); self.send_header('Accept-Ranges','bytes')
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

fails=[]
def check(name, ok, detail=""):
    print("   %-52s %s %s" % (name, "PASS" if ok else "FAIL", detail))
    if not ok: fails.append(name)

TOP="(()=>{const s=[...document.querySelectorAll('.screen')].filter(n=>n.style.display!=='none');return s[s.length-1]})()"
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
        args=["--no-sandbox","--autoplay-policy=no-user-gesture-required"])
    pg=b.new_page(viewport={"width":390,"height":844},device_scale_factor=2,has_touch=True,is_mobile=True)
    pg.set_default_timeout(30000)
    pg.on("pageerror", lambda e: fails.append("pageerror: %s"%e))
    pg.goto("http://127.0.0.1:%d/index.html"%PORT,wait_until="domcontentloaded"); pg.wait_for_timeout(800)
    pg.route("**/hls/**", lambda r: r.abort())   # the artifact's reality
    pg.eval_on_selector_all(".list .rowcard","e=>e[0].click()")
    pg.wait_for_timeout(9000)

    print("\n== MAINS player controls, while it is playing")
    playing = pg.evaluate("(()=>{const v=%s.querySelector('video');return v&&!v.paused})()"%TOP)
    check("video is playing", playing)

    # any reachable pause control counts: the centre button or the persistent bar button
    vis = pg.evaluate("""(()=>{const s=%s;
      const cands=[...s.querySelectorAll('.av-play, .pl-btn')];
      const ok=cands.filter(b=>{const r=b.getBoundingClientRect(); const st=getComputedStyle(b);
        return r.width>0 && st.opacity!=='0' && st.visibility!=='hidden' && st.pointerEvents!=='none';});
      return ok.length? ok.map(b=>b.className).join(',') : 'none'})()"""%TOP)
    check("a pause control is reachable while playing", vis!="none", "(%s)"%vis)

    # and it actually pauses
    pg.evaluate("(()=>{const b=%s.querySelector('.pl-btn'); b && b.click()})()"%TOP); pg.wait_for_timeout(600)
    check("the bar control pauses playback",
          pg.evaluate("(()=>{const v=%s.querySelector('video');return v&&v.paused})()"%TOP))
    pg.evaluate("(()=>{const b=%s.querySelector('.pl-btn'); b && b.click()})()"%TOP); pg.wait_for_timeout(800)
    check("the bar control resumes playback",
          pg.evaluate("(()=>{const v=%s.querySelector('video');return v&&!v.paused})()"%TOP))

    # tapping the player surface should toggle
    box = pg.evaluate("(()=>{const p=%s.querySelector('.player').getBoundingClientRect();return{x:p.x+p.width/2,y:p.y+p.height/2}})()"%TOP)
    pg.mouse.click(box["x"], box["y"]); pg.wait_for_timeout(700)
    paused_after_tap = pg.evaluate("(()=>{const v=%s.querySelector('video');return v&&v.paused})()"%TOP)
    check("tapping the player pauses it", paused_after_tap)

    ctrl_after_pause = pg.evaluate("""(()=>{const b=%s.querySelector('.av-play'); if(!b) return 'missing';
      const r=b.getBoundingClientRect(); const st=getComputedStyle(b);
      return (r.width>0 && st.opacity!=='0')?'visible':'hidden'})()"""%TOP)
    check("a play control is visible while paused", ctrl_after_pause=="visible", "(%s)"%ctrl_after_pause)

    # dismiss any question that fired while we were poking at the controls
    pg.evaluate("(()=>{const sc=document.querySelector('#scrim'); if(sc && sc.classList.contains('on')) sc.click()})()")
    pg.wait_for_timeout(700)
    if pg.evaluate("(()=>{const v=%s.querySelector('video');return v&&v.paused})()"%TOP):
        pg.mouse.click(box["x"], box["y"]); pg.wait_for_timeout(900)
    resumed = pg.evaluate("(()=>{const v=%s.querySelector('video');return v&&!v.paused})()"%TOP)
    check("tapping again resumes", resumed)

    print("\n== the question actually pops up during playback")
    # reload clean, play, and wait for a panel without touching anything
    pg.evaluate("(()=>{const sc=document.querySelector('#scrim'); if(sc&&sc.classList.contains('on')) sc.click()})()")
    pg.goto("http://127.0.0.1:%d/index.html"%PORT, wait_until="domcontentloaded"); pg.wait_for_timeout(800)
    pg.eval_on_selector_all(".list .rowcard","e=>e[0].click()"); pg.wait_for_timeout(9000)
    popped, waited = False, 0
    while waited < 22000 and not popped:
        pg.wait_for_timeout(1000); waited += 1000
        popped = pg.evaluate("document.querySelector('#sheet').classList.contains('on')")
    check("a question pops up on its own while the video plays", popped, "after %.0fs" % (waited/1000.0))
    if popped:
        check("the video paused for it",
              pg.evaluate("(()=>{const v=%s.querySelector('video');return v&&v.paused})()"%TOP))
        print("      prompt:", (pg.eval_on_selector(".q-text","e=>e.textContent") or "")[:78])
        print("      clip  :", (pg.eval_on_selector(".sheet .eyebrow","e=>e.textContent") or "")[:70])
        pg.screenshot(path="/tmp/claude-0/-home-user-heartshigh/3f25a5bb-9a14-5bb7-aeb3-0ad20b981de1/scratchpad/shots/71-live-popup.png")
        # answering resumes playback
        pg.eval_on_selector(".sheet .cta","b=>b.click()"); pg.wait_for_timeout(1600)
        check("answering closes it and resumes",
              pg.evaluate("!document.querySelector('#sheet').classList.contains('on')") and
              pg.evaluate("(()=>{const v=%s.querySelector('video');return v&&!v.paused})()"%TOP))

    print("\n== switching part updates what is on screen")
    before = pg.evaluate("(()=>{const s=%s;return{label:s.querySelector('.part-label').textContent,"
                         "meta:(s.querySelector('.eyebrow')||{}).textContent,"
                         "thesis:s.querySelectorAll('p')[0].textContent.slice(0,40)}})()"%TOP)
    pg.evaluate("""(()=>{const rows=%s.querySelectorAll('.list .rowcard');
        for(const r of rows){ if(!/Now/.test(r.textContent)){ r.click(); return; } }})()"""%TOP)
    pg.wait_for_timeout(4000)
    after = pg.evaluate("(()=>{const s=%s;return{label:s.querySelector('.part-label').textContent,"
                        "meta:(s.querySelector('.eyebrow')||{}).textContent,"
                        "thesis:s.querySelectorAll('p')[0].textContent.slice(0,40)}})()"%TOP)
    check("part label changed", before["label"]!=after["label"], "%r -> %r"%(before["label"],after["label"]))
    check("the part's description changed too", before["thesis"]!=after["thesis"],
          "%r -> %r"%(before["thesis"],after["thesis"]))
    dots = pg.evaluate("%s.querySelectorAll('.tl-dot').length"%TOP)
    note = pg.evaluate("""(()=>{const n=%s.querySelector('.note');
        return n && getComputedStyle(n).display!=='none' ? n.textContent.slice(0,60) : null})()"""%TOP)
    check("the new part has points or says why not", dots>0 or bool(note), "dots=%d note=%r"%(dots,note))
    pg.screenshot(path="/tmp/claude-0/-home-user-heartshigh/3f25a5bb-9a14-5bb7-aeb3-0ad20b981de1/scratchpad/shots/70-controls.png")
    b.close()

print("\n%d FAILURES" % len(fails))
for f in fails: print("  -", f)
sys.exit(1 if fails else 0)
