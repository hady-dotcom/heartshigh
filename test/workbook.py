"""Leon's question: "will you store my reflection?"  This answers it.
Write a reflection during the lecture, then go and find it in the workbook — and find
it again after a reload, because a demo that forgets you is not a demo of this app."""
import os, threading, http.server, socketserver, functools, sys
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH","/opt/pw-browsers")
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from onboard import onboard, to_mains
ROOT, PORT = "/home/user/heartshigh/app", 8848
socketserver.TCPServer.allow_reuse_address = True
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
httpd = socketserver.TCPServer(("127.0.0.1", PORT), functools.partial(H, directory=ROOT))
threading.Thread(target=httpd.serve_forever, daemon=True).start()

fails = []
def check(n, ok, d=""):
    print("   %-54s %s %s" % (n, "PASS" if ok else "FAIL", d))
    if not ok: fails.append(n)

MINE = "I kept putting this off until I could do it properly."
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
        args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"])
    ctx = b.new_context(viewport={"width":390,"height":844}, has_touch=True, is_mobile=True)
    pg = ctx.new_page(); pg.set_default_timeout(30000)
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("**/hls/**", lambda r: r.abort())
    pg.goto("http://127.0.0.1:%d/index.html" % PORT, wait_until="domcontentloaded"); pg.wait_for_timeout(800)
    onboard(pg); to_mains(pg)

    print("\n== a reflection during the lecture")
    for _ in range(40):
        pg.wait_for_timeout(400)
        if pg.evaluate("document.querySelector('#sheet').classList.contains('on')"): break
    check("the lecture pauses and asks something", pg.evaluate("document.querySelector('#sheet').classList.contains('on')"))
    kind = pg.eval_on_selector(".sheet .chip.on", "e=>e.textContent") if pg.query_selector(".sheet .chip.on") else None
    check("it is a reflection, not a task", kind == "Reflection", "(%s)" % kind)
    prompt = (pg.eval_on_selector(".sheet .q-text", "e=>e.textContent") or "")
    check("the prompt is in a friend's voice, not an instruction",
          not prompt.strip().lower().startswith(("name one", "write ", "think of one")), prompt[:56] + "…")
    check("the button says what it will do", pg.eval_on_selector(".sheet .cta", "e=>e.textContent") == "Keep my reflection")
    pg.fill(".sheet textarea", MINE)
    pg.eval_on_selector(".sheet .cta", "b=>b.click()"); pg.wait_for_timeout(1400)

    def workbook_texts():
        pg.eval_on_selector('[data-tab=grow]', "b=>b.click()"); pg.wait_for_timeout(800)
        pg.evaluate("""()=>{const rows=[...document.querySelectorAll('.rowcard')];
          const w=rows.find(r=>/workbook/i.test(r.textContent)); w&&w.click();}""")
        pg.wait_for_timeout(900)
        return pg.evaluate("document.body.innerText")

    print("\n== does it reach the workbook")
    body = workbook_texts()
    check("my answer is in the workbook", MINE in body)
    check("the question it answered is there too", prompt.strip()[:40] in body, prompt.strip()[:40])

    print("\n== does it survive closing the app")
    pg.goto("http://127.0.0.1:%d/index.html" % PORT, wait_until="domcontentloaded"); pg.wait_for_timeout(1000)
    onboard(pg)
    body = workbook_texts()
    check("it is still there after a reload", MINE in body)

    check("no page errors", not errs, "; ".join(errs[:2]))
    b.close()

print("\nFAIL=%d" % len(fails))
sys.exit(1 if fails else 0)
