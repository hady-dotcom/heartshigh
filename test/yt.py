import os, threading, http.server, socketserver, functools
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH","/opt/pw-browsers")
from playwright.sync_api import sync_playwright
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

    # force a YouTube clip into the deck
    pg.evaluate("window.HUDHUD.reel.sort((a,b)=>(a.source==='youtube'?-1:1)-(b.source==='youtube'?-1:1))")
    pg.eval_on_selector('[data-tab=lanes]',"b=>b.click()"); pg.wait_for_timeout(500)
    pg.evaluate("""() => { const c = window.HUDHUD.reel.find(c=>c.source==='youtube');
        window.__CLIP=c; document.querySelectorAll('.lanetile').forEach(t=>{}); }""")
    pg.eval_on_selector_all(".lanetile","e=>e[0].click()"); pg.wait_for_timeout(600)
    # navigate the deck until a youtube card appears
    found=False
    for i in range(3):
        src = pg.evaluate("(()=>{const c=document.querySelector('.cardclip');return c&&c.__clip?c.__clip.source:null})()")
        if src=='youtube': found=True; break
        pg.keyboard.press("ArrowLeft"); pg.wait_for_timeout(420)
    print("reached a YouTube clip:", found)
    if found:
        pg.wait_for_timeout(1200)
        print("  args videoId :", pg.evaluate("window.__YTARGS && window.__YTARGS.videoId"))
        print("  playerVars   :", pg.evaluate("window.__YTARGS && JSON.stringify(window.__YTARGS.playerVars)"))
        print("  host         :", pg.evaluate("window.__YTARGS && window.__YTARGS.host"))
        print("  clip window  :", pg.evaluate("(()=>{const c=document.querySelector('.cardclip').__clip;return c.start+'s for '+c.len+'s ('+c.youtube+')'})()"))
        print("  yt layer on  :", pg.evaluate("!!document.querySelector('.cc-yt.on')"))
        print("  embed ignores pointer events:",
              pg.evaluate("getComputedStyle(document.querySelector('.cc-yt')).pointerEvents"))
        # swipe must still work over the embed
        before = pg.evaluate("document.querySelector('.cc-quote').textContent")
        box = pg.evaluate("(()=>{const r=document.querySelector('.deck').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()")
        pg.mouse.move(box["x"],box["y"]); pg.mouse.down()
        for i in range(1,11): pg.mouse.move(box["x"]-i*16, box["y"]); pg.wait_for_timeout(12)
        pg.mouse.up(); pg.wait_for_timeout(800)
        after = pg.evaluate("document.querySelector('.cc-quote').textContent")
        print("  swipe over embed works:", before!=after)
        pg.screenshot(path="/tmp/claude-0/-home-user-heartshigh/3f25a5bb-9a14-5bb7-aeb3-0ad20b981de1/scratchpad/shots/33-youtube-card.png")
    b.close()
print("PAGE ERRORS:",len(errs),errs[:3])
