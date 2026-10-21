(function () {
  'use strict';

  /*SOLVERS-START*/
  var GOAL = '012345678';
  var NEI = [];
  (function () {
    for (var i = 0; i < 9; i++) {
      var r = Math.floor(i / 3), c = i % 3, l = [];
      if (r > 0) l.push(['Up', i - 3]);
      if (r < 2) l.push(['Down', i + 3]);
      if (c > 0) l.push(['Left', i - 1]);
      if (c < 2) l.push(['Right', i + 1]);
      NEI.push(l);
    }
  })();

  function swap(s, i, j) {
    if (i > j) { var t = i; i = j; j = t; }
    return s.slice(0, i) + s[j] + s.slice(i + 1, j) + s[i] + s.slice(j + 1);
  }
  function inversions(s) {
    var n = 0;
    for (var i = 0; i < 9; i++) for (var j = i + 1; j < 9; j++) {
      if (s[i] !== '0' && s[j] !== '0' && s[i] > s[j]) n++;
    }
    return n;
  }
  function parseState(text) {
    var d = String(text).replace(/[^0-9]/g, '');
    if (d.length !== 9) return null;
    var seen = {};
    for (var i = 0; i < 9; i++) {
      var ch = d[i];
      if (ch === '9' || seen[ch]) return null;
      seen[ch] = 1;
    }
    return d;
  }

  /* ---------- solver server ---------- */
  var SERVER_URL = 'http://localhost:8080/solve';
  var SOLVE_TIMEOUT_MS = 60000;

  /* key = this page's id, server = the server's algorithm name sent in the request
     and used as the key of the `results` map in the response. Adjust to match your enum. */
  var ALGOS = [
    { key: 'bfs', label: 'BFS', server: 'BFS' },
    { key: 'dfs', label: 'DFS', server: 'DFS' },
    { key: 'iddfs', label: 'Iterative DFS', server: 'IDDFS' },
    { key: 'astar-m', label: 'A* (Manhattan)', server: 'ASTAR_MANHATTAN' },
    { key: 'astar-e', label: 'A* (Euclidean)', server: 'ASTAR_EUCLIDEAN' }
  ];
  var ALGO_BY_KEY = {};
  ALGOS.forEach(function (a) { ALGO_BY_KEY[a.key] = a; });

  /* SolveResult (server) -> the result object the rest of the page uses */
  function fromServer(key, init, r) {
    var names = (r.moves || '').split('').map(function (ch) {
      if (!NAME[ch]) throw new Error('Server sent an unknown move "' + ch + '".');
      return NAME[ch];
    });
    return { algo: ALGO_BY_KEY[key].label, initial: init, moves: names, solved: !!r.solved,
      cost: r.cost, expanded: r.expanded, generated: r.generated,
      goalDepth: r.solved ? r.goalDepth : null, maxDepth: r.maxDepth,
      peak: r.peakFrontier, ms: r.ms };
  }

  /* One POST for any number of algorithms. Resolves to { uiKey: result }. */
  async function requestSolve(init, keys) {
    var res;
    try {
      res = await fetch(SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initialConfiguration: init,
          algorithms: keys.map(function (k) { return ALGO_BY_KEY[k].server; })
        }),
        signal: AbortSignal.timeout(SOLVE_TIMEOUT_MS)
      });
    } catch (err) {
      throw new Error(err.name === 'TimeoutError'
          ? 'The solver did not answer within ' + (SOLVE_TIMEOUT_MS / 1000) + ' s.'
          : 'Could not reach the solver at ' + SERVER_URL + '. Is the solver server running?');
    }
    var data = null;
    try { data = await res.json(); } catch (err) { /* non-JSON body */ }
    if (!res.ok) throw new Error((data && data.Error) || 'Solver error: HTTP ' + res.status + '.');
    if (!data || !data.results) throw new Error('Unexpected response: no "results" field.');
    var out = {};
    keys.forEach(function (k) {
      var r = data.results[ALGO_BY_KEY[k].server];
      if (!r) throw new Error('The response has no result for ' + ALGO_BY_KEY[k].label + '.');
      out[k] = fromServer(k, init, r);
    });
    return out;
  }
  /*SOLVERS-END*/

  var LETTER = { Up: 'U', Down: 'D', Left: 'L', Right: 'R' };
  var NAME = { U: 'Up', D: 'Down', L: 'Left', R: 'Right' };

  function applyMoves(init, moves) {
    var out = [init], s = init;
    for (var i = 0; i < moves.length; i++) {
      var z = s.indexOf('0'), nb = NEI[z], to = -1;
      for (var k = 0; k < nb.length; k++) if (nb[k][0] === moves[i]) to = nb[k][1];
      if (to < 0) throw new Error('Move ' + (i + 1) + ' (' + moves[i] + ') is not legal from that board.');
      s = swap(s, z, to);
      out.push(s);
    }
    return out;
  }

  /* ---------- sprite: the Lighthouse of Alexandria, 24 x 24 pixels ---------- */
  var PAL = ['#151F4A', '#2B3A82', '#6A4A9C', '#D9719A', '#F4A261', '#0E4C6B', '#1B7A94', '#5DB6C4', '#EADFC4',
    '#BBA77F', '#6E5F46', '#FFD95A', '#FFF1B0', '#3B3A46', '#66647A', '#7A4A2B', '#FFFFFF'];
  function buildSprite() {
    var W = 24, px = new Uint8Array(W * W);
    function set(x, y, c) { if (x >= 0 && x < W && y >= 0 && y < W) px[y * W + x] = c; }
    function rect(x0, y0, x1, y1, c) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) set(x, y, c); }
    var x, y;
    for (y = 0; y < 17; y++) rect(0, y, 23, y, y < 6 ? 0 : y < 10 ? 1 : y < 14 ? 2 : y < 16 ? 3 : 4);
    [[5, 1], [9, 2], [13, 3], [15, 4]].forEach(function (b) {
      for (x = 0; x < W; x++) if ((x + b[0]) % 2 === 0) set(x, b[0], b[1]);
    });
    [[2, 1], [9, 0], [16, 1], [5, 4], [13, 6], [1, 7], [22, 7], [6, 2]].forEach(function (p) { set(p[0], p[1], 16); });
    for (y = 1; y < 8; y++) for (x = 17; x < 24; x++) {
      var d1 = (x - 20) * (x - 20) + (y - 4) * (y - 4) <= 5;
      var d2 = (x - 21) * (x - 21) + (y - 3.4) * (y - 3.4) <= 4.4;
      if (d1 && !d2) set(x, y, 12);
    }
    rect(3, 9, 4, 9, 3); rect(2, 10, 5, 10, 3); rect(1, 11, 7, 11, 3);
    rect(19, 11, 21, 11, 3); rect(17, 12, 23, 12, 3);
    rect(0, 17, 23, 19, 6); rect(0, 20, 23, 23, 5);
    for (x = 0; x < W; x++) if (x % 2 === 0) set(x, 19, 5);
    for (y = 17; y < 23; y++) for (x = 0; x < W; x++) if ((x * 5 + y * 3) % 13 === 0) set(x, y, 7);
    var rock = [[6, 17], [4, 19], [2, 21], [0, 23]];
    rock.forEach(function (r, i) {
      var yy = 20 + i;
      rect(r[0], yy, r[1], yy, 13);
      for (x = r[0]; x <= r[1]; x++) if ((x * 3 + yy * 7) % 9 === 0 || x < r[0] + 2) set(x, yy, 14);
    });
    function tier(x0, x1, y0, y1) {
      for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) {
        var f = (xx - x0) / (x1 - x0 + 1);
        set(xx, yy, xx === x1 ? 10 : f < 0.4 ? 8 : 9);
      }
    }
    tier(8, 15, 13, 19); tier(9, 14, 8, 12); tier(10, 13, 5, 7);
    rect(7, 13, 16, 13, 10); rect(8, 8, 15, 8, 10); rect(9, 4, 14, 4, 10);
    rect(11, 18, 12, 19, 10);
    set(10, 15, 11); set(13, 15, 11); set(11, 10, 11); set(12, 10, 11); set(11, 6, 11);
    rect(11, 2, 12, 3, 11); rect(11, 1, 12, 1, 10);
    [[10, 2], [13, 2], [10, 3], [13, 3], [7, 3], [9, 3], [14, 3], [16, 3], [8, 2], [15, 2]].forEach(function (p) { set(p[0], p[1], 12); });
    set(19, 14, 8); rect(18, 15, 19, 15, 8); rect(17, 16, 19, 16, 8); rect(20, 13, 20, 17, 15); rect(17, 18, 21, 18, 15);
    return px;
  }
  var spriteCv = document.createElement('canvas');
  spriteCv.width = 24; spriteCv.height = 24;
  (function () {
    var sctx = spriteCv.getContext('2d'), img = sctx.createImageData(24, 24), px = buildSprite();
    for (var i = 0; i < px.length; i++) {
      var h = PAL[px[i]];
      img.data[i * 4] = parseInt(h.slice(1, 3), 16);
      img.data[i * 4 + 1] = parseInt(h.slice(3, 5), 16);
      img.data[i * 4 + 2] = parseInt(h.slice(5, 7), 16);
      img.data[i * 4 + 3] = 255;
    }
    sctx.putImageData(img, 0, 0);
  })();

  /* ---------- sound: everything is synthesised with Web Audio, so there are no audio files ----------
     Browsers only allow audio after a click or key press, so the engine wakes up on the first one. */
  var sfx = (function () {
    var AC = window.AudioContext || window.webkitAudioContext;
    var ctx = null, master = null, noiseBuf = null, amb = null, pulses = {};
    var lastMove = 0, unlocked = false, muted = false, watching = false, api = {};
    try { muted = localStorage.getItem('lighthouse-muted') === '1'; } catch (e) { /* storage blocked */ }

    function ensure() {
      if (!AC || !unlocked) return false;
      if (!ctx) {
        ctx = new AC();
        var comp = ctx.createDynamicsCompressor();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.8;
        master.connect(comp); comp.connect(ctx.destination);
        var n = ctx.sampleRate * 2, d;
        noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
        d = noiseBuf.getChannelData(0);
        for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }

    /* one pitched blip with a quick envelope; slideTo glides the pitch */
    function tone(freq, t, dur, type, vol, slideTo, dest) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest || master);
      o.start(t); o.stop(t + dur + 0.05);
    }
    /* filtered noise burst; the filter sweeps f0 -> f1, att = seconds to reach full volume */
    function noise(t, dur, vol, type, f0, f1, q, att) {
      var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf; s.loop = true;
      f.type = type; f.Q.value = q || 1;
      f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (att || Math.min(0.02, dur / 3)));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(master);
      s.start(t, Math.random()); s.stop(t + dur + 0.05);
    }
    function bell(t, vol, pan) {
      var dest = master;
      if (ctx.createStereoPanner) { dest = ctx.createStereoPanner(); dest.pan.value = pan; dest.connect(master); }
      [[392, 1, 2.8], [784, 0.5, 1.8], [1176, 0.25, 1.0], [1568, 0.12, 0.6]].forEach(function (p) {
        tone(p[0], t, p[2], 'sine', vol * p[1], 0, dest);
      });
    }

    api.unlock = function () { unlocked = true; ensure(); };

    /* a tile lands: a short wooden tick, pitched a little differently per tile */
    api.move = function (v) {
      if (muted || !ensure()) return;
      var now = performance.now();
      if (now - lastMove < 40) return;                 /* fast playback: keep it a clatter, not a buzz */
      lastMove = now;
      var t = ctx.currentTime, f = 150 + (v || 0) * 12;
      tone(f * 1.6, t, 0.07, 'square', 0.07, f * 0.8);
      noise(t, 0.05, 0.16, 'bandpass', 2200, 900, 1.4);
    };
    /* the last tile is home: a rising arpeggio and a held chord */
    api.solved = function () {
      if (muted || !ensure()) return;
      var t = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (f, i) {
        tone(f, t + i * 0.085, 0.45, 'triangle', 0.13);
        tone(f * 2, t + i * 0.085, 0.16, 'square', 0.03);
      });
      [523.25, 659.25, 783.99].forEach(function (f) { tone(f, t + 0.45, 0.9, 'triangle', 0.07); });
    };
    /* the nine tiles snap into one picture */
    api.fuse = function () {
      if (muted || !ensure()) return;
      var t = ctx.currentTime;
      tone(988, t, 0.16, 'square', 0.05);
      tone(1976, t, 0.35, 'sine', 0.07);
      noise(t, 0.12, 0.08, 'highpass', 3000, 6000, 0.7);
    };
    /* the picture leaves the board and sinks into the sky: a retro power-up glide */
    function swell(type, f0, f1, t, dur, vol) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.05);
    }
    api.whoosh = function () {
      if (muted || !ensure()) return;
      var t = ctx.currentTime;
      swell('square', 196, 1175, t, 1.5, 0.035);
      swell('triangle', 294, 1760, t + 0.03, 1.5, 0.07);
      swell('triangle', 98, 587, t, 1.5, 0.09);
    };
    /* the lamp lights: a low thunk, a glassy bell and a shimmer */
    api.ignite = function () {
      if (muted || !ensure()) return;
      var t = ctx.currentTime;
      tone(80, t, 0.32, 'sine', 0.25, 45);
      bell(t + 0.05, 0.09, 0);
      [1568, 2093, 2637, 3136, 4186].forEach(function (f, i) { tone(f, t + 0.1 + i * 0.07, 0.6, 'sine', 0.03); });
    };

    /* ambience: a slow, dreamy chiptune loop. Pulse-wave arpeggios and a triangle bass over a soft pad, a sparse
       pentatonic melody wandering above, everything washed through a gentle echo. It never repeats exactly. */
    function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    function pulse(d) {                                  /* a pulse wave with duty d, the hollow NES voice */
      if (!pulses[d]) {
        var n = 48, re = new Float32Array(n + 1), im = new Float32Array(n + 1);
        for (var k = 1; k <= n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * d);
        pulses[d] = ctx.createPeriodicWave(re, im);
      }
      return pulses[d];
    }
    function voice(wave, freq, t, dur, vol, att, dest) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      if (typeof wave === 'string') o.type = wave; else o.setPeriodicWave(wave);
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + att);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest);
      o.start(t); o.stop(t + dur + 0.05);
    }
    var CHORDS = [                                       /* Cmaj7, Am7, Fmaj7, G6: two bars each */
      { bass: 48, tones: [48, 52, 55, 59] },
      { bass: 45, tones: [45, 48, 52, 55] },
      { bass: 41, tones: [41, 45, 48, 52] },
      { bass: 43, tones: [43, 47, 50, 52] }
    ];
    var ARP = [0, 1, 2, 3, 2, 1, 2, 3];                  /* one bar of eighth notes */
    var SCALE = [72, 74, 76, 79, 81, 84, 86, 88];        /* C major pentatonic, C5 to E6 */

    api.ambStart = function () {
      if (!ensure() || amb) return;
      var t0 = ctx.currentTime, eighth = 60 / 72 / 2;
      var out = ctx.createGain();
      out.gain.setValueAtTime(0, t0);
      out.gain.linearRampToValueAtTime(watching ? 1.3 : 1, t0 + 3);
      out.connect(master);

      /* shared buses: a soft lowpass for the arpeggio and lead, a dotted echo behind them, a warm pad bus */
      var bus = ctx.createBiquadFilter(), send = ctx.createGain(), echo = ctx.createDelay(2), fb = ctx.createGain(), fl = ctx.createBiquadFilter();
      bus.type = 'lowpass'; bus.frequency.value = 2600; bus.connect(out);
      send.gain.value = 0.5; bus.connect(send); send.connect(echo);
      echo.delayTime.value = eighth * 3; fb.gain.value = 0.38; fl.type = 'lowpass'; fl.frequency.value = 2200;
      echo.connect(fl); fl.connect(fb); fb.connect(echo); fl.connect(out);
      var padBus = ctx.createBiquadFilter();
      padBus.type = 'lowpass'; padBus.frequency.value = 1100; padBus.connect(out);

      var step = 0, next = t0 + 0.25, lead = 3, quiet = 0;
      function play(n, t) {
        var bar = Math.floor(n / 8) % 8, s = n % 8, c = CHORDS[Math.floor(bar / 2)];
        if (s === 0 && bar % 2 === 0) c.tones.forEach(function (m) { voice('triangle', mtof(m + 12), t, eighth * 15, 0.02, 1.4, padBus); });
        if (s === 0 || s === 4) voice('triangle', mtof(c.bass), t, eighth * 3.6, 0.17, 0.012, out);
        voice(pulse(0.25), mtof(c.tones[ARP[s]] + 12), t, eighth * 1.4, 0.05, 0.008, bus);
        if (s === 2 || s === 6) {                         /* a tiny tick on beats two and four */
          noise(t, 0.03, 0.017, 'highpass', 7000, 9000, 0.7);
        }
        if (n >= 8 && (s === 0 || s === 3 || s === 6)) {
          if (s === 0 && Math.random() < 0.3) quiet = 1;  /* sometimes leave a whole bar to breathe */
          else if (s === 0) quiet = 0;
          if (!quiet && Math.random() < 0.55) {
            lead = Math.max(0, Math.min(SCALE.length - 1, lead + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
            voice(pulse(0.5), mtof(SCALE[lead]), t, eighth * 4, 0.07, 0.03, bus);
          }
        }
      }
      function schedule() {
        while (next < ctx.currentTime + 0.5) { play(step, next); next += eighth; step++; }
      }
      schedule();
      amb = {
        out: out,
        timer: setInterval(schedule, 120),
        sparkle: function () {                            /* a high little chime for each flash of the beam */
          voice(pulse(0.5), mtof(SCALE[5 + Math.floor(Math.random() * 3)]), ctx.currentTime + 0.01, 0.55, 0.045, 0.01, bus);
        },
        armed: true
      };
    };
    api.ambStop = function () {
      if (!amb) return;
      var a = amb; amb = null;
      clearInterval(a.timer);
      a.out.gain.cancelScheduledValues(ctx.currentTime);
      a.out.gain.setTargetAtTime(0, ctx.currentTime, 0.35);
      setTimeout(function () { a.out.disconnect(); }, 9000);   /* let the pad and echo tails die out silently */
    };
    api.beam = function (level) {                         /* 0..1: how squarely the beam faces you */
      if (!amb) return;
      if (level > 0.85 && amb.armed) { amb.armed = false; if (!muted) amb.sparkle(); }
      else if (level < 0.4) amb.armed = true;
    };
    api.setWatch = function (on) {                      /* nothing else on screen: let the music come forward */
      watching = on;
      if (amb) amb.out.gain.setTargetAtTime(on ? 1.3 : 1, ctx.currentTime, 0.6);
    };
    api.isMuted = function () { return muted; };
    api.toggleMute = function () {
      muted = !muted;
      try { localStorage.setItem('lighthouse-muted', muted ? '1' : '0'); } catch (e) { /* storage blocked */ }
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.05);
      return muted;
    };
    document.addEventListener('visibilitychange', function () {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else if (unlocked) ctx.resume();
    });
    return api;
  })();

  /* ---------- beacon: once the lighthouse is whole it sinks into the sky, then lights up ----------
     Three full-screen canvases: a top layer for the flight, a background layer for the night and the
     tower, and a screen-blended layer for the light. Tweak BEACON to taste. */
  var BEACON = {
    x: 'auto',        /* 'auto' = in the empty margin beside the layout when there is room, else centred; or a number 0..1 */
    night: 0.45,      /* how dark the sky gets once the lamp is lit, 0..1 */
    towerDim: 0.4,    /* how far the tower is tinted toward the night sky, 0..1 */
    beam: 0.9,        /* beam strength, 0..1 */
    sweepSecs: 8      /* seconds per full turn of the lamp */
  };
  var beacon = (function () {
    var FLY = 1300, SINK = 900, IGNITE = 1800, FADE = 700, LOWPX = 5;
    var cFly = document.getElementById('beacon-fly'), cBg = document.getElementById('beacon-bg'), cLit = document.getElementById('beacon-light');
    var fx = cFly.getContext('2d'), bx = cBg.getContext('2d'), lx = cLit.getContext('2d');
    var low = document.createElement('canvas'), lowx = low.getContext('2d');   /* chunky light buffer */
    var api = { onLit: null };
    var st = { on: false, fading: false, t0: 0, outT0: 0, from: null };
    var geo = null, W = 0, H = 0, raf = 0, wasLit = false, watch = false, curX = 0, lastNow = 0;
    var FLICKER = [1, 0.4, 0.8, 0.2, 0.9, 0.6];

    function clamp(v) { return Math.max(0, Math.min(1, v)); }
    function ease(v) { return v * v * (3 - 2 * v); }
    function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
    function mk() { var c = document.createElement('canvas'); c.width = 24; c.height = 24; return c; }

    /* tower = the sprite without its sky, sea and moon; lamp pixels go on a separate layer so they can switch on */
    var towerBase = mk(), towerEmit = mk();
    (function () {
      var px = buildSprite(), sky = [16, 28, 53];
      var a = towerBase.getContext('2d'), b = towerEmit.getContext('2d');
      var ia = a.createImageData(24, 24), ib = b.createImageData(24, 24);
      for (var i = 0; i < px.length; i++) {
        var idx = px[i], x = i % 24, y = (i / 24) | 0, moon = x >= 17 && y <= 8;
        var emit = (idx === 11 || idx === 12) && !moon;
        var solid = idx === 8 || idx === 9 || idx === 10 || idx === 13 || idx === 14 || idx === 15;
        if (!emit && !solid) continue;
        var c = hex(PAL[idx]), k = emit ? 0.72 : BEACON.towerDim, j;
        for (j = 0; j < 3; j++) ia.data[i * 4 + j] = Math.round(c[j] + (sky[j] - c[j]) * k);
        ia.data[i * 4 + 3] = 255;
        if (emit) {
          for (j = 0; j < 3; j++) ib.data[i * 4 + j] = c[j];
          ib.data[i * 4 + 3] = 255;
        }
      }
      a.putImageData(ia, 0, 0);
      b.putImageData(ib, 0, 0);
    })();

    function geometry() {
      W = window.innerWidth; H = window.innerHeight;
      [cFly, cBg, cLit].forEach(function (c) { c.width = W; c.height = H; });
      low.width = Math.ceil(W / LOWPX); low.height = Math.ceil(H / LOWPX);
      var seaTop = document.querySelector('.pixel-sea').getBoundingClientRect().top;
      var P = Math.max(4, Math.min(30, Math.floor((seaTop - 40) * 0.78 / 19.5)));
      P = Math.max(2, Math.min(P, Math.floor(W / 26)));            /* stay inside narrow screens */
      var cx = Math.round(W * 0.5);
      if (watch) cx = Math.round(W * 0.5);                      /* watch mode: nothing else on screen, so centre it */
      else if (typeof BEACON.x === 'number') cx = Math.round(W * BEACON.x);
      else {
        var wr = document.querySelector('.wrap').getBoundingClientRect(), room = W - wr.right;
        if (room >= 9 * P + 20) cx = Math.min(Math.round(wr.right + room / 2), Math.round(W - 9.5 * P));
      }
      var X = cx - 12 * P, Y = Math.round(seaTop - 18.5 * P);
      geo = { P: P, X: X, Y: Y, w: 24 * P, seaTop: seaTop, lx: cx, ly: Y + 3 * P, cxT: cx };   /* lamp = sprite (12, 3) */
    }

    function wedge(c, x0, y0, x1, y1, x2, y2) {
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x2, y2); c.closePath(); c.fill();
    }

    function draw(now) {
      var dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000)); lastNow = now;
      curX = reduced ? geo.cxT : curX + (geo.cxT - curX) * (1 - Math.exp(-dt * 3));   /* glide when the target moves */
      var cx = Math.round(curX);
      geo.X = cx - 12 * geo.P; geo.lx = cx;
      var t = now - st.t0;
      var m = st.fading ? 1 - clamp((now - st.outT0) / FADE) : 1;
      var f = ease(clamp(t / FLY)), s = clamp((t - FLY) / SINK);
      var gl = ease(clamp((t - FLY - SINK * 0.5) / IGNITE)) * m;
      var fl = reduced ? 1 : 0.88 + 0.12 * FLICKER[Math.floor(now / 90) % 6];
      var i, a;

      /* top layer: the whole picture flies from the board to its place in the sky, with a chunky after-image */
      fx.clearRect(0, 0, W, H);
      if (s < 1) {
        fx.imageSmoothingEnabled = false;
        var r0 = st.from;
        for (var gi = 2; gi >= 0; gi--) {
          var ff = ease(clamp(t / FLY - gi * 0.07)), w = r0.w + (geo.w - r0.w) * ff;
          fx.globalAlpha = (gi === 0 ? 1 : 0.2 / gi) * (1 - s) * m;
          fx.drawImage(spriteCv, 0, 0, 24, 24, Math.round(r0.x + (geo.X - r0.x) * ff), Math.round(r0.y + (geo.Y - r0.y) * ff), Math.round(w), Math.round(w));
        }
        fx.globalAlpha = 1;
      }

      /* background layer: night falls, the tower appears behind the interface, the lamp switches on */
      bx.clearRect(0, 0, W, H);
      bx.fillStyle = 'rgba(3,8,22,' + (BEACON.night * clamp(t / (FLY + SINK)) * m).toFixed(3) + ')';
      bx.fillRect(0, 0, W, H);
      bx.imageSmoothingEnabled = false;
      bx.globalAlpha = s * m;
      bx.drawImage(towerBase, 0, 0, 24, 24, geo.X, geo.Y, geo.w, geo.w);
      bx.globalAlpha = s * gl * fl;
      bx.drawImage(towerEmit, 0, 0, 24, 24, geo.X, geo.Y, geo.w, geo.w);
      bx.globalAlpha = 1;

      /* light layer: halo and two beams drawn at 1/5 resolution, then scaled up so the light is pixel-art too */
      lowx.clearRect(0, 0, low.width, low.height);
      var k = 1 / LOWPX, Lx = geo.lx * k, Ly = geo.ly * k, g = gl * BEACON.beam;
      var Rh = geo.P * 10 * k, halo = lowx.createRadialGradient(Lx, Ly, 0, Lx, Ly, Rh), gh = gl * fl;
      halo.addColorStop(0, 'rgba(255,238,170,' + (0.95 * gh).toFixed(3) + ')');
      halo.addColorStop(0.3, 'rgba(255,205,105,' + (0.4 * gh).toFixed(3) + ')');
      halo.addColorStop(1, 'rgba(255,170,60,0)');
      lowx.fillStyle = halo;
      lowx.fillRect(Lx - Rh, Ly - Rh, 2 * Rh, 2 * Rh);

      /* the lamp turns; seen from the side a beam stretches out, shrinks to nothing, then comes out the other way */
      var phi = reduced ? 0.5 : (now / (BEACON.sweepSecs * 1000)) * Math.PI * 2, Lmax = W * 0.8 * k;
      for (i = 0; i < 2; i++) {
        var ph = phi + i * Math.PI, dx = Math.cos(ph), fc = Math.sin(ph);   /* fc > 0: pointing at the viewer */
        var len = Lmax * Math.abs(dx);
        if (len < 2) continue;
        var side = dx >= 0 ? 1 : -1, ex = Lx + side * len, ey = Ly + len * (0.05 + 0.05 * fc);
        var hw = len * (0.04 + 0.05 * Math.max(0, fc));
        a = g * (0.45 + 0.5 * Math.max(0, fc));
        var grad = lowx.createLinearGradient(Lx, Ly, ex, ey);
        grad.addColorStop(0, 'rgba(255,240,180,' + a.toFixed(3) + ')');
        grad.addColorStop(0.55, 'rgba(255,215,125,' + (a * 0.35).toFixed(3) + ')');
        grad.addColorStop(1, 'rgba(255,200,100,0)');
        lowx.fillStyle = grad;
        wedge(lowx, Lx, Ly, ex, ey - hw, ex, ey + hw);
        wedge(lowx, Lx, Ly, ex, ey - hw * 0.4, ex, ey + hw * 0.4);   /* brighter core */
      }
      lx.clearRect(0, 0, W, H);
      lx.imageSmoothingEnabled = false;
      lx.drawImage(low, 0, 0, low.width * LOWPX, low.height * LOWPX);

      /* flash when a beam points straight at you: a pixel starburst on the lamp */
      sfx.beam(Math.pow(Math.abs(Math.sin(phi)), 2) * gl);
      var fa = Math.pow(Math.abs(Math.sin(phi)), 10) * gl, q = Math.max(2, Math.round(geo.P / 2));
      if (fa > 0.03) {
        var arm = Math.round(geo.P * 9 * fa / q) * q;
        lx.fillStyle = 'rgba(255,246,205,' + Math.min(1, 0.9 * fa).toFixed(3) + ')';
        lx.fillRect(geo.lx - arm, Math.round(geo.ly - q / 2), 2 * arm, q);
        lx.fillRect(Math.round(geo.lx - q / 2), Math.round(geo.ly - arm * 0.6), q, Math.round(arm * 1.2));
      }

      /* the lamp reflected in the sea: stepped dashes that shimmer */
      var step = Math.floor(now / 180);
      for (i = 0; i < 7; i++) {
        var wv = geo.P * (5 - i * 0.55), yy = geo.seaTop + geo.P * (1.8 + i * 0.9), jit = ((step + i * 3) % 3 - 1) * geo.P * 0.5;
        lx.fillStyle = 'rgba(255,224,140,' + (0.55 * gl * (1 - i / 8)).toFixed(3) + ')';
        lx.fillRect(Math.round(geo.lx - wv / 2 + jit), Math.round(yy), Math.round(wv), Math.max(2, Math.round(geo.P * 0.35)));
      }

      if (!wasLit && st.on && gl > 0.05) { wasLit = true; sfx.ignite(); sfx.ambStart(); if (api.onLit) api.onLit(); }
    }

    function hide() { [cFly, cBg, cLit].forEach(function (c) { c.style.display = 'none'; }); }

    function frame(now) {
      raf = 0;
      if (!st.on && !st.fading) return;
      if (st.fading && now - st.outT0 >= FADE) { st.fading = false; wasLit = false; hide(); return; }
      draw(now);
      raf = requestAnimationFrame(frame);
    }

    /* rect = where the finished picture sits on screen right now (x, y, w in CSS pixels) */
    api.start = function (rect) {
      geometry();
      curX = geo.cxT; lastNow = performance.now();
      st.on = true; st.fading = false; st.from = rect; wasLit = false;
      st.t0 = performance.now() - (reduced ? FLY + SINK + IGNITE + 50 : 0);   /* reduced motion: straight to the lit scene */
      [cFly, cBg, cLit].forEach(function (c) { c.style.display = 'block'; });
      if (!reduced) sfx.whoosh();
      draw(performance.now());                                              /* same frame as the board hands the picture over */
      if (!raf && !reduced) raf = requestAnimationFrame(frame);
    };
    api.stop = function () {
      if (!st.on) return;
      st.on = false;
      sfx.ambStop();
      if (reduced) { hide(); wasLit = false; return; }
      st.fading = true; st.outT0 = performance.now();
      if (!raf) raf = requestAnimationFrame(frame);
    };
    api.setWatch = function (on) {
      watch = on;
      if (st.on || st.fading) { geometry(); if (reduced) draw(performance.now()); }
    };
    api.on = function () { return st.on; };
    api.lit = function () { return st.on && wasLit; };
    window.addEventListener('resize', function () {
      if (!st.on && !st.fading) return;
      geometry();
      if (reduced) draw(performance.now());
    });
    return api;
  })();

  /* ---------- board drawing ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var cv = $('board'), ctx = cv.getContext('2d');
  var U = 16, T = 8 * U, G = U;
  var GLYPH = {
    0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
    3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
    6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '001', '010', '010'], 8: ['111', '101', '111', '101', '111']
  };
  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function slotXY(p) { return [G + (p % 3) * (T + G), G + Math.floor(p / 3) * (T + G)]; }
  function q(v) { return Math.round(v / U) * U; }

  function drawTile(v, x, y, alpha, badge) {
    var sx = (v % 3) * 8, sy = Math.floor(v / 3) * 8;
    ctx.globalAlpha = alpha;
    ctx.drawImage(spriteCv, sx, sy, 8, 8, x, y, T, T);
    if (badge !== null) {
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(x + 4, y + 4, T - 8, 4); ctx.fillRect(x + 4, y + 4, 4, T - 8);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x + 4, y + T - 8, T - 8, 4); ctx.fillRect(x + T - 8, y + 4, 4, T - 8);
      ctx.fillStyle = '#0B0F1A';
      ctx.fillRect(x, y, T, 4); ctx.fillRect(x, y + T - 4, T, 4); ctx.fillRect(x, y, 4, T); ctx.fillRect(x + T - 4, y, 4, T);
      if (badge) {
        var s = 4, bw = 3 * s + 12, bh = 5 * s + 12;
        ctx.fillStyle = 'rgba(10,14,26,0.88)';
        ctx.fillRect(x + 10, y + 10, bw, bh);
        ctx.fillStyle = '#FFFFFF';
        var g = GLYPH[v];
        for (var r = 0; r < 5; r++) for (var c = 0; c < 3; c++) if (g[r][c] === '1') ctx.fillRect(x + 16 + c * s, y + 16 + r * s, s, s);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- tile animation: idle bob, sheen sweep, landing bounce, victory hop ---------- */
  var BOB = [0, 0, -4, -4, -8, -4, -4, 0];
  var LAND = [-8, -12, -4, 0];
  var HOP = [0, -8, -16, -24, -16, -8, 0, 0, 0, 0, 0, 0];
  var land = null;

  function tileOffset(v, p, now, celebrate) {
    if (reduced) return 0;
    if (land && land.v === v) {
      var i = Math.floor((now - land.t0) / 70);
      if (i < LAND.length) return LAND[i];
      land = null;
    }
    if (celebrate) return HOP[((Math.floor(now / 70) - p) % 12 + 12) % 12];
    return BOB[Math.floor(now / 170 + v * 1.3) % 8];
  }

  /* a diagonal pixel-stepped glint that sweeps across the whole board, then rests */
  function sheen(bx, by, off, now, size) {
    size = size || T;
    if (reduced) return;
    var s = ((now / 14) % 2400) - 200, d = s - (bx + by), r, xx, x0, x1;
    if (d < -12 || d > size + 12 + size) return;
    ctx.fillStyle = 'rgba(255,255,255,0.34)';
    for (r = 0; r < size / 4; r++) {
      xx = d - r * 4;
      x0 = Math.max(0, xx); x1 = Math.min(size, xx + 12);
      if (x1 > x0) ctx.fillRect(bx + x0, by + off + r * 4, x1 - x0, 4);
    }
  }

  function sparkles(now) {
    var k = Math.floor(now / 220), i, x, y, ph;
    ctx.fillStyle = '#FFF1B0';
    for (i = 0; i < 14; i++) {
      ph = (k + i * 3) % 4;
      if (ph === 3) continue;
      x = ((i * 97 + (Math.floor((k + i) / 4)) * 53) % 27) * 16 + 8;
      y = ((i * 61 + (Math.floor((k + i) / 4)) * 29) % 27) * 16 + 8;
      var s = ph === 1 ? 8 : 4;
      ctx.fillRect(x - s, y - 2, s * 2, 4);
      ctx.fillRect(x - 2, y - s, 4, s * 2);
    }
  }


  /* ---------- merge: once solved, the nine tiles fuse into one lighthouse picture ---------- */
  var fused = false, mergeT0 = null, MERGE_HOLD = 450, MERGE_DUR = 1000;
  function drawMerged(now) {
    var el = now - mergeT0, i, p;
    var m = reduced ? 1 : Math.max(0, Math.min(1, (el - MERGE_HOLD) / MERGE_DUR));
    var steps = Math.round(m * 8);                 /* 8 chunky pixel steps */
    var g = G - steps * 2;                         /* gap: 16 -> 0 */
    var whole = steps === 8;
    if (whole && !fused) { fused = true; sfx.fuse(); }
    var size = 3 * T + 2 * g, ox = (cv.width - size) / 2, oy = ox;
    /* a moment after the pieces fuse, the picture leaves the board and sinks into the sky as the beacon */
    if (whole && !beacon.on() && el > (reduced ? 0 : MERGE_HOLD + MERGE_DUR + 900)) {
      var br = cv.getBoundingClientRect(), bs = br.width / cv.width;
      beacon.start({ x: br.left + ox * bs, y: br.top + oy * bs, w: size * bs });
    }
    if (beacon.on()) {                             /* the board keeps only its empty slots */
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      for (p = 0; p < 9; p++) { var sxy = slotXY(p); ctx.fillRect(sxy[0], sxy[1], T, T); }
      return;
    }
    var off = (whole && !reduced) ? BOB[Math.floor(now / 240) % 8] / 2 : 0;
    if (whole && off < 0) {                        /* soft shadow under the floating picture */
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(ox + 24, oy + size + 2, size - 48, 4);
    }
    for (p = 0; p < 9; p++) {
      var x = ox + (p % 3) * (T + g), y = oy + Math.floor(p / 3) * (T + g) + off;
      drawTile(p, x, y, 1, null);
      if (!whole) {                                /* tile borders fade as the pieces meet */
        var a = 1 - steps / 8;
        ctx.fillStyle = 'rgba(11,15,26,' + a.toFixed(2) + ')';
        ctx.fillRect(x, y, T, 4); ctx.fillRect(x, y + T - 4, T, 4);
        ctx.fillRect(x, y, 4, T); ctx.fillRect(x + T - 4, y, 4, T);
      }
    }
    if (whole) {
      /* gold frame pulse + flash at the instant of fusion + travelling glint + sparkles */
      var pulse = reduced ? 0.7 : [0.35, 0.55, 0.8, 0.55][Math.floor(now / 260) % 4];
      ctx.strokeStyle = 'rgba(255,217,90,' + pulse + ')';
      ctx.lineWidth = 4;
      ctx.strokeRect(ox - 2, oy + off - 2, size + 4, size + 4);
      var f = (el - MERGE_HOLD - MERGE_DUR) / 480;
      if (!reduced && f >= 0 && f < 1) {
        ctx.fillStyle = 'rgba(255,255,255,' + (Math.ceil((1 - f) * 4) * 0.12).toFixed(2) + ')';
        ctx.fillRect(ox, oy + off, size, size);
      }
      sheen(ox, oy, off, now, size);
      if (!reduced) sparkles(now);
    }
    ctx.globalAlpha = 1;
  }

  function drawBoard(a, b, t) {
    ctx.imageSmoothingEnabled = false;
    /* transparent canvas: the board-frame's glass and the animated sky show through */
    ctx.clearRect(0, 0, cv.width, cv.height);
    var atGoal = a === GOAL && b === GOAL;
    if (!atGoal) { mergeT0 = null; fused = false; beacon.stop(); }
    else {
      if (mergeT0 === null) { mergeT0 = performance.now(); fused = false; sfx.solved(); }
      drawMerged(performance.now());
      return;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    var p, xy;
    for (p = 0; p < 9; p++) { xy = slotXY(p); ctx.fillRect(xy[0], xy[1], T, T); }
    var showNums = $('nums').checked, moving = [], v;
    var now = performance.now(), celebrate = !reduced && a === GOAL && b === GOAL;
    var te = 1 - (1 - t) * (1 - t);
    for (v = 0; v < 9; v++) {
      var pa = a.indexOf(String(v)), pb = b.indexOf(String(v));
      var A = slotXY(pa), B = slotXY(pb);
      var x = q(A[0] + (B[0] - A[0]) * te), y = q(A[1] + (B[1] - A[1]) * te);
      var off;
      if (v === 0) {
        var done = (b === GOAL && t >= 1);
        off = done && celebrate ? tileOffset(0, pa, now, true) : 0;
        drawTile(0, x, y + off, done ? 1 : 0.1, done ? false : null);
        continue;
      }
      if (pa === pb) {
        off = tileOffset(v, pa, now, celebrate);
        if (off < 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(x + 8, y + T - 4, T - 16, 4);
        }
        drawTile(v, x, y + off, 1, showNums);
        sheen(x, y, off, now);
      } else moving.push([v, x, y]);
    }
    moving.forEach(function (m) { drawTile(m[0], m[1], m[2], 1, showNums); sheen(m[1], m[2], 0, now); });
    if (celebrate) sparkles(now);
  }

  /* ---------- formatting ---------- */
  function fmt(n) { return n === null || n === undefined ? '—' : n.toLocaleString('en-US'); }
  function fmtMs(ms) {
    if (ms === null || ms === undefined) return '—';
    if (ms < 1) return ms.toFixed(2) + ' ms';
    if (ms < 1000) return ms.toFixed(1) + ' ms';
    return (ms / 1000).toFixed(2) + ' s';
  }
  function gridText(s) {
    var rows = [];
    for (var r = 0; r < 3; r++) {
      var cells = [];
      for (var c = 0; c < 3; c++) { var ch = s[r * 3 + c]; cells.push(ch === '0' ? '_' : ch); }
      rows.push(' ' + cells.join(' '));
    }
    return rows.join('\n');
  }
  function flatText(s) {
    return (s.slice(0, 3) + ' ' + s.slice(3, 6) + ' ' + s.slice(6, 9)).replace(/0/g, '_');
  }

  /* ---------- player state ---------- */
  var R = null, states = [GOAL], N = 0, cur = 0, anim = null, playing = false, acc = 0, last = 0, raf = 0, lastUI = -1;
  var SPEEDS = [0.5, 1, 2, 4, 8, 16, 40, 100, 300, 1000];
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function sps() { return SPEEDS[+$('speed').value]; }
  function canSlide() { return !reduced && sps() <= 10; }
  function shown() { return anim ? anim.to : cur; }

  function drawNow() {
    if (anim) drawBoard(states[anim.from], states[anim.to], anim.t);
    else drawBoard(states[cur], states[cur], 1);
  }

  function updateUI(force) {
    var k = shown();
    if (!force && k === lastUI) return;
    lastUI = k;
    var cap;
    if (!R) cap = '';
    else if (R.skipped) cap = 'Not run. On an unsolvable start state, iterative deepening would repeat the whole 181,440-state space for every depth limit.';
    else if (!R.solved && N === 0 && R.expanded !== null) cap = 'No solution. The search ran out of states after expanding ' + fmt(R.expanded) + '.';
    else {
      cap = 'Step ' + fmt(k) + ' of ' + fmt(N) + ' · ' + (k === 0 ? 'start state' : 'blank moves ' + R.moves[k - 1]);
      if (k === N) cap += states[k] === GOAL ? (beacon.lit() ? ' · goal reached: the lighthouse is lit' : ' · goal reached: the lighthouse is whole') : ' · last step of the trace';
    }
    $('caption').textContent = cap;
    cv.setAttribute('aria-label', '8-puzzle board, ' + flatText(states[k]).replace(/_/g, 'blank'));
    var sc = $('scrub');
    if (+sc.value !== k) sc.value = k;
    $('console').textContent = gridText(states[k]);
    $('b-start').disabled = $('b-prev').disabled = k <= 0;
    $('b-next').disabled = $('b-end').disabled = k >= N;
    $('b-play').disabled = N === 0;
    $('b-play').textContent = playing ? 'Pause' : 'Play';
    var lo = Math.max(0, Math.min(k - 3, N - 7)), hi = Math.min(N, lo + 7), w = String(N).length, html = '';
    for (var i = lo; i <= hi; i++) {
      html += '<button type="button" class="trow" data-step="' + i + '"' + (i === k ? ' aria-current="true"' : '') + '>' +
          '<span class="tk">' + String(i).padStart(w, ' ') + '</span><span>' + (i === 0 ? 'start' : R.moves[i - 1]) + '</span><span>' + flatText(states[i]) + '</span></button>';
    }
    $('trace-list').innerHTML = html;
  }

  function startAnim(to) {
    anim = { from: cur, to: to, t: 0, dur: Math.min(0.8 / sps(), 0.28) };
    kick();
  }
  function kick() {
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }
  function stopPlay() { playing = false; updateUI(true); }

  function tick(ts) {
    raf = 0;
    var dt = Math.min(0.1, Math.max(0, (ts - last) / 1000));
    last = ts;
    if (anim) {
      anim.t += dt / anim.dur;
      if (anim.t >= 1) {
        var zf = states[anim.from].indexOf('0');
        land = { v: +states[anim.to][zf], t0: performance.now() };
        cur = anim.to; anim = null;
        sfx.move(land.v);
      }
    }
    if (playing && !anim) {
      acc += dt;
      var iv = 1 / sps();
      if (canSlide()) {
        if (acc >= iv) { acc = 0; if (cur < N) startAnim(cur + 1); }
      } else {
        var n = Math.floor(acc / iv);
        if (n > 0) { acc -= n * iv; cur = Math.min(N, cur + n); sfx.move(0); }
      }
      if (cur >= N && !anim) stopPlay();
    }
    drawNow();
    updateUI(false);
    if (playing || anim) raf = requestAnimationFrame(tick);
  }

  function goTo(step, slide) {
    if (anim) { cur = anim.to; anim = null; }
    step = Math.max(0, Math.min(N, step));
    if (step === cur) { drawNow(); updateUI(true); return; }
    if (slide && canSlide() && Math.abs(step - cur) === 1) { startAnim(step); }
    else { if (Math.abs(step - cur) === 1) sfx.move(0); cur = step; drawNow(); }
    updateUI(false);
  }
  function userStep(step, slide) { playing = false; goTo(step, slide); updateUI(true); }

  $('b-start').onclick = function () { userStep(0, false); };
  $('b-end').onclick = function () { userStep(N, false); };
  $('b-prev').onclick = function () { userStep(shown() - 1, true); };
  $('b-next').onclick = function () { userStep(shown() + 1, true); };
  $('b-play').onclick = function () {
    if (playing) { stopPlay(); return; }
    if (N === 0) return;
    if (shown() >= N) { anim = null; cur = 0; }
    playing = true; acc = 0;
    updateUI(true);
    kick();
  };
  $('scrub').oninput = function () { playing = false; goTo(+this.value, false); updateUI(true); };
  $('speed').oninput = function () { $('speed-out').textContent = sps() + ' steps/s'; };
  $('nums').onchange = function () { drawNow(); };
  $('trace-list').onclick = function (e) {
    var b = e.target.closest('.trow');
    if (b) userStep(+b.getAttribute('data-step'), false);
  };
  document.addEventListener('keydown', function (e) {
    if (e.target.closest && e.target.closest('input,textarea,select,button,details')) return;
    if (e.key === ' ') { e.preventDefault(); $('b-play').click(); }
    else if (e.key === 'ArrowRight') $('b-next').click();
    else if (e.key === 'ArrowLeft') $('b-prev').click();
    else if (e.key === 'Home') $('b-start').click();
    else if (e.key === 'End') $('b-end').click();
  });
  window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').addEventListener &&
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { setTimeout(drawNow, 0); });
  new MutationObserver(function () { drawNow(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------- results ---------- */
  function toJSON(r) {
    return JSON.stringify({
      algorithm: r.algo, initial: r.initial, moves: r.moves.map(function (m) { return LETTER[m]; }).join(''),
      solved: r.solved, cost: r.cost, expanded: r.expanded, generated: r.generated, goalDepth: r.goalDepth,
      maxDepth: r.maxDepth, peakFrontier: r.peak, ms: r.ms === null ? null : Math.round(r.ms * 100) / 100
    }, null, 1);
  }

  function renderStats(r) {
    var rows = [
      ['Algorithm', r.algo],
      ['Outcome', r.solved ? 'Goal reached' : 'No solution'],
      ['Cost of path', fmt(r.solved ? r.cost : null)],
      ['Nodes expanded', fmt(r.expanded)],
      ['Nodes generated', fmt(r.generated)],
      ['Goal depth', fmt(r.goalDepth)],
      ['Deepest node generated', fmt(r.maxDepth)],
      ['Peak frontier', fmt(r.peak)],
      ['Running time', fmtMs(r.ms)]
    ];
    $('stats').querySelector('tbody').innerHTML = rows.map(function (x) {
      return '<tr><th scope="row">' + x[0] + '</th><td>' + x[1] + '</td></tr>';
    }).join('');
  }

  function setResult(r) {
    R = r;
    states = applyMoves(r.initial, r.moves);
    N = states.length - 1;
    cur = 0; anim = null; playing = false;
    var sc = $('scrub');
    sc.max = N; sc.value = 0;
    renderStats(r);
    $('json').value = toJSON(r);
    drawNow();
    updateUI(true);
  }

  var cache = { initial: '', res: {} };
  async function runAlgos(keys, init) {
    if (cache.initial !== init) cache = { initial: init, res: {} };
    var need = keys.filter(function (k) { return !cache.res[k]; });
    if (!need.length) return;
    var got = await requestSolve(init, need);
    if (cache.initial !== init) return;            /* start state changed while waiting */
    need.forEach(function (k) { cache.res[k] = got[k]; });
  }
  function unsolvable(init) {
    if (inversions(init) % 2 === 0) return false;
    msg($('status'), 'Unsolvable start state (odd inversions), so there is nothing to send to the solver.', 'bad');
    return true;
  }

  function renderCompare() {
    var rs = ALGOS.map(function (a) { return cache.res[a.key] || null; });
    function best(field) {
      var vals = rs.filter(function (r) { return r && (r.solved || field === 'ms') && r[field] !== null; }).map(function (r) { return r[field]; });
      return vals.length > 1 ? Math.min.apply(null, vals) : null;
    }
    var bc = best('cost'), be = best('expanded'), bt = best('ms');
    $('cmp').querySelector('tbody').innerHTML = ALGOS.map(function (a, i) {
      var r = rs[i];
      if (!r) return '<tr><td class="name">' + a.label + '</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td></td></tr>';
      return '<tr><td class="name">' + a.label + '</td>' +
          '<td class="num' + (r.solved && r.cost === bc ? ' best' : '') + '">' + fmt(r.solved ? r.cost : null) + '</td>' +
          '<td class="num' + (r.expanded === be ? ' best' : '') + '">' + fmt(r.expanded) + '</td>' +
          '<td class="num">' + fmt(r.generated) + '</td>' +
          '<td class="num">' + fmt(r.maxDepth) + '</td>' +
          '<td class="num' + (r.ms === bt ? ' best' : '') + '">' + fmtMs(r.ms) + '</td>' +
          '<td><button type="button" class="btn small" data-key="' + a.key + '">Replay</button></td></tr>';
    }).join('');
    $('cmp-note').textContent = cache.initial
        ? 'Start state ' + flatText(cache.initial) + '. Green marks the lowest value in a column.'
        : 'Runs every algorithm on the start state above. Green marks the lowest value in a column.';
  }
  $('cmp').onclick = function (e) {
    var b = e.target.closest('button[data-key]');
    if (!b) return;
    var r = cache.res[b.getAttribute('data-key')];
    if (r) { $('algo').value = b.getAttribute('data-key'); $('initial').value = r.initial.split('').join(','); checkInput(); setResult(r); }
  };

  /* ---------- setup form ---------- */
  function msg(el, text, kind) { el.textContent = text; el.className = 'msg' + (kind ? ' ' + kind : ''); }
  function checkInput() {
    var s = parseState($('initial').value), m = $('state-msg');
    if (!s) { msg(m, 'Enter the digits 0 to 8 once each, for example 1,2,5,3,4,0,6,7,8.', 'bad'); return null; }
    var inv = inversions(s);
    if (inv % 2 === 0) msg(m, 'Inversions: ' + inv + ' (even). Solvable.', 'good');
    else msg(m, 'Inversions: ' + inv + ' (odd). Unsolvable: a move never changes the parity of the inversion count, and the goal has zero.', 'bad');
    return s;
  }
  function setBusy(on, text) {
    ['b-solve', 'b-shuffle', 'b-example', 'b-runall'].forEach(function (id) { $(id).disabled = on; });
    msg($('status'), on ? text : '', '');
  }
  async function doSolve() {
    var init = checkInput();
    if (!init || unsolvable(init)) return;
    var key = $('algo').value, label = ALGO_BY_KEY[key].label;
    setBusy(true, 'Solving with ' + label + '…');
    try {
      await runAlgos([key], init);
      setResult(cache.res[key]);
      renderCompare();
      setBusy(false);
    } catch (err) {
      setBusy(false);
      msg($('status'), err.message, 'bad');
    }
  }
  function randomSolvable() {
    var a = [0, 1, 2, 3, 4, 5, 6, 7, 8], i, j, t;
    for (i = 8; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
    if (inversions(a.join('')) % 2 === 1) {
      var idx = [];
      a.forEach(function (v, k) { if (v !== 0) idx.push(k); });
      t = a[idx[0]]; a[idx[0]] = a[idx[1]]; a[idx[1]] = t;
    }
    return a.join(',');
  }
  $('setup').onsubmit = function (e) { e.preventDefault(); doSolve(); };
  $('initial').oninput = checkInput;
  $('b-shuffle').onclick = function () { $('initial').value = randomSolvable(); doSolve(); };
  $('b-example').onclick = function () { $('initial').value = '1,2,5,3,4,0,6,7,8'; doSolve(); };
  $('b-runall').onclick = async function () {
    var init = checkInput();
    if (!init || unsolvable(init)) return;
    setBusy(true, 'Running all algorithms…');
    try {
      await runAlgos(ALGOS.map(function (a) { return a.key; }), init);
      renderCompare();
      setBusy(false);
    } catch (err) {
      setBusy(false);
      msg($('status'), err.message, 'bad');
    }
  };

  /* ---------- trace JSON ---------- */
  function fromJSON(txt) {
    var o = JSON.parse(txt);
    var init = parseState(String(o.initial));
    if (!init) throw new Error('"initial" must hold the digits 0 to 8 once each.');
    var names = [], mv = o.moves;
    if (typeof mv === 'string') {
      mv.toUpperCase().replace(/[\s,]/g, '').split('').forEach(function (ch) {
        if (!NAME[ch]) throw new Error('"moves" may only contain U, D, L and R.');
        names.push(NAME[ch]);
      });
    } else if (Array.isArray(mv)) {
      mv.forEach(function (m) {
        var ch = String(m).charAt(0).toUpperCase();
        if (!NAME[ch]) throw new Error('Unknown move: ' + m);
        names.push(NAME[ch]);
      });
    } else throw new Error('"moves" is missing.');
    var st = applyMoves(init, names);
    var num = function (v) { return typeof v === 'number' ? v : null; };
    return { algo: o.algorithm ? String(o.algorithm) : 'Imported trace', initial: init, moves: names,
      solved: st[st.length - 1] === GOAL, cost: names.length, expanded: num(o.expanded), generated: num(o.generated),
      goalDepth: names.length, maxDepth: num(o.maxDepth), peak: num(o.peakFrontier), ms: num(o.ms) };
  }
  $('j-fill').onclick = function () { if (R) { $('json').value = toJSON(R); msg($('j-msg'), '', ''); } };
  $('j-copy').onclick = function () {
    var ta = $('json');
    function done(ok) {
      msg($('j-msg'), ok ? 'Copied.' : 'Copying was blocked here. The text is selected, copy it with your keyboard.', ok ? 'good' : 'bad');
      if (!ok) { ta.focus(); ta.select(); }
    }
    try { navigator.clipboard.writeText(ta.value).then(function () { done(true); }, function () { done(false); }); }
    catch (err) { done(false); }
  };
  $('j-load').onclick = function () {
    try {
      var r = fromJSON($('json').value);
      $('initial').value = r.initial.split('').join(',');
      checkInput();
      setResult(r);
      msg($('j-msg'), 'Loaded ' + fmt(r.moves.length) + ' moves.', 'good');
    } catch (err) {
      msg($('j-msg'), err.message, 'bad');
    }
  };

  /* ---------- watch mode: hide the interface and just enjoy the lighthouse ---------- */
  /* pixel icons for the dock, drawn from tiny bitmaps so they stay crisp */
  var ICONS = {
    eye:  ['....###....', '..##...##..', '.#..###..#.', '#..#####..#', '.#..###..#.', '..##...##..', '....###....'],
    tiles: ['##.##.##.', '##.##.##.', '.........', '##.##.##.', '##.##.##.', '.........', '##.##.##.', '##.##.##.'],
    sndOn: ['....#......', '...##.#..#.', '#####..#..#', '#####..#..#', '#####..#..#', '...##.#..#.', '....#......'],
    sndOff: ['....#......', '...##......', '#####.#...#', '#####..#.#.', '#####...#..', '...##..#.#.', '....#.#...#']
  };
  function drawIcon(btn, rows, color) {
    var cvs = btn.querySelector('canvas'), w = rows[0].length, h = rows.length, c;
    cvs.width = w; cvs.height = h;
    cvs.style.width = 'calc(' + w + ' * var(--ip, 3px))';
    c = cvs.getContext('2d');
    c.clearRect(0, 0, w, h);
    c.fillStyle = color;
    rows.forEach(function (r, y) { for (var x = 0; x < w; x++) if (r[x] === '#') c.fillRect(x, y, 1, 1); });
  }
  function drawDock() {
    var watch = document.body.classList.contains('watch');
    drawIcon($('b-focus'), watch ? ICONS.tiles : ICONS.eye, watch ? '#f3b94f' : '#f8e7b0');
    drawIcon($('b-sound'), sfx.isMuted() ? ICONS.sndOff : ICONS.sndOn, sfx.isMuted() ? '#ff9b91' : '#f8e7b0');
  }

  /* ---------- watch mode: hide the interface and just enjoy the lighthouse ---------- */
  var awakeTimer = 0;
  function wake() {                                  /* in watch mode the dock fades out when idle and comes back on movement */
    if (!document.body.classList.contains('watch')) return;
    document.body.classList.add('awake');
    clearTimeout(awakeTimer);
    awakeTimer = setTimeout(function () { document.body.classList.remove('awake'); }, 2600);
  }
  function setWatch(on) {
    document.body.classList.toggle('watch', on);
    var b = $('b-focus');
    b.title = (on ? 'Bring the interface back' : 'Hide the interface and just watch') + ' (H)';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on && document.activeElement && document.activeElement !== b && document.activeElement.blur) document.activeElement.blur();
    if (!on) { document.body.classList.remove('awake'); clearTimeout(awakeTimer); }
    beacon.setWatch(on);
    sfx.setWatch(on);
    drawDock();
    if (on) wake();
  }
  function toggleSound() {
    var m = sfx.toggleMute(), b = $('b-sound');
    b.title = (m ? 'Unmute sound' : 'Mute sound') + ' (M)';
    b.setAttribute('aria-pressed', m ? 'false' : 'true');
    drawDock();
  }
  $('b-focus').onclick = function (e) {
    setWatch(!document.body.classList.contains('watch'));
    if (e.detail) this.blur();                      /* after a mouse click, let Space and arrows drive playback */
  };
  $('b-sound').onclick = function (e) {
    toggleSound();
    if (e.detail) this.blur();
  };
  ['pointermove', 'pointerdown', 'touchstart', 'keydown'].forEach(function (ev) { window.addEventListener(ev, wake, { passive: true }); });
  ['pointerdown', 'keydown'].forEach(function (ev) { window.addEventListener(ev, function () { sfx.unlock(); }, { once: true, capture: true }); });
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input,textarea,select')) return;
    var on = document.body.classList.contains('watch');
    if (e.key === 'h' || e.key === 'H') setWatch(!on);
    else if (e.key === 'Escape' && on) setWatch(false);
    else if (e.key === 'm' || e.key === 'M') toggleSound();
  });

  /* ---------- start ---------- */
  beacon.onLit = function () { updateUI(true); };
  (function () {
    var m = sfx.isMuted(), b = $('b-sound');
    b.title = (m ? 'Unmute sound' : 'Mute sound') + ' (M)';
    b.setAttribute('aria-pressed', m ? 'false' : 'true');
    drawDock();
  })();
  $('speed-out').textContent = sps() + ' steps/s';
  /* idle redraw (~14 fps, deliberately choppy for the pixel feel) keeps the tiles alive between moves */
  setInterval(function () {
    if (!reduced && !anim && !raf && !document.hidden) drawNow();
  }, 70);
  checkInput();
  states = [parseState($('initial').value) || GOAL];
  drawNow();
  updateUI(true);
  renderCompare();
  doSolve();
})();