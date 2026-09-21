"""Stress the reel: hammer every direction hundreds of times and insist a NEW
hors d'oeuvre lands every single time, rendered and readable, grammar intact.

Leon's report: "I clicked 'More from the speaker' and it gave me nothing."
A bot that swipes once proves nothing. This one swipes 400 times."""
import os, threading, http.server, socketserver, functools, random, sys, collections
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH","/opt/pw-browsers")
from playwright.sync_api import sync_playwright
ROOT,PORT="/home/user/heartshigh/app",8847
socketserver.TCPServer.allow_reuse_address=True
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
    def do_GET(self):
        try: return super().do_GET()
        except (BrokenPipeError, ConnectionResetError): pass
httpd=socketserver.TCPServer(("127.0.0.1",PORT),functools.partial(H,directory=ROOT))
threading.Thread(target=httpd.serve_forever,daemon=True).start()

ROUNDS=int(sys.argv[1]) if len(sys.argv)>1 else 400
fails=[]
def check(n, ok, d=""):
    print("   %-58s %s %s" % (n, "PASS" if ok else "FAIL", d))
    if not ok: fails.append(n)

# What is actually on the front card, measured not assumed.
STATE="""(()=>{
  const cs=[...document.querySelectorAll('.cardclip.slide')];
  if(!cs.length) return {n:0};
  const card=cs[cs.length-1];
  const c=card.__clip||{};
  const txt=[...card.querySelectorAll('.sl-bubble,.sl-land,.sl-card,.sl-cine-hook,.sl-cine-tail,.sl-cine-land')]
    .map(e=>({t:(e.textContent||'').trim(), w:e.getBoundingClientRect().width, h:e.getBoundingClientRect().height}));
  const ar=[...card.querySelectorAll('.sl-arrow')].map(a=>{const r=a.getBoundingClientRect();
    return {d:[...a.classList].filter(x=>x!=='sl-arrow')[0], w:r.width, h:r.height};});
  const r=card.getBoundingClientRect();
  const first=card.querySelector('.beat');
  const vis=first?parseFloat(getComputedStyle(first).opacity):0;
  return {n:cs.length, id:c.id, lane:c.lane, speaker:c.speaker, txt, ar, vis,
          w:r.width, h:r.height, sheet:document.querySelector('.sheet').classList.contains('up')};
})()"""

with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
        args=["--no-sandbox","--autoplay-policy=no-user-gesture-required"])
    ctx=b.new_context(viewport={"width":390,"height":844},has_touch=True,is_mobile=True)
    pg=ctx.new_page(); pg.set_default_timeout(30000)
    errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("http://127.0.0.1:%d/index.html"%PORT,wait_until="domcontentloaded"); pg.wait_for_timeout(700)
    # onboard
    pg.fill(".wl-input","Bot")
    pg.eval_on_selector_all(".wl-block .wl-opt","e=>e[0].click()")
    pg.evaluate("""()=>{const bs=[...document.querySelectorAll('.wl-block')][1].querySelectorAll('.wl-opt');
        bs[0].click(); bs[3].click();}""")
    pg.eval_on_selector(".wl-go","b=>b.click()"); pg.wait_for_timeout(700)

    st=pg.evaluate(STATE)
    check("deck opens on a slide", st["n"]==1, "n=%s"%st["n"])

    same=collections.Counter(); seen=set(); grammar=collections.Counter()
    blank=0; dead=0; faint=0; stuck=[]
    DIRS=["right","left","down","right","right","left","down","up"]
    print("\n== %d NAVIGATIONS"%ROUNDS)
    for i in range(ROUNDS):
        d=DIRS[i%len(DIRS)] if i%3 else random.choice(["right","left","down"])
        before=pg.evaluate(STATE)
        # dismiss a question sheet if the read completed
        if before.get("sheet"):
            pg.evaluate("()=>{const b=document.querySelector('.sheet .q-save,.sheet .q-skip');b&&b.click();}")
            pg.wait_for_timeout(250); before=pg.evaluate(STATE)
        sel=".cardclip.slide:last-of-type .sl-arrow."+d
        try: pg.eval_on_selector(sel,"a=>a.click()")
        except Exception as e: dead+=1; continue
        pg.wait_for_timeout(200)
        landing=pg.evaluate(STATE)          # is the hook readable as it arrives?
        if landing.get("vis",0) < 0.5: faint+=1; stuck.append((i,d,"hook still invisible on arrival"))
        pg.wait_for_timeout(260)
        after=pg.evaluate(STATE)
        if after["n"]!=1: stuck.append((i,d,"cards=%s"%after["n"]))
        if d=="up":
            continue
        if after.get("id")==before.get("id"):
            same[d]+=1; stuck.append((i,d,"same clip %s"%after.get("id")))
        seen.add(after.get("id"))
        # rendered?  every beat must carry text and occupy real space
        body=[t for t in after["txt"] if t["t"]]
        if not body or max(t["w"]*t["h"] for t in after["txt"]) <= 0:
            blank+=1; stuck.append((i,d,"blank card %s"%after.get("id")))
        # grammar
        if d=="right"and after.get("speaker")!=before.get("speaker"): grammar["right broke speaker"]+=1
        if d=="left" and after.get("lane")!=before.get("lane"):       grammar["left broke lane"]+=1
        if d=="down" and (after.get("lane")==before.get("lane") or
                          after.get("speaker")==before.get("speaker")): grammar["down not both-new"]+=1
        if len(after["ar"])!=4: stuck.append((i,d,"arrows=%d"%len(after["ar"])))
        if min(a["w"] for a in after["ar"])<40 or min(a["h"] for a in after["ar"])<40:
            stuck.append((i,d,"arrow hit area too small"))

    print()
    check("every navigation produced a new hors d'oeuvre", sum(same.values())==0,
          "repeats: %s"%dict(same))
    check("the hook is legible the moment the card lands", faint==0, "%d arrived blank"%faint)
    check("no blank cards", blank==0, "%d blank"%blank)
    check("no dead arrows", dead==0, "%d unclickable"%dead)
    check("exactly one card on screen throughout", not any("cards=" in s[2] for s in stuck))
    check("grammar held every time", not grammar, str(dict(grammar)))
    check("reel keeps giving: many distinct clips seen", len(seen)>=40, "%d distinct"%len(seen))
    check("no page errors", not errs, "; ".join(errs[:3]))
    if stuck:
        print("\n   first 12 anomalies:")
        for s in stuck[:12]: print("     round %-4d %-6s %s"%s)

print("\nFAIL=%d"%len(fails))
sys.exit(1 if fails else 0)
