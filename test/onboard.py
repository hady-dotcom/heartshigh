"""The app opens on the welcome screen and then straight into hors d'oeuvres.
Every suite that wants a later screen has to walk through the door first."""
def onboard(pg, tab=None):
    # Onboarding is remembered, so a reload inside a suite skips the welcome screen.
    try: pg.wait_for_selector(".wl-go", timeout=4000)
    except Exception:
        if tab:
            pg.eval_on_selector('[data-tab=%s]' % tab, "b=>b.click()"); pg.wait_for_timeout(700)
        return
    pg.fill(".wl-input", "Leon")
    pg.eval_on_selector_all(".wl-block .wl-opt", "e=>e[0].click()")
    pg.evaluate("""()=>{const bs=[...document.querySelectorAll('.wl-block')][1].querySelectorAll('.wl-opt');
        bs[0].click(); bs[3].click();}""")
    pg.eval_on_selector(".wl-go", "b=>b.click()")
    pg.wait_for_timeout(900)
    if tab:
        pg.eval_on_selector('[data-tab=%s]' % tab, "b=>b.click()")
        pg.wait_for_timeout(700)

def to_mains(pg):
    """The real route into the lecture: slide -> Learn more -> appetiser -> Start this course."""
    # Home is the reel, wherever the suite happens to have wandered to.
    if not pg.query_selector(".cardclip.slide .sl-cta"):
        pg.eval_on_selector('[data-tab=home]', "b=>b.click()"); pg.wait_for_timeout(700)
    pg.wait_for_selector(".cardclip.slide .sl-cta", timeout=15000)
    pg.eval_on_selector(".cardclip.slide:last-of-type .sl-cta", "b=>b.click()")
    pg.wait_for_timeout(1200)
    pg.wait_for_selector(".cta", timeout=15000)
    pg.eval_on_selector(".cta", "b=>b.click()")
    # Wait for the lecture to be genuinely playing, not merely mounted: the HLS source is
    # unreachable in the sandbox, so the local plate has to take over first. A reflection
    # may fire while we wait — wave it through, the suite is testing the controls.
    for _ in range(40):
        pg.wait_for_timeout(300)
        if pg.evaluate("document.querySelector('#sheet').classList.contains('on')"):
            pg.evaluate("()=>{const b=document.querySelector('.sheet .more');"
                        "if(b){b.click();return;} const sc=document.querySelector('#scrim'); sc&&sc.click();}")
            pg.wait_for_timeout(600)
            pg.evaluate("""()=>{const s=[...document.querySelectorAll('.screen')].filter(n=>n.style.display!=='none');
                const b=s[s.length-1] && s[s.length-1].querySelector('.pl-btn'); b&&b.click();}""")
            pg.wait_for_timeout(400)
        if pg.evaluate("""(()=>{const s=[...document.querySelectorAll('.screen')].filter(n=>n.style.display!=='none');
            const v=s[s.length-1] && s[s.length-1].querySelector('video');
            return !!(v && !v.paused && v.currentTime > 0.2)})()"""): return
