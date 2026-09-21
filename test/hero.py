"""Play the REAL hero clip through the app, in a browser that can decode it."""
import os, threading, http.server, socketserver, functools, re, shutil
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH","/opt/pw-browsers")
from playwright.sync_api import sync_playwright

SC="/tmp/claude-0/-home-user-heartshigh/3f25a5bb-9a14-5bb7-aeb3-0ad20b981de1/scratchpad"
ROOT=SC+"/serve"
shutil.rmtree(ROOT, ignore_errors=True); shutil.copytree("/home/user/heartshigh/app", ROOT)
os.makedirs(ROOT+"/media", exist_ok=True)
for f in os.listdir(SC+"/webm"): shutil.copy2(SC+"/webm/"+f, ROOT+"/media/"+f)
# point the baked data at the decodable copies (same paths, .webm)
d=open(ROOT+"/data.js").read().replace(".mp4",".webm")
open(ROOT+"/data.js","w").write(d)

class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path=self.translate_path(self.path); rng=self.headers.get('Range')
        if rng and os.path.isfile(path) and path.endswith('.webm'):
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

PORT=8810
socketserver.TCPServer.allow_reuse_address=True
httpd=socketserver.TCPServer(("127.0.0.1",PORT),functools.partial(H,directory=ROOT))
threading.Thread(target=httpd.serve_forever,daemon=True).start()

errs=[]
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
        args=["--no-sandbox","--autoplay-policy=no-user-gesture-required"])
    pg=b.new_page(viewport={"width":390,"height":844},device_scale_factor=2,has_touch=True,is_mobile=True)
    pg.set_default_timeout(30000); pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto("http://127.0.0.1:%d/index.html"%PORT,wait_until="domcontentloaded"); pg.wait_for_timeout(900)

    print("== HOME: hero card is the Drive clip")
    print("   hero clip:", pg.evaluate("(()=>{const c=window.HUDHUD.reel[0];return c.id+' | '+c.src+' | '+c.land.slice(0,46)})()"))
    pg.eval_on_selector_all(".list.scroll-pad button","e=>e[0].click()")
    pg.wait_for_timeout(3500)
    st=pg.evaluate("""() => { const v=document.querySelector('.cardclip video'); if(!v) return null;
      return {file:(v.currentSrc||'').split('/').pop(), paused:v.paused, t:+v.currentTime.toFixed(2),
              dur:+(v.duration||0).toFixed(1), w:v.videoWidth, h:v.videoHeight, loop:v.loop,
              visible:v.classList.contains('on'), err:v.error?v.error.code:null} }""")
    print("   video:", st)
    t1=pg.evaluate("document.querySelector('.cardclip video').currentTime"); pg.wait_for_timeout(2000)
    t2=pg.evaluate("document.querySelector('.cardclip video').currentTime")
    print("   advancing: %.2f -> %.2f  %s" % (t1,t2,"PLAYING ✓" if t2>t1 else "STALLED ✗"))
    print("   burned-in captions => no overlaid quote:", pg.evaluate("!document.querySelector('.cardclip .cc-quote')"))
    print("   progress bar:", pg.eval_on_selector(".cc-prog i","e=>e.style.width"))
    pg.screenshot(path=SC+"/shots/50-hero-playing.png")
    pg.wait_for_timeout(2500)
    pg.screenshot(path=SC+"/shots/51-hero-later.png")

    print("== loops at the end of the clip (17.7s)")
    pg.evaluate("document.querySelector('.cardclip video').currentTime = 16.5")
    pg.wait_for_timeout(3000)
    t3=pg.evaluate("document.querySelector('.cardclip video').currentTime")
    print("   after passing the end, t=%.2f  %s" % (t3, "LOOPED ✓" if t3 < 16.5 else "did not loop ✗"))

    print("== swipe away, then MAINS falls back to the lecture plate")
    pg.eval_on_selector('[data-tab=home]',"b=>b.click()"); pg.wait_for_timeout(500)
    pg.route("**/hls/**", lambda r: r.abort())      # simulate the CMS CDN being unreachable
    pg.eval_on_selector_all(".list .rowcard","e=>e[0].click()"); pg.wait_for_timeout(9000)
    m=pg.evaluate("""() => { const s=[...document.querySelectorAll('.screen')].filter(n=>n.style.display!=='none').pop();
      const v=s.querySelector('video'); return v?{file:(v.currentSrc||'').split('/').pop(), paused:v.paused,
        t:+v.currentTime.toFixed(2), w:v.videoWidth}:null }""")
    print("   mains video:", m)
    pg.screenshot(path=SC+"/shots/52-mains-fallback.png")
    b.close()
print("PAGE ERRORS:",len(errs),errs[:3])
