import os, threading, http.server, socketserver, functools
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH","/opt/pw-browsers")
from playwright.sync_api import sync_playwright
ROOT,PORT="/tmp/claude-0/-home-user-heartshigh/3f25a5bb-9a14-5bb7-aeb3-0ad20b981de1/scratchpad/sim",8781
socketserver.TCPServer.allow_reuse_address=True
httpd=socketserver.TCPServer(("127.0.0.1",PORT),functools.partial(http.server.SimpleHTTPRequestHandler,directory=ROOT))
threading.Thread(target=httpd.serve_forever,daemon=True).start()
SHOT="/tmp/claude-0/-home-user-heartshigh/3f25a5bb-9a14-5bb7-aeb3-0ad20b981de1/scratchpad/shots"
errs=[]
GEO="""() => {
  const r=s=>{const e=document.querySelector(s); if(!e) return 'MISSING';
    const b=e.getBoundingClientRect(); return Math.round(b.width)+'x'+Math.round(b.height); };
  const vis=el=>{const e=document.querySelector(el); if(!e) return false;
    const b=e.getBoundingClientRect(); const st=getComputedStyle(e);
    return b.width>0&&b.height>0&&st.visibility!=='hidden'&&st.opacity!=='0'; };
  return {bezel:r('.bezel'), viewport:r('#viewport'), banner:r('.grow-banner'),
          tabbar:r('.tabbar'), cta:r('.grow-banner .cta'),
          bannerVisible:vis('.grow-banner'), ctaVisible:vis('.grow-banner .cta'),
          paintedText:(document.querySelector('.gb-head')||{}).textContent||''};
}"""
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args=["--no-sandbox"])
    for w,h,lbl,mob in [(390,844,"phone-skeleton",True),(1400,940,"desktop-skeleton",False)]:
        pg=b.new_page(viewport={"width":w,"height":h},device_scale_factor=2,has_touch=mob,is_mobile=mob)
        pg.set_default_timeout(20000); pg.on("pageerror",lambda e:errs.append(str(e)))
        pg.goto("http://127.0.0.1:%d/index.html"%PORT,wait_until="domcontentloaded"); pg.wait_for_timeout(1100)
        g=pg.evaluate(GEO)
        print(lbl); 
        for k,v in g.items(): print("   %-14s %s" % (k,v))
        pg.screenshot(path=SHOT+"/23-"+lbl+".png")
        # click through to prove it is live, not just painted
        if mob:
            pg.eval_on_selector_all(".list.scroll-pad button","e=>e[0].click()"); pg.wait_for_timeout(900)
            print("   after tap -> deck:", pg.eval_on_selector_all(".deck","e=>e.length"),
                  "card:", pg.evaluate("(()=>{const e=document.querySelector('.cardclip');if(!e)return 'MISSING';const b=e.getBoundingClientRect();return Math.round(b.width)+'x'+Math.round(b.height)})()"))
            pg.screenshot(path=SHOT+"/24-skeleton-hors.png")
        pg.close()
    b.close()
print("ERRORS:",len(errs),errs[:3])
