/** Keeps each demo iframe on its own path prefix, and on its own session cookie. */

export function demoFrameBootScript() {
  return `(function(){
    var name = window.name || '';
    var match = /^hearts-demo-(master|portal|teacher|learner)$/.exec(name);
    if (!match) return;
    var slot = match[1];
    var prefix = '/demo-stage/as/' + slot;
    function fix(url) {
      try {
        var u = new URL(url, location.origin);
        if (u.origin !== location.origin) return url;
        if (u.pathname.indexOf(prefix) === 0) return u.pathname + u.search + u.hash;
        if (u.pathname.indexOf('/_next/') === 0 || u.pathname.indexOf('/icons/') === 0 || u.pathname.indexOf('/favicon') === 0) return url;
        return prefix + (u.pathname.charAt(0) === '/' ? u.pathname : '/' + u.pathname) + u.search + u.hash;
      } catch (e) { return url; }
    }
    if (location.pathname.indexOf(prefix) !== 0) {
      location.replace(fix(location.href));
      return;
    }
    var push = history.pushState;
    var replace = history.replaceState;
    history.pushState = function(state, title, url) {
      if (typeof url === 'string') url = fix(url);
      return push.call(this, state, title, url);
    };
    history.replaceState = function(state, title, url) {
      if (typeof url === 'string') url = fix(url);
      return replace.call(this, state, title, url);
    };
    document.addEventListener('click', function(event) {
      var node = event.target;
      var link = node && node.closest ? node.closest('a[href]') : null;
      if (!link) return;
      var href = link.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || /^(mailto:|tel:|javascript:)/i.test(href)) return;
      var next = fix(href);
      if (next !== href) link.setAttribute('href', next);
    }, true);
    document.addEventListener('submit', function(event) {
      var form = event.target;
      if (!form || !form.getAttribute) return;
      var action = form.getAttribute('action') || '';
      if (!action) return;
      var next = fix(action);
      if (next !== action) form.setAttribute('action', next);
    }, true);
    var orig = window.fetch;
    if (orig) {
      window.fetch = function(input, init) {
        if (typeof input === 'string') input = fix(input);
        else if (input && input.url) {
          var next = fix(input.url);
          if (next !== input.url) input = new Request(next, input);
        }
        return orig.call(this, input, init);
      };
    }
  })();`
}
