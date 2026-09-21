"""Serve the SHIPPED app/ untouched. No substitutions. The codec picker must do the work."""
import os, threading, http.server, socketserver, functools, re
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH","/opt/pw-browsers")
from playwright.sync_api import sync_playwright
SC="/tmp/claude-0/-home-user-heartshigh/3f25a5bb-9a14-5bb7-aeb3-0ad20b981de1/scratchpad"
ROOT="/home/user/heartshigh/app"
class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path=self.translate_path(self.path); rng=self.headers.get('Range')
        if rng and os.path.isfile(path) and (path.endswith('.webm') or path.endswith('.mp4')):
            size=os.path.getsize(path); m=re.match(r'bytes=(\d*)-(\d*)',rng)
            a=int(m.group(1) or 0); b=int(m.group(2) or size-1); b=min(b,size-1)
            self.send_response(206)
            self.send_header('Content-Type','video/webm' if path.endswith('webm') else 'video/mp4')
            self.send_header('Accept-Ranges','bytes')
            self.send_header('Content-Range','bytes %d-%d/%d'%(a,b,size))
            self.send_header('Content-Length',str(b-a+1)); self.end_headers()
            with open(path,'rb') as f: f.seek(a); self.wfile.write(f.read(b-a+1))
            return
        try: return super().do_GET()
        except (BrokenPipeError, ConnectionResetError): pass
    def log_message(self,*a): pass
PORT=8815
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
    js = "() => !!document.createElement('video').canPlayType('video/mp4; codecs=' + String.fromCharCode(34) + 'avc1.42E01E' + String.fromCharCode(34))"
    print("browser can decode H.264:", pg.evaluate(js))
    pg.eval_on_selector_all(".list.scroll-pad button","e=>e[0].click()"); pg.wait_for_timeout(4000)
    st=pg.evaluate("""() => { const v=document.querySelector('.cardclip video'); if(!v) return null;
      return {file:(v.currentSrc||'').split('/').pop(), paused:v.paused, dur:+(v.duration||0).toFixed(1),
              w:v.videoWidth, h:v.videoHeight, err:v.error?v.error.code:null,
              fit:document.querySelector('.cardclip').dataset.fit} }""")
    print("hero:", st)
    t1=pg.evaluate("document.querySelector('.cardclip video').currentTime"); pg.wait_for_timeout(2000)
    t2=pg.evaluate("document.querySelector('.cardclip video').currentTime")
    print("advancing: %.2f -> %.2f  %s" % (t1,t2,"PLAYING ✓" if t2>t1 else "STALLED ✗"))
    pg.screenshot(path=SC+"/shots/60-shipped-hero.png")
    # appetiser + mains from the shipped build
    pg.eval_on_selector_all(".cardclip .cta","e=>e[0].click()"); pg.wait_for_timeout(2500)
    pg.screenshot(path=SC+"/shots/61-shipped-appetiser.png")
    pg.route("**/hls/**", lambda r: r.abort())
    pg.eval_on_selector_all(".cardclip .cta","e=>e[e.length-1].click()"); pg.wait_for_timeout(9000)
    m=pg.evaluate("""() => { const s=[...document.querySelectorAll('.screen')].filter(n=>n.style.display!=='none').pop();
      const v=s.querySelector('video'); return v?{file:(v.currentSrc||'').split('/').pop(), paused:v.paused,
      t:+v.currentTime.toFixed(2), w:v.videoWidth}:null }""")
    print("mains (CDN blocked -> fallback):", m)
    pg.screenshot(path=SC+"/shots/62-shipped-mains.png")
    b.close()
print("PAGE ERRORS:",len(errs),errs[:3])
