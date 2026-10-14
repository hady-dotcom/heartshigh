/* Hook / turn / land timings. Plain assertions, no browser. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..');
const context = vm.createContext({ console: console, window: {} });
vm.runInContext(fs.readFileSync(path.join(root, 'app/htl.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'app/data.js'), 'utf8'), context);
const HTL = context.HTL;
const D = context.window.HUDHUD;

let failed = 0;
function check(name, cond, extra) {
  if (cond) console.log('  ok  ' + name);
  else { failed++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

const hero = D.appetiserHero;
const caps = HTL.captions(hero);
check('hero captions are three beats in order',
  caps.length >= 3 && caps[0].role === 'hook' && caps[caps.length - 1].role === 'land');
check('hero cues sit inside the file window',
  caps.every(c => c.t0 >= 0 && c.t1 <= hero.len + 0.05 && c.t1 > c.t0));
check('hero cues do not run backwards',
  caps.every((c, i) => i === 0 || c.t0 >= caps[i - 1].t0 - 0.001));

const draft = HTL.draft(hero);
const heroNotes = HTL.assess(draft.beats, draft.window);
check('a short hero does not warn about length or the window',
  !heroNotes.some(n => n.code === 'long' || n.code === 'contain' || n.code === 'order'),
  JSON.stringify(heroNotes));

const trimmedHook = HTL.trimToSentence(hero.hook, caps, 'hook');
check('trim keeps a short line verbatim', trimmedHook.ok && trimmedHook.text === HTL.normalize(hero.hook));
check('trim snaps the short line onto caption times',
  trimmedHook.t0 === caps[0].t0 && trimmedHook.t1 === caps.filter(c => c.role === 'hook').slice(-1)[0].t1);

const long = D.reel.filter(c => HTL.wordCount(c.turn) > 30)[0];
check('the reel still has a run-on turn to trim', !!long, long && long.id);
if (long) {
  const lc = HTL.captions(long);
  const before = HTL.wordCount(long.turn);
  const result = HTL.trimToSentence(long.turn, lc, 'turn');
  const after = HTL.wordCount(result.text);
  check('trim shortens a run-on to one line', result.ok && result.shortened && after <= 25 && after < before,
    before + ' → ' + after + ' “' + result.text + '”');
  check('the trimmed line is a verbatim slice of the turn',
    HTL.normalize(long.turn).indexOf(result.text) !== -1);
  check('trimmed times are that caption cue',
    lc.some(c => c.role === 'turn' && c.text === result.text && c.t0 === result.t0 && c.t1 === result.t1));
  const raw = HTL.draft(long);
  check('the untrimmed turn warns over 30 words',
    HTL.assess(raw.beats, raw.window).some(n => n.code === 'long' && n.role === 'turn'));
}

const outside = {
  hook: { text: 'One short hook that sits inside the window.', t0: 0, t1: 3 },
  turn: { text: 'The turn stays inside the window as well today.', t0: 4, t1: 8 },
  land: { text: 'The land runs past the end of this clip window.', t0: 9, t1: 40 },
};
const win = { start: 0, end: 18, len: 18 };
const outNotes = HTL.assess(outside, win);
check('a land past the window warns that all three are not contained',
  outNotes.some(n => n.code === 'contain'));

const swapped = {
  hook: { text: 'Hook line that should have come first here.', t0: 8, t1: 12 },
  turn: { text: 'Turn line that arrived before the hook did.', t0: 1, t1: 4 },
  land: { text: 'Land line that still belongs at the end here.', t0: 13, t1: 17 },
};
check('out-of-order beats are flagged',
  HTL.assess(swapped, win).some(n => n.code === 'order'));

const fine = {
  hook: { text: 'A hook of about ten words is enough here.', t0: 0.4, t1: 4 },
  turn: { text: 'The turn follows it and stays inside the cut.', t0: 4.2, t1: 9 },
  land: { text: 'The land arrives last and closes the moment.', t0: 9.2, t1: 15 },
};
check('three in-window lines in order are clean', HTL.assess(fine, win).length === 0);

const invented = HTL.trimToSentence(
  'totally different words that were never spoken in this moment and keep going on well past the point where a single line should have stopped already',
  caps, 'hook');
check('trim refuses to invent a line the captions do not contain',
  invented.ok === false && HTL.wordCount(invented.text) > 25);

HTL.save('unit-clip', {
  delivery: 'kinetic', style: 'windows', background: 'mask', mask: 'arch',
  solid: 'ground', gradient: 'dusk',
  beats: fine,
});
const fed = HTL.forFeed({ id: 'unit-clip', hook: 'x', turn: 'y', land: 'z', len: 18, treatment: 'cinema' });
check('a saved choice is what the feed reads back',
  fed && fed.persisted && fed.delivery === 'kinetic' && fed.style === 'windows' && fed.background === 'mask'
  && fed.beats.land.text === fine.land.text);
check('an unsaved clip does not change the feed', HTL.forFeed(hero) === null);

const seq = {
  hook: { text: 'Hook line for the opening of this moment.', t0: 0, t1: 4 },
  turn: { text: 'Turn line that follows once the hook has spoken.', t0: 4.2, t1: 9 },
  land: { text: 'Land line that closes the moment on its own.', t0: 9.2, t1: 15 },
};
check('only the hook is up during its audio', HTL.activeRole(seq, 1.2) === 'hook');
check('the turn replaces the hook when its audio starts', HTL.activeRole(seq, 6) === 'turn');
check('the land replaces the turn when its audio starts', HTL.activeRole(seq, 12) === 'land');
check('a saved blurred frame is not the kinetic background', (function () {
  HTL.save('blur-clip', {
    delivery: 'kinetic', style: 'kinetic', background: 'blur', mask: 'arch',
    solid: 'ground', gradient: 'dusk', beats: seq,
  });
  var d = HTL.draft({ id: 'blur-clip', hook: 'a', turn: 'b', land: 'c', len: 18 });
  return d.background === 'gradient' && d.style === 'kinetic';
})());

console.log(failed ? '\n' + failed + ' failed' : '\nall passed');
process.exit(failed ? 1 : 0);
