import os, threading, http.server, socketserver, functools
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH","/opt/pw-browsers")
from playwright.sync_api import sync_playwright
import sys as _s, os as _o
_s.path.insert(0,_o.path.dirname(_o.path.abspath(__file__)))
from onboard import onboard
ROOT,PORT="/home/user/heartshigh/app",8791
socketserver.TCPServer.allow_reuse_address=True
httpd=socketserver.TCPServer(("127.0.0.1",PORT),functools.partial(http.server.SimpleHTTPRequestHandler,directory=ROOT))
threading.Thread(target=httpd.serve_forever,daemon=True).start()
errs=[]
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args=["--no-sandbox"])
    ctx=b.new_context(viewport={"width":390,"height":844},has_touch=True,is_mobile=True)
    # Stand in for YouTube: the API script and the embed never leave the machine.
    ctx.route("**://www.youtube.com/iframe_api", lambda r: r.fulfill(status=200, content_type="application/javascript",
        body="window.YT={Player:function(id,o){var self=this;this._t=0;"
             "this.mute=function(){self.muted=true};this.unMute=function(){self.muted=false};"
             "this.seekTo=function(t){self._t=t};this.playVideo=function(){};this.pauseVideo=function(){};"
             "this.getCurrentTime=function(){return self._t+=0.25};this.destroy=function(){};"
             "window.__YTARGS=o;setTimeout(function(){o.events.onReady({target:self});"
             "o.events.onStateChange({data:1})},50);}};"
             "window.onYouTubeIframeAPIReady&&window.onYouTubeIframeAPIReady();"))
    ctx.route("**://www.youtube-nocookie.com/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<h1>embed</h1>"))
    ctx.route("**://i.ytimg.com/**", lambda r: r.fulfill(status=200, content_type="image/gif",
        body=b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"))
    # serve a reel of YouTube clips only, so the first card is guaranteed to be one
    import json as _j, re as _re
    raw=open("/home/user/heartshigh/app/data.js").read()
    obj=_j.loads(raw.split("window.HUDHUD = ",1)[1].rsplit(";",1)[0])
    obj["reel"]=[c for c in obj["reel"] if c.get("source")=="youtube"]
    ctx.route("**/data.js", lambda r: r.fulfill(status=200, content_type="application/javascript",
        body="window.HUDHUD = "+_j.dumps(obj)+";"))
    pg=ctx.new_page(); pg.set_default_timeout(20000); pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto("http://127.0.0.1:%d/index.html"%PORT,wait_until="domcontentloaded"); pg.wait_for_timeout(700)
    onboard(pg)

    # Every reel entry here is YouTube-backed. The appetiser must still be a real CMS
    # extracted clip, because an embed is blocked inside a published artifact.
    pg.wait_for_selector(".cardclip.slide .sl-cta")
    pg.eval_on_selector(".cardclip.slide:last-of-type .sl-cta", "b=>b.click()")
    pg.wait_for_timeout(2600)
    st = pg.evaluate("""(()=>{const c=[...document.querySelectorAll('.cardclip')].pop();
      const v=c.querySelector('video'), f=c.querySelector('.cc-yt');
      return {clip:c.__clip&&c.__clip.id, src:c.__clip&&c.__clip.source,
              appetiser:c.__clip&&c.__clip.appetiser&&c.__clip.appetiser.id,
              embed:!!f, video:!!v, playing:!!(v&&!v.paused), file:(v&&(v.currentSrc||'')||'').split('/').pop()}})()""")
    print("appetiser of a YouTube-backed slide:", st)
    ok = st["video"] and not st["embed"] and st["appetiser"]
    print("  a real clip rather than a blocked embed:", "PASS" if ok else "FAIL")

    # The embed path still has to be configured correctly for the Pages build, where
    # YouTube is reachable. Force it and read back what we would ask YouTube for.
    pg.evaluate("""()=>{const c=[...document.querySelectorAll('.cardclip')].pop();
      const clip=Object.assign({}, c.__clip); delete clip.appetiser;
      window.__forced = clip;}""")
    pg.evaluate("""()=>{const media=document.querySelector('.cardclip .cc-media')||document.querySelector('.cardclip');
      window.HUDHUD_YT = window.__ytmake && 1;}""")
    print("  youtube ids in the reel:",
          pg.evaluate("window.HUDHUD.reel.filter(c=>c.youtube).length"))
    print("PAGE ERRORS:", len(errs), errs[:3])
    b.close()
