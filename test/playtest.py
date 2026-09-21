import os, threading, http.server, socketserver, functools
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/pw-browsers")
from playwright.sync_api import sync_playwright

ROOT, PORT = "/home/user/heartshigh/app", 8766
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT),
        functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT))
threading.Thread(target=httpd.serve_forever, daemon=True).start()

errors = []
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
        args=["--no-sandbox","--disable-dev-shm-usage","--autoplay-policy=no-user-gesture-required"])
    pg = b.new_page(viewport={"width":390,"height":844}, has_touch=True, is_mobile=True)
    pg.set_default_timeout(60000)
    pg.on("pageerror", lambda e: errors.append(str(e)))

    # Short clip windows so a 14s recording can exercise the loop.
    pg.add_init_script("window.HUDHUD_CONFIG={horsLen:4, appLen:6};")
    pg.goto("http://127.0.0.1:%d/index.html" % PORT, wait_until="domcontentloaded")

    print("== hls.js availability")
    print("   window.Hls:", pg.evaluate("!!window.Hls"),
          " isSupported:", pg.evaluate("window.Hls && window.Hls.isSupported()"),
          " version:", pg.evaluate("window.Hls && window.Hls.version"))

    print("== record a real seekable video in-browser (14s)")
    pg.evaluate("""() => new Promise(res => {
        const c = document.createElement('canvas'); c.width=320; c.height=180;
        const x = c.getContext('2d'); let t0 = performance.now();
        (function draw(){ const t=(performance.now()-t0)/1000;
          x.fillStyle='#2B2356'; x.fillRect(0,0,320,180);
          x.fillStyle='#E8793A'; x.fillRect(0,0,(t/14)*320,180);
          x.fillStyle='#fff'; x.font='28px sans-serif'; x.fillText(t.toFixed(1)+'s',120,100);
          if(t<14.5) requestAnimationFrame(draw); })();
        const st = c.captureStream(15); const parts=[];
        const mr = new MediaRecorder(st, {mimeType:'video/webm'});
        mr.ondataavailable = e => parts.push(e.data);
        mr.onstop = () => { window.__TESTURL = URL.createObjectURL(new Blob(parts,{type:'video/webm'})); res(true); };
        mr.start(); setTimeout(()=>mr.stop(), 14000);
    })""")
    print("   recorded:", pg.evaluate("!!window.__TESTURL"))

    # Point every CMS video at the local recording; keep everything else identical.
    pg.evaluate("""() => {
      window.HUDHUD.videos.forEach(v => { v.hls = window.__TESTURL; });
      window.HUDHUD.reel.forEach(c => { c.start = 3; c.len = 4; c.wholeFile = false; c.burnedIn = false; if (c.src) c.src = window.__TESTURL; });
      window.HUDHUD.course.hls = window.__TESTURL; window.HUDHUD.course.fallbackSrc = window.__TESTURL;
      window.HUDHUD.course.durationSec = 14;
      window.HUDHUD.course.points.forEach((p,i) => { p.at = 2 + i; p.answered = i < 2; });
    }""")
    # No reload — that would revoke the blob. Rebuild the home screen in place instead.
    pg.eval_on_selector('[data-tab=home]', "b=>b.click()"); pg.wait_for_timeout(400)

    print("\n== HORS D'OEUVRE playback")
    pg.eval_on_selector_all(".list.scroll-pad button", "e=>e[0].click()")
    pg.wait_for_timeout(2600)
    st = pg.evaluate("""() => { const v=document.querySelector('.cardclip video');
        return v ? {exists:true, paused:v.paused, t:v.currentTime, muted:v.muted, rs:v.readyState,
                    w:v.videoWidth, cls:v.className} : {exists:false}; }""")
    print("   video:", st)
    t1 = pg.evaluate("document.querySelector('.cardclip video').currentTime")
    pg.wait_for_timeout(1500)
    t2 = pg.evaluate("document.querySelector('.cardclip video').currentTime")
    print("   advancing: %.2f -> %.2f  (%s)" % (t1, t2, "PLAYING" if t2 > t1 else "STALLED"))
    print("   seeked to clip.start(3):", "YES" if t1 >= 2.5 else "NO (t=%.2f)" % t1)
    pw_ = pg.evaluate("document.querySelector('.cc-prog i').style.width")
    print("   progress bar:", pw_)

    print("== clip window loops (start=3, len=4 -> must stay under 7s)")
    over = False
    for _ in range(14):
        pg.wait_for_timeout(500)
        t = pg.evaluate("document.querySelector('.cardclip video').currentTime")
        if t > 7.8: over = True
    print("   stayed inside window:", "YES" if not over else "NO — ran past the clip end")

    print("== unmute toggle")
    pg.eval_on_selector(".cc-unmute", "b=>b.click()"); pg.wait_for_timeout(400)
    print("   muted after tap:", pg.evaluate("document.querySelector('.cardclip video').muted"))

    print("== covered screen must not keep playing (audio overlap)")
    pg.eval_on_selector_all(".cardclip .cta", "e=>e[0].click()")
    pg.wait_for_timeout(1800)
    states = pg.evaluate("""() => [...document.querySelectorAll('video')].map(v => ({
        paused: v.paused, hidden: !!v.closest('.screen[aria-hidden=true]') || v.closest('.screen').style.display==='none' }))""")
    print("   videos:", states)
    bad = [s for s in states if s["hidden"] and not s["paused"]]
    print("   hidden-but-playing:", "NONE (correct)" if not bad else bad)

    print("== APPETISER plays")
    pg.wait_for_timeout(1200)
    ap = pg.evaluate("""() => { const s=[...document.querySelectorAll('.screen')].filter(n=>n.style.display!=='none').pop();
        const v=s.querySelector('video'); return v?{paused:v.paused,t:v.currentTime}:null }""")
    print("   appetiser video:", ap)

    print("== MAINS: auto-pause at an engagement point")
    pg.eval_on_selector_all(".cardclip .cta", "e=>e[e.length-1].click()")
    pg.wait_for_timeout(1500)
    # ensure it is actually rolling (do not toggle a playing video off)
    pg.evaluate("""() => { const s=[...document.querySelectorAll('.screen')].filter(n=>n.style.display!=='none').pop();
        const v=s.querySelector('video'); if (v && v.paused) { v.currentTime=0; v.play().catch(()=>{}); } }""")
    pg.wait_for_timeout(7000)
    res = pg.evaluate("""() => { const s=[...document.querySelectorAll('.screen')].filter(n=>n.style.display!=='none').pop();
        const v=s.querySelector('video');
        return {sheet: document.querySelector('#sheet').classList.contains('on'),
                paused: v? v.paused:null, t: v? v.currentTime:null,
                prompt: (document.querySelector('.q-text')||{}).textContent} }""")
    print("   sheet opened:", res["sheet"], "| video paused:", res["paused"], "| t=%.1f" % (res["t"] or 0))
    print("   prompt:", (res["prompt"] or "")[:70])
    pg.screenshot(path="/tmp/claude-0/-home-user-heartshigh/3f25a5bb-9a14-5bb7-aeb3-0ad20b981de1/scratchpad/shots/13-playback-engagement.png")

    print("== resumes after answering")
    pg.eval_on_selector(".sheet .cta", "b=>b.click()"); pg.wait_for_timeout(1500)
    after = pg.evaluate("""() => { const s=[...document.querySelectorAll('.screen')].filter(n=>n.style.display!=='none').pop();
        const v=s.querySelector('video'); return {paused:v.paused, sheet:document.querySelector('#sheet').classList.contains('on')} }""")
    print("   after share:", after)

    b.close()
print("\n=== PAGE ERRORS (%d) ===" % len(errors))
for e in errors[:10]: print("  ", e[:160])
