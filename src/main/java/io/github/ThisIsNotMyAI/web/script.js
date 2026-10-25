(function () {
  'use strict';



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
    /* play-mode win: a bright fanfare. Pulse-wave trumpet runs up an arpeggio, lands on a held high C over a triangle
       bass and a cymbal crash, then a sparkle of bells and a warm chord that rings out. */
    api.victory = function () {
      if (muted || !ensure()) return;
      var t = ctx.currentTime + 0.02, h = 0.42;
      [67, 72, 76, 79].forEach(function (m, i) { voice(pulse(0.25), mtof(m), t + i * 0.1, 0.14, 0.09, 0.006, master); });
      voice('triangle', mtof(43), t, 0.4, 0.14, 0.01, master);
      voice(pulse(0.5), mtof(84), t + h, 0.95, 0.09, 0.01, master);
      voice(pulse(0.25), mtof(76), t + h, 0.95, 0.05, 0.01, master);
      voice(pulse(0.25), mtof(79), t + h, 0.95, 0.05, 0.01, master);
      voice('triangle', mtof(48), t + h, 1.1, 0.17, 0.01, master);
      noise(t + h, 0.7, 0.06, 'highpass', 4000, 9000, 0.7);
      [96, 100, 103, 108].forEach(function (m, i) { tone(mtof(m), t + h + 0.12 + i * 0.09, 0.55, 'sine', 0.035); });
      [72, 76, 79, 84].forEach(function (m) { voice('triangle', mtof(m), t + h + 0.5, 1.6, 0.045, 0.05, master); });
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

    api.ambStart = function (style) {
      if (!ensure() || amb) return;
      var vic = style === 'victory';
      var t0 = ctx.currentTime, eighth = vic ? 60 / 116 / 2 : 60 / 72 / 2;
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
      /* victory loop: C - G - Am - F at 116 bpm. Bouncing triangle bass, bright pulse arpeggios, a kick and snare,
         and a singing major-pentatonic lead, so it feels like a celebration instead of a night watch. */
      var VCH = [{ bass: 48, tones: [60, 64, 67, 72] }, { bass: 43, tones: [59, 62, 67, 71] },
        { bass: 45, tones: [60, 64, 69, 72] }, { bass: 41, tones: [60, 65, 69, 72] }];
      var VARP = [0, 1, 2, 3, 2, 3, 1, 2];
      var VLEAD = [[76, 0, 79, 0, 84, 0, 79, 76], [74, 0, 79, 0, 83, 0, 79, 74],
        [72, 0, 76, 0, 81, 0, 76, 72], [72, 0, 77, 0, 81, 84, 81, 77]];
      function playV(n, t) {
        var bar = Math.floor(n / 8) % 4, s = n % 8, c = VCH[bar];
        if (s === 0) c.tones.forEach(function (m) { voice('triangle', mtof(m), t, eighth * 7.5, 0.022, 0.08, padBus); });
        voice('triangle', mtof(c.bass + (s % 2 === 0 && s % 4 !== 0 ? 12 : 0)), t, eighth * 1.6, 0.15, 0.008, out);
        if (s % 2 === 1) voice('triangle', mtof(c.bass + 7), t, eighth * 1.2, 0.08, 0.008, out);
        voice(pulse(0.25), mtof(c.tones[VARP[s]] + 12), t, eighth * 1.3, 0.045, 0.006, bus);
        if (s === 0 || s === 4) tone(120, t, 0.13, 'sine', 0.22, 42, out);                  /* kick */
        if (s === 2 || s === 6) { noise(t, 0.12, 0.05, 'bandpass', 1900, 900, 0.8); tone(190, t, 0.07, 'triangle', 0.05, 110, out); }
        noise(t, 0.025, s % 2 ? 0.016 : 0.01, 'highpass', 7000, 9500, 0.7);                 /* hats */
        var m = VLEAD[bar][s];
        if (m) {
          if (n >= 16 && n % 32 >= 16 && s === 0) m += 12 * (Math.random() < 0.3 ? 1 : 0);  /* the odd high chime */
          voice(pulse(0.5), mtof(m), t, eighth * (s % 2 ? 1.6 : 2.6), 0.075, 0.012, bus);
        }
      }
      function play(n, t) {
        if (vic) { playV(n, t); return; }
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
    /* ----- harbour theme for the main menu -----
       Dmaj7 - Bm7 - Gmaj7 - Aadd9 in an eight-bar loop at 84 bpm: plucked triangle arpeggios, a warm pad, a soft singing lead
       (two detuned voices), all through a gentle echo, with slow swells of sea underneath, a bell buoy now and then
       and, once in a long while, a distant ship's horn. */
    var mnu = null;
    var MCH = [{ bass: 50, tones: [62, 66, 69, 73] }, { bass: 47, tones: [59, 62, 66, 69] },
      { bass: 43, tones: [55, 59, 62, 66] }, { bass: 45, tones: [57, 61, 64, 71] }];
    var MARP = [0, 1, 2, 3, 2, 1, 2, 1];
    var MMEL = [
      [[0, 78, 3], [3, 81, 1], [4, 83, 2], [6, 81, 2]], [[0, 78, 3], [3, 76, 1], [4, 78, 4]],
      [[0, 74, 2], [2, 79, 2], [4, 78, 2], [6, 76, 2]], [[0, 76, 4], [4, 81, 4]],
      [[0, 86, 3], [3, 83, 1], [4, 81, 2], [6, 83, 2]], [[0, 81, 3], [3, 78, 1], [4, 83, 4]],
      [[0, 79, 2], [2, 81, 2], [4, 83, 2], [6, 86, 2]], [[0, 85, 4], [4, 81, 2], [6, 76, 2]]
    ];
    api.menuStart = function () {
      if (!ensure() || mnu) return;
      var t0 = ctx.currentTime, eighth = 60 / 84 / 2;
      var out = ctx.createGain();
      out.gain.setValueAtTime(0, t0);
      out.gain.linearRampToValueAtTime(0.85, t0 + 2.5);
      out.connect(master);
      var bus = ctx.createBiquadFilter(), send = ctx.createGain(), echo = ctx.createDelay(2), fb = ctx.createGain(), fl = ctx.createBiquadFilter();
      bus.type = 'lowpass'; bus.frequency.value = 3200; bus.connect(out);
      send.gain.value = 0.42; bus.connect(send); send.connect(echo);
      echo.delayTime.value = eighth * 3; fb.gain.value = 0.42; fl.type = 'lowpass'; fl.frequency.value = 2000;
      echo.connect(fl); fl.connect(fb); fb.connect(echo); fl.connect(out);
      var padBus = ctx.createBiquadFilter();
      padBus.type = 'lowpass'; padBus.frequency.value = 900; padBus.connect(out);
      var sea = [];
      [[420, 0.11, 0.035], [900, 0.07, 0.016]].forEach(function (p) {
        var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
        s.buffer = noiseBuf; s.loop = true; f.type = 'lowpass'; f.frequency.value = p[0];
        g.gain.value = p[2]; l.frequency.value = p[1]; lg.gain.value = p[2] * 0.8;
        l.connect(lg); lg.connect(g.gain); s.connect(f); f.connect(g); g.connect(out);
        s.start(t0, Math.random()); l.start(t0);
        sea.push(s, l);
      });
      function horn(t) {
        var lp = ctx.createBiquadFilter(), g = ctx.createGain();
        lp.type = 'lowpass'; lp.frequency.value = 340; lp.Q.value = 1.2;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.05, t + 0.5);
        g.gain.setValueAtTime(0.05, t + 1.5);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
        lp.connect(g); g.connect(out); g.connect(send);
        [98, 98.8, 49].forEach(function (f) {
          var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(t); o.stop(t + 3.4);
        });
      }
      function play(n, t) {
        var bar = Math.floor(n / 8) % 8, s = n % 8, c = MCH[bar % 4];
        if (s === 0) c.tones.forEach(function (m) { voice('triangle', mtof(m), t, eighth * 8, 0.016, 0.35, padBus); });
        if (s === 0 || s === 4) voice('triangle', mtof(c.bass), t, eighth * 3.4, 0.14, 0.01, out);
        if (s === 6) voice('triangle', mtof(c.bass + 7), t, eighth * 1.8, 0.06, 0.01, out);
        var m = c.tones[MARP[s]];
        voice('triangle', mtof(m), t, eighth * 2.2, 0.05, 0.004, bus);
        voice('sine', mtof(m + 12), t, eighth * 1.4, 0.016, 0.004, bus);
        MMEL[bar].forEach(function (nt) {
          if (nt[0] !== s) return;
          var f = mtof(nt[1]), d = eighth * nt[2] * 1.05;
          voice('sine', f, t, d, 0.06, 0.035, bus);
          voice('triangle', f * 1.004, t, d, 0.03, 0.035, bus);
        });
        if (n % 64 === 36 && Math.random() < 0.6) bell(t, 0.04, Math.random() * 1.6 - 0.8);
        if (n % 256 === 96) horn(t);
      }
      var step = 0, next = t0 + 0.3;
      function schedule() {
        while (next < ctx.currentTime + 0.5) { play(step, next); next += eighth; step++; }
      }
      schedule();
      mnu = { out: out, sea: sea, timer: setInterval(schedule, 120) };
    };
    api.menuStop = function () {
      if (!mnu) return;
      var a = mnu; mnu = null;
      clearInterval(a.timer);
      a.out.gain.cancelScheduledValues(ctx.currentTime);
      a.out.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      a.sea.forEach(function (s) { try { s.stop(ctx.currentTime + 1.6); } catch (e) { /* already stopped */ } });
      setTimeout(function () { a.out.disconnect(); }, 8000);
    };
    /* achievement fanfares. Normal: a level-up jingle (kick, a fast pulse-wave arpeggio, a held major chord, a coin ding).
       Big: a snare roll that speeds up, a two-octave run, a huge chord with a crash, and a shower of bells. */
    function kick(t, vol) { tone(150, t, 0.13, 'sine', vol, 42); }
    function stab(t, notes, dur, vol) {
      notes.forEach(function (m) { voice(pulse(0.5), mtof(m), t, dur, vol, 0.006, master); });
    }
    api.achieve = function (big) {
      if (muted || !ensure()) return;
      var t = ctx.currentTime + 0.02, i;
      if (!big) {
        kick(t, 0.2);
        [72, 76, 79, 84, 88, 91].forEach(function (m, k) { voice(pulse(0.125), mtof(m), t + 0.03 + k * 0.055, 0.16, 0.05, 0.003, master); });
        var h = t + 0.38;
        stab(h, [84, 88, 91], 0.75, 0.045);
        voice('triangle', mtof(48), h, 0.8, 0.15, 0.008, master);
        voice(pulse(0.25), mtof(96), h + 0.16, 0.12, 0.04, 0.003, master);
        voice(pulse(0.25), mtof(103), h + 0.26, 0.5, 0.045, 0.003, master);
        noise(h, 0.35, 0.035, 'highpass', 5000, 9000, 0.7);
        return;
      }
      kick(t, 0.24);
      for (i = 0; i < 8; i++) {                                    /* snare roll, accelerating */
        var rt = t + 0.04 + i * (0.075 - i * 0.006);
        noise(rt, 0.07, 0.04 + i * 0.006, 'bandpass', 2200, 1100, 0.9);
        tone(190, rt, 0.05, 'triangle', 0.04, 120);
      }
      var r = t + 0.5;
      [72, 76, 79, 84, 88, 91, 96, 100].forEach(function (m, k) { voice(pulse(0.125), mtof(m), r + k * 0.045, 0.14, 0.05, 0.003, master); });
      var c = r + 0.42;                                            /* the landing */
      kick(c, 0.28);
      stab(c, [84, 88, 91, 96], 1.4, 0.05);
      stab(c, [72, 76, 79], 1.4, 0.03);
      voice('triangle', mtof(36), c, 1.5, 0.2, 0.01, master);
      voice('triangle', mtof(48), c, 1.2, 0.12, 0.01, master);
      noise(c, 1.1, 0.07, 'highpass', 3500, 9000, 0.7, 0.01);
      stab(c + 0.34, [88, 91, 96], 0.5, 0.03);                     /* echo stab */
      [103, 108, 112, 115, 120].forEach(function (m, k) { tone(mtof(m), c + 0.1 + k * 0.08, 0.5, 'sine', 0.03); });
      voice(pulse(0.25), mtof(100), c + 0.7, 0.12, 0.035, 0.003, master);
      voice(pulse(0.25), mtof(103), c + 0.82, 0.12, 0.035, 0.003, master);
      voice(pulse(0.25), mtof(108), c + 0.94, 0.7, 0.04, 0.003, master);
    };
    /* fireworks: a rocket whistles up, then cracks and crackles */
    api.whistle = function (dur) {
      if (muted || !ensure()) return;
      var t = ctx.currentTime + 0.01;
      tone(500, t, dur, 'sine', 0.03, 2400);
      tone(1000, t, dur, 'triangle', 0.012, 4800);
      noise(t, dur, 0.012, 'highpass', 3000, 9000, 0.7, dur * 0.8);
    };
    api.pop = function () {
      if (muted || !ensure()) return;
      var t = ctx.currentTime + 0.01;
      tone(110, t, 0.2, 'sine', 0.12, 40);
      noise(t, 0.25, 0.07, 'bandpass', 3500, 600, 0.8);
      noise(t + 0.05, 0.6, 0.025, 'highpass', 7000, 12000, 0.7, 0.05);
      [96, 100, 103, 108].forEach(function (m, i) { tone(mtof(m + Math.floor(Math.random() * 3)), t + 0.04 + i * 0.07, 0.3, 'sine', 0.02); });
    };
    /* the lighthouse show: 10 seconds of hype chiptune at 150 bpm, in time with the fireworks.
       Four bars of C - G - Am - F (four-on-the-floor kick, clap on 2 and 4, open hats, bouncing triangle bass, a bright
       pulse arpeggio and a hook on top), a bar of rising snare roll and sweep, then the finale chord and a shower of bells. */
    var SH = [{ bass: 48, tones: [60, 64, 67, 72] }, { bass: 43, tones: [59, 62, 67, 71] },
      { bass: 45, tones: [60, 64, 69, 72] }, { bass: 41, tones: [60, 65, 69, 72] }];
    var SHL = [
      [[0, 88, 1], [1, 91, 1], [2, 96, 2], [4, 91, 1], [5, 88, 1], [6, 91, 2]],
      [[0, 86, 1], [1, 91, 1], [2, 95, 2], [4, 91, 1], [5, 86, 1], [6, 91, 2]],
      [[0, 84, 1], [1, 88, 1], [2, 93, 2], [4, 88, 1], [5, 84, 1], [6, 88, 2]],
      [[0, 84, 1], [1, 89, 1], [2, 93, 2], [4, 96, 2], [6, 93, 1], [7, 89, 1]]
    ];
    var SHARP = [0, 1, 2, 3, 2, 3, 1, 2];
    api.secret = function () {
      if (muted || !ensure()) return;
      var t0 = ctx.currentTime + 0.02, e = 60 / 150 / 2, n, k;
      if (mnu) {                                                    /* duck the harbour theme under the show */
        mnu.out.gain.cancelScheduledValues(ctx.currentTime);
        mnu.out.gain.setTargetAtTime(0.1, ctx.currentTime, 0.15);
        mnu.out.gain.setTargetAtTime(0.85, ctx.currentTime + 10.2, 0.8);
      }
      for (n = 0; n < 32; n++) {
        var t = t0 + n * e, bar = Math.floor(n / 8), s = n % 8, c = SH[bar];
        voice('triangle', mtof(c.bass + (s % 2 ? 12 : 0)), t, e * 1.5, 0.15, 0.006, master);
        voice(pulse(0.125), mtof(c.tones[SHARP[s]] + 12), t, e * 1.1, 0.032, 0.004, master);
        if (s % 2 === 0) kick(t, 0.2);
        if (s === 2 || s === 6) { noise(t, 0.12, 0.06, 'bandpass', 2000, 900, 0.8); tone(200, t, 0.07, 'triangle', 0.05, 110); }
        noise(t, s % 2 ? 0.07 : 0.025, s % 2 ? 0.02 : 0.012, 'highpass', 7000, 10000, 0.7);
        SHL[bar].forEach(function (nt) {
          if (nt[0] !== s) return;
          voice(pulse(0.25), mtof(nt[1]), t, e * nt[2] * 0.95, 0.055, 0.004, master);
          voice(pulse(0.5), mtof(nt[1] - 12), t, e * nt[2] * 0.95, 0.02, 0.004, master);
        });
      }
      var rt = t0 + 32 * e;                                         /* the riser */
      tone(300, rt, 8 * e, 'triangle', 0.05, 3200);
      for (n = 0; n < 16; n++) noise(rt + n * e / 2, 0.06, 0.03 + n * 0.005, 'bandpass', 2200, 1100, 0.9);
      kick(rt, 0.22); kick(rt + 4 * e, 0.22);
      [72, 76, 79, 84, 88, 91, 96, 100].forEach(function (m, i) { voice(pulse(0.125), mtof(m), rt + 4 * e + i * 0.1, 0.14, 0.05, 0.003, master); });
      var f = t0 + 40 * e;                                          /* finale */
      kick(f, 0.3);
      stab(f, [84, 88, 91, 96], 1.8, 0.055);
      stab(f, [72, 76, 79], 1.8, 0.03);
      voice('triangle', mtof(36), f, 1.9, 0.2, 0.01, master);
      voice('triangle', mtof(48), f, 1.5, 0.12, 0.01, master);
      noise(f, 1.5, 0.08, 'highpass', 3500, 9000, 0.7, 0.01);
      stab(f + 0.4, [88, 91, 96], 0.5, 0.03);
      [103, 108, 112, 115, 120, 124].forEach(function (m, i) { tone(mtof(m), f + 0.1 + i * 0.08, 0.55, 'sine', 0.03); });
      [96, 100, 103, 108].forEach(function (m, i) { voice(pulse(0.25), mtof(m), f + 0.8 + i * 0.12, i === 3 ? 0.9 : 0.12, 0.04, 0.003, master); });
    };
    api.isMuted = function () { return muted; };  api.isMuted = function () { return muted; };
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

    api.tower = towerBase; api.emit = towerEmit;

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

      if (!wasLit && st.on && gl > 0.05) { wasLit = true; sfx.ignite(); sfx.ambStart(playMode ? 'victory' : 'calm'); if (api.onLit) api.onLit(); }
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
    if (whole && !inMenu && !beacon.on() && el > (reduced ? 0 : MERGE_HOLD + MERGE_DUR + 900)) {
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
      if (mergeT0 === null) { mergeT0 = performance.now(); fused = false; if (playMode) sfx.victory(); else sfx.solved(); }
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
    drawHint();
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
    if (playMode) cap = playCaption(k);
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
    if (playMode) playRefresh();
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
    if (playMode || inMenu || modal) return;
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
    if (!playMode) lastSolver = r;
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
  /* Asks the server for whatever is not cached yet (one request), resolves to { key: result }. */
  async function runAlgos(keys, init) {
    if (cache.initial !== init) cache = { initial: init, res: {} };
    var mine = cache, need = keys.filter(function (k) { return !mine.res[k]; });
    if (need.length) {
      var got = await requestSolve(init, need);
      need.forEach(function (k) { mine.res[k] = got[k]; });
    }
    var out = {};
    keys.forEach(function (k) { out[k] = mine.res[k]; markAlgo(k); });
    return out;
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
      var out = await runAlgos([key], init);
      setResult(out[key]);
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
  ['pointerdown', 'keydown'].forEach(function (ev) { window.addEventListener(ev, function () { sfx.unlock(); if (inMenu) sfx.menuStart(); }, { once: true, capture: true }); });
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input,textarea,select')) return;
    if (modal) { if (e.key === 'Escape') closeModal(); else if (e.key === 'm' || e.key === 'M') toggleSound(); return; }
    if (benchOn) { if (e.key === 'Escape') showBench(false); else if (e.key === 'm' || e.key === 'M') toggleSound(); return; }
    if (inMenu && e.key !== 'm' && e.key !== 'M') return;
    var on = document.body.classList.contains('watch');
    if (e.key === 'h' || e.key === 'H') setWatch(!on);
    else if (e.key === 'Escape' && on) setWatch(false);
    else if (e.key === 'Escape' && !inMenu) showMenu(true);
    else if (e.key === 'm' || e.key === 'M') toggleSound();
  });


  /* ---------- play mode: slide the tiles yourself ----------
     A game is a growing trace: every move is appended to states/moves, so the slide animation, the merge into
     the lighthouse, the beacon, the scrubber and undo all reuse the existing player. */
  var playMode = false, lastSolver = null, par = null, parFail = false, gameTok = 0, hintBusy = false, editTok = 0, hints = 0, hintSlot = -1, hintAt = -1, winShown = false;
  var editMode = false, editSel = -1, draft = '', lastDraft = '', gameKey = '16', prevDiff = '16', recorded = false, winNote = '', hofArmed = false, tmWas = false;
  var OPP = { Up: 'Down', Down: 'Up', Left: 'Right', Right: 'Left' };
  var TILE_DIR = { ArrowUp: 'Down', ArrowDown: 'Up', ArrowLeft: 'Right', ArrowRight: 'Left' };   /* key = way the tile slides; the blank goes the other way */

  function blankTarget(s, dir) {
    var nb = NEI[s.indexOf('0')];
    for (var k = 0; k < nb.length; k++) if (nb[k][0] === dir) return nb[k][1];
    return -1;
  }
  function scramble(n) {
    var s, prev, i;
    do {
      s = GOAL; prev = '';
      for (i = 0; i < n; i++) {
        var z = s.indexOf('0'), opts = NEI[z].filter(function (m) { return m[0] !== OPP[prev]; });
        var pick = opts[Math.floor(Math.random() * opts.length)];
        s = swap(s, z, pick[1]); prev = pick[0];
      }
    } while (s === GOAL);
    return s;
  }
  function playResult(init) {
    return { algo: 'Manual play', initial: init, moves: [], solved: false, cost: 0, expanded: null, generated: null,
      goalDepth: null, maxDepth: null, peak: null, ms: null };
  }
  /* ----- timer ----- */
  var tm = { ms: 0, t0: 0, on: false };
  function tmNow() { return tm.ms + (tm.on ? performance.now() - tm.t0 : 0); }
  function tmStart() { if (!tm.on) { tm.on = true; tm.t0 = performance.now(); } }
  function tmPause() { if (tm.on) { tm.ms += performance.now() - tm.t0; tm.on = false; } }
  function tmReset() { tm.ms = 0; tm.on = false; }
  function fmtTime(ms) {
    var s = ms / 1000, m = Math.floor(s / 60), r = s - m * 60;
    return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1);
  }

  /* ----- hall of fame: top 5 per difficulty (or per custom board), kept in localStorage ----- */
  var SCORE_KEY = 'pharos-scores-v1', scores = null, DIFF_NAME = { '6': 'Easy', '16': 'Medium', '30': 'Hard', 'rand': 'Anything solvable' };
  function loadScores() {
    if (scores) return scores;
    scores = {};
    try { var t = localStorage.getItem(SCORE_KEY); if (t) scores = JSON.parse(t) || {}; } catch (e) { /* storage blocked */ }
    return scores;
  }
  function saveScores() { try { localStorage.setItem(SCORE_KEY, JSON.stringify(scores)); } catch (e) { /* storage blocked */ } }
  function scoreCmp(a, b) { return (a.m - a.p) - (b.m - b.p) || a.h - b.h || a.t - b.t; }
  function addScore(key, e) {
    var all = loadScores(), keys = Object.keys(all);
    if (!all[key] && keys.length > 60) delete all[keys[0]];     /* custom boards could pile up forever */
    var l = all[key] || (all[key] = []);
    l.push(e); l.sort(scoreCmp);
    var idx = l.indexOf(e);
    if (l.length > 5) l.length = 5;
    saveScores();
    return idx < 5 ? idx : -1;
  }
  function hofName(key) { return key.charAt(1) === ':' ? 'this board' : DIFF_NAME[key]; }
  function hofKey() {
    if (!editMode) return gameKey;
    return (parseState(draft) && inversions(draft) % 2 === 0 && draft !== GOAL) ? 'c:' + draft : null;
  }
  function renderHof() {
    var key = hofKey(), l = key ? (loadScores()[key] || []) : [], html = '';
    $('hof-name').textContent = key ? '· ' + hofName(key) : '';
    l.forEach(function (e, i) {
      var over = e.m - e.p;
      html += '<tr><td>' + (i + 1) + '</td><td class="num">' + e.m + (over === 0 ? ' par' : ' +' + over) + '</td><td class="num">' +
          fmtTime(e.t) + '</td><td class="num">' + e.h + '</td><td>' + new Date(e.d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + '</td></tr>';
    });
    $('hof').querySelector('tbody').innerHTML = html || '<tr><td colspan="5">No runs yet. Solve it to claim #1.</td></tr>';
  }
  /* par comes from the server a moment after a game starts; gameTok drops answers for a game that is gone */
  function fetchPar(init, tok) {
    par = null; parFail = false;
    optimal(init).then(function (r) {
      if (tok !== gameTok) return;
      par = r.solved ? r.cost : null; parFail = !r.solved;
      if (playMode) playRefresh();
    }, function (err) {
      if (tok !== gameTok) return;
      parFail = true;
      if (playMode && states[shown()] !== GOAL) msg($('p-msg'), 'Par and hints need the solver server. ' + err.message, 'bad');
      if (playMode) playRefresh();
    });
  }
  function finishGame() {
    tmPause();
    if (recorded) { winNote = 'Score already saved for this game.'; return; }
    recorded = true;
    var prior = (loadScores()[gameKey] || []).length;
    var idx = addScore(gameKey, { m: N, p: par === null ? N : par, h: hints, t: Math.round(tm.ms), d: Date.now() }), name = hofName(gameKey);
    winNote = idx === 0 ? 'New #1 for ' + name + '!' : idx > 0 ? 'Hall of fame: #' + (idx + 1) + ' for ' + name + '.' : 'Not in the top 5 for ' + name + ' this time.';
    var tier = hints === 0 ? (par !== null && N === par ? 'gold' : 'sail') : 'fish', gained = [tier];
    if (idx === 0 && prior > 0) gained.push(tier === 'fish' ? 'sail' : 'gold');
    winNote += ' Harbour: +' + gained.map(function (t) { return awardBoat(t); }).join(', +') + '.';
    checkWin({ key: gameKey, moves: N, par: par, hints: hints, ms: tm.ms });
  }

  /* ----- custom board editor ----- */
  function setEditUI(on) { $('edit-box').hidden = !on; $('game-btns').hidden = on; $('play-note').hidden = on; }
  function leaveEditUI() { if (!editMode) return; editMode = false; editSel = -1; setEditUI(false); }
  function editCheck() {
    var inv = inversions(draft), ok = inv % 2 === 0, m = $('e-msg'), tok = ++editTok;
    if (draft === GOAL) msg(m, 'That board is already solved. Swap a few tiles.', 'bad');
    else if (ok) {
      msg(m, 'Inversions: ' + inv + ' (even). Solvable. Asking the solver for par…', 'good');
      optimal(draft).then(function (r) {
        if (tok !== editTok || !editMode) return;
        msg(m, 'Inversions: ' + inv + ' (even). Solvable in ' + r.cost + (r.cost === 1 ? ' move' : ' moves') + ' at best.', 'good');
      }, function (err) {
        if (tok !== editTok || !editMode) return;
        msg(m, 'Inversions: ' + inv + ' (even). Solvable. Par unavailable: ' + err.message, 'good');
      });
    } else msg(m, 'Inversions: ' + inv + ' (odd). Unsolvable. Try Make solvable.', 'bad');
    $('e-play').disabled = !ok || draft === GOAL;
    $('e-fix').disabled = ok;
  }
  function editApply(d, fromText) {
    draft = d; lastDraft = d; editSel = -1;
    setResult(playResult(d));
    if (!fromText) $('e-text').value = d.split('').join(',');
    editCheck();
    drawNow();
  }
  function enterEdit() {
    editMode = true; setEditUI(true);
    hints = 0; hintSlot = -1; winShown = false; winNote = ''; recorded = false; par = null; parFail = false; gameTok++; tmReset();
    editApply(lastDraft || randomSolvable().replace(/,/g, ''));
    msg($('p-msg'), '', '');
  }
  function editClick(p) {
    if (editSel < 0) editSel = p;
    else if (editSel === p) editSel = -1;
    else { var a = editSel; sfx.move(2 + (p % 5)); editApply(swap(draft, a, p)); return; }
    drawNow();
  }
  function startCustom() {
    if (inversions(draft) % 2 || draft === GOAL) return;
    var init = draft;
    leaveEditUI();
    gameKey = 'c:' + init; hints = 0; hintSlot = -1; winShown = false; winNote = ''; recorded = false; tmReset();
    fetchPar(init, ++gameTok);
    setResult(playResult(init));
    msg($('p-msg'), '', '');
    sfx.fuse();
  }

  function playCaption(k) {
    if (editMode) return 'Editing: click two tiles to swap them.';
    if (states[k] === GOAL) return 'Solved in ' + fmt(k) + (k === 1 ? ' move' : ' moves') + '. The lighthouse is whole.';
    if (k === 0) return 'Your move. Click a tile next to the blank.';
    return 'Move ' + fmt(k) + ' · the blank went ' + R.moves[k - 1];
  }
  function updateLine() {
    if (editMode) { $('p-line').textContent = 'Custom board editor'; return; }
    $('p-line').textContent = 'Moves: ' + fmt(shown()) + ' · Par: ' + (par === null ? (parFail ? 'n/a' : '…') : par) + ' · Hints: ' + hints + ' · Time: ' + fmtTime(tmNow());
  }
  function playRefresh() {
    var k = shown(), solved = states[k] === GOAL && !editMode;
    updateLine();
    if (!editMode) {
      if (solved) {
        msg($('p-msg'), 'Solved in ' + fmt(k) + (k === 1 ? ' move' : ' moves') + ' in ' + fmtTime(tmNow()) +
            (par !== null ? (k <= par ? '. That is the optimum.' : '. The optimum is ' + par + '.') : '.') + (winNote ? ' ' + winNote : ''), 'good');
        winShown = true;
      } else if (winShown) { msg($('p-msg'), '', ''); winShown = false; winNote = ''; }
      $('p-undo').disabled = k <= 0;
      $('p-restart').disabled = N === 0 && hints === 0;
      $('p-hint').disabled = solved || hintBusy;
      $('p-ghost').disabled = !(solved && k > 0);
    }
    renderHof();
  }
  function newGame() {
    var d = $('diff').value, init;
    if (d === 'custom') { enterEdit(); return; }
    leaveEditUI();
    if (d === 'rand') { do { init = randomSolvable().replace(/,/g, ''); } while (init === GOAL); }
    else init = scramble(+d);
    gameKey = d; prevDiff = d;
    hints = 0; hintSlot = -1; winShown = false; winNote = ''; recorded = false; tmReset();
    fetchPar(init, ++gameTok);
    setResult(playResult(init));
    msg($('p-msg'), '', '');
  }
  function restartGame() {
    hints = 0; hintSlot = -1; winShown = false; winNote = ''; recorded = false; tmReset();
    setResult(playResult(R.initial));
    msg($('p-msg'), '', '');
  }
  function playMove(dir) {
    var k = shown(), s = states[k];
    if (editMode || s === GOAL) return false;
    var to = blankTarget(s, dir);
    if (to < 0) return false;
    if (anim) { cur = anim.to; anim = null; }
    if (k < N) { states.length = k + 1; R.moves.length = k; N = k; }     /* moving from an earlier step branches the game */
    states.push(swap(s, s.indexOf('0'), to)); R.moves.push(dir); N++;
    if (!recorded) tmStart();
    if (states[N] === GOAL) finishGame();
    $('scrub').max = N;
    hintSlot = -1; playing = false;
    msg($('p-msg'), '', ''); winShown = false;
    if (reduced) { cur = N; sfx.move(0); drawNow(); }
    else { anim = { from: cur, to: N, t: 0, dur: 0.14 }; kick(); }
    updateUI(true);
    return true;
  }
  function playUndo() { if (shown() > 0) userStep(shown() - 1, true); }
  async function playHint() {
    var k = shown(), s = states[k], tok = gameTok;
    if (s === GOAL || hintBusy) return;
    hintBusy = true; $('p-hint').disabled = true;
    msg($('p-msg'), 'Asking the solver…', '');
    var r = null, err = null;
    try { r = await optimal(s); } catch (e) { err = e; }
    hintBusy = false;
    if (tok !== gameTok || shown() !== k || states[k] !== s) { if (playMode && !editMode) { msg($('p-msg'), '', ''); playRefresh(); } return; }   /* you moved on while it thought */
    if (err) { msg($('p-msg'), 'Hints need the solver server. ' + err.message, 'bad'); playRefresh(); return; }
    if (!r.solved) { msg($('p-msg'), 'The solver found no solution from here.', 'bad'); playRefresh(); return; }
    var dir = r.moves[0];
    hints++; hintSlot = blankTarget(s, dir); hintAt = k;
    msg($('p-msg'), 'Slide the glowing tile ' + OPP[dir].toLowerCase() + '. At best ' + r.cost + (r.cost === 1 ? ' move' : ' moves') + ' to go.', '');
    drawNow(); updateUI(true);
  }
  function drawHint() {
    if (playMode && editMode && !inMenu) {
      if (editSel >= 0) {
        var ex = slotXY(editSel);
        ctx.strokeStyle = '#9be7a2'; ctx.lineWidth = 6;
        ctx.strokeRect(ex[0] - 3, ex[1] - 3, T + 6, T + 6);
      }
      return;
    }
    if (!playMode || hintSlot < 0 || anim || hintAt !== cur || states[cur] === GOAL) return;
    var xy = slotXY(hintSlot), on = reduced || Math.floor(performance.now() / 350) % 2 === 0;
    ctx.strokeStyle = on ? '#ffdf72' : 'rgba(255,223,114,0.35)';
    ctx.lineWidth = 6;
    ctx.strokeRect(xy[0] - 3, xy[1] - 3, T + 6, T + 6);
  }

  cv.addEventListener('click', function (e) {
    if (!playMode || inMenu) return;
    var s = states[shown()];
    if (s === GOAL && !editMode) return;
    var r = cv.getBoundingClientRect();
    var x = (e.clientX - r.left) * cv.width / r.width, y = (e.clientY - r.top) * cv.height / r.height;
    var col = Math.min(2, Math.max(0, Math.floor(x / (T + G)))), row = Math.min(2, Math.max(0, Math.floor(y / (T + G))));
    var p = row * 3 + col, z = s.indexOf('0');
    if (editMode) { editClick(p); return; }
    var dir = p === z - 3 ? 'Up' : p === z + 3 ? 'Down' : (p === z - 1 && z % 3 > 0) ? 'Left' : (p === z + 1 && z % 3 < 2) ? 'Right' : null;
    if (!dir) { if (p !== z) msg($('p-msg'), 'Only a tile next to the blank can slide.', 'bad'); return; }
    playMove(dir);
  });
  document.addEventListener('keydown', function (e) {
    if (!playMode || inMenu || modal || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input,textarea,select,button,details')) return;
    if (TILE_DIR[e.key]) { e.preventDefault(); playMove(TILE_DIR[e.key]); }
    else if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') { e.preventDefault(); playUndo(); }
  });

  function onClick(id, fn) { $(id).addEventListener('click', function (e) { fn(); if (e.detail) this.blur(); }); }
  onClick('p-new', newGame);
  onClick('p-undo', playUndo);
  onClick('p-restart', restartGame);
  onClick('p-hint', playHint);
  $('diff').addEventListener('change', function () { newGame(); this.blur(); });
  $('e-text').addEventListener('input', function () {
    var d = parseState(this.value);
    if (d) editApply(d, true);
    else { editTok++; msg($('e-msg'), 'Enter the digits 0 to 8 once each, for example 1,2,5,3,4,0,6,7,8.', 'bad'); $('e-play').disabled = true; $('e-fix').disabled = true; }
  });
  onClick('e-random', function () { editApply(randomSolvable().replace(/,/g, '')); });
  onClick('e-reset', function () { editApply(GOAL); });
  onClick('e-fix', function () {
    var i = [], k;
    for (k = 0; k < 9 && i.length < 2; k++) if (draft[k] !== '0') i.push(k);
    editApply(swap(draft, i[0], i[1]));
  });
  onClick('e-play', startCustom);
  onClick('e-cancel', function () { $('diff').value = prevDiff; newGame(); });
  onClick('hof-clear', function () {
    var b = $('hof-clear');
    if (!hofArmed) {
      hofArmed = true; b.textContent = 'Sure? Click again';
      setTimeout(function () { hofArmed = false; b.textContent = 'Clear all scores'; }, 3000);
      return;
    }
    hofArmed = false; b.textContent = 'Clear all scores';
    scores = {}; saveScores(); renderHof();
  });
  setInterval(function () { if (playMode && !inMenu && !editMode && tm.on) updateLine(); }, 200);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { tmWas = tm.on; tmPause(); }
    else if (tmWas) { tmWas = false; if (playMode && !inMenu && !recorded) tmStart(); }
  });

  var playSaved = null;
  function saveGame() {
    tmPause();
    leaveEditUI();
    var k = shown();
    playSaved = (R && k > 0 && states[k] !== GOAL) ? { init: R.initial, moves: R.moves.slice(0, k), par: par, hints: hints, key: gameKey, ms: tm.ms } : null;
  }
  function restoreGame() {
    if (!playSaved) return false;
    var g = playSaved; playSaved = null;
    par = g.par; parFail = false; gameTok++; hints = g.hints; gameKey = g.key; hintSlot = -1; winShown = false; winNote = ''; recorded = false;
    tmReset(); tm.ms = g.ms;
    if (par === null) fetchPar(g.init, gameTok);
    var r = playResult(g.init); r.moves = g.moves.slice();
    setResult(r);
    cur = N; $('scrub').value = N;
    if (!inMenu) tmStart();
    drawNow(); updateUI(true);
    msg($('p-msg'), 'Welcome back. Your game is where you left it.', '');
    return true;
  }
  function setPlayMode(on) {
    if (on === playMode) return;
    if (!on) saveGame();
    playMode = on;
    document.body.classList.toggle('playing', on);
    $('m-play').setAttribute('aria-pressed', on ? 'true' : 'false');
    $('m-watch').setAttribute('aria-pressed', on ? 'false' : 'true');
    $('m-play').classList.toggle('primary', on);
    $('m-watch').classList.toggle('primary', !on);
    $('play-panel').hidden = !on;
    Array.prototype.forEach.call(document.querySelectorAll('.solver-only'), function (el) { el.hidden = on; });
    hintSlot = -1;
    if (on) { if (!restoreGame()) newGame(); }
    else if (lastSolver) setResult(lastSolver);
    else doSolve();
  }
  onClick('m-watch', function () { setPlayMode(false); });
  onClick('m-play', function () { setPlayMode(true); });


  /* ---------- main menu: the lighthouse guides the boats home ----------
     One full-screen canvas: the tower, the sweeping beam (drawn at 1/5 resolution so the light is pixel-art too)
     and a few boats that sail in from the dark, get picked out by the beam, dock in the harbour, then leave again. */
  /* ---------- progress: trophies, fleet, toasts (all kept in localStorage) ---------- */
  function lsGet(k, d) { try { var t = localStorage.getItem(k); return t ? JSON.parse(t) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
  var ach = lsGet('pharos-ach-v1', {});
  if (!ach || typeof ach !== 'object' || Array.isArray(ach)) ach = {};
  var fleet = lsGet('pharos-fleet-v1', { boats: [], unseen: 0 });
  if (!fleet || !Array.isArray(fleet.boats)) fleet = { boats: [], unseen: 0 };
  fleet.unseen = Math.min(fleet.boats.length, fleet.unseen | 0);
  var pstats = lsGet('pharos-stats-v1', { algos: {} });
  if (!pstats || typeof pstats.algos !== 'object' || !pstats.algos) pstats = { algos: {} };

  var TIERS = { fish: { name: 'Fishing boat', rank: 1 }, sail: { name: 'Sailboat', rank: 2 }, gold: { name: 'Golden galleon', rank: 3 }, ghost: { name: 'Ghost ship', rank: 4 } };
  var ACH = [
    { id: 'first', name: 'First Light', desc: 'Solve your first puzzle.' },
    { id: 'nohints', name: 'Clear Sight', desc: 'Solve a puzzle without using a single hint.' },
    { id: 'optimal', name: 'Perfect Course', desc: 'Match the optimal number of moves.' },
    { id: 'hard', name: 'Storm Sailor', desc: 'Solve a Hard puzzle.' },
    { id: 'speed', name: 'Against the Clock', desc: 'Solve a Hard puzzle in under 60 seconds.', big: true },
    { id: 'master', name: 'Master Navigator', desc: 'Solve a Hard puzzle optimally, with no hints.', big: true },
    { id: 'custom', name: 'Cartographer', desc: 'Solve a board you built yourself.' },
    { id: 'tourist', name: 'Algorithm Tourist', desc: 'Run all five algorithms in Watch mode.' },
    { id: 'ghost', name: 'Ghost Hunter', desc: 'Race the ghost to the finish.' },
    { id: 'scientist', name: 'Field Scientist', desc: 'Finish a benchmark run.' },
    { id: 'fleet', name: 'Harbour Master', desc: 'Dock 8 boats in your harbour.', big: true },
    { id: 'secret', name: 'Spark of the Lighthouse', desc: 'Awaken the lighthouse.', secret: true, big: true, hint: 'The lamp looks ticklish. Five pokes, or an old cheat code.' }
  ];
  function achById(id) { for (var i = 0; i < ACH.length; i++) if (ACH[i].id === id) return ACH[i]; return null; }
  function achCount() { return ACH.filter(function (a) { return ach[a.id]; }).length; }

  var toastQ = [], toastBusy = false;
  function toast(kicker, title, desc, big) {
    toastQ.push([kicker, title, desc, big]);
    if (!toastBusy) nextToast();
  }
  function nextToast() {
    var t = toastQ.shift();
    if (!t) { toastBusy = false; return; }
    toastBusy = true;
    var el = $('toast');
    el.querySelector('.tk').textContent = t[0];
    el.querySelector('.tt').textContent = t[1];
    el.querySelector('.td').textContent = t[2] || '';
    el.classList.toggle('big', !!t[3]);
    el.classList.add('on');
    setTimeout(function () { el.classList.remove('on'); setTimeout(nextToast, 350); }, 3600);
  }
  function unlock(id) {
    if (ach[id]) return false;
    ach[id] = Date.now();
    lsSet('pharos-ach-v1', ach);
    var a = achById(id);
    toast('Achievement unlocked', a.name, a.desc, !!a.big);
    sfx.achieve(!!a.big);
    return true;
  }
  function awardBoat(t) {
    if (fleet.boats.length >= 60) {                         /* keep the list bounded: retire the oldest fishing boat */
      var k = 0;
      for (var i = 0; i < fleet.boats.length; i++) if (fleet.boats[i].t === 'fish') { k = i; break; }
      fleet.boats.splice(k, 1);
      fleet.unseen = Math.min(fleet.unseen, fleet.boats.length);
    }
    fleet.boats.push({ t: t, c: fleet.boats.length % 4 });
    fleet.unseen++;
    lsSet('pharos-fleet-v1', fleet);
    return TIERS[t].name;
  }
  function fleetVisible(max) {
    var idx = fleet.boats.map(function (b, i) { return i; });
    if (idx.length > max) {
      idx.sort(function (a, b) { return TIERS[fleet.boats[b].t].rank - TIERS[fleet.boats[a].t].rank || a - b; });
      idx = idx.slice(0, max).sort(function (a, b) { return a - b; });
    }
    return idx;
  }
  function checkWin(f) {
    unlock('first');
    if (f.hints === 0) unlock('nohints');
    if (f.par !== null && f.moves === f.par) unlock('optimal');
    if (f.key === '30') {
      unlock('hard');
      if (f.ms < 60000) unlock('speed');
      if (f.par !== null && f.moves === f.par && f.hints === 0) unlock('master');
    }
    if (f.key.charAt(1) === ':') unlock('custom');
    if (fleet.boats.length >= 8) unlock('fleet');
  }
  function markAlgo(key) {
    if (pstats.algos[key]) return;
    pstats.algos[key] = 1;
    lsSet('pharos-stats-v1', pstats);
    if (ALGOS.every(function (a) { return pstats.algos[a.key]; })) unlock('tourist');
  }

  /* ---------- main menu: the lighthouse guides the boats home ----------
     One full-screen canvas: the tower, the sweeping beam (drawn at 1/5 resolution so the light is pixel-art too)
     and boats. The boats you have earned sit in the harbour for good (a new one sails in the next time you visit);
     visitors sail in from the dark, get picked out by the beam, dock in any free berth, then leave again.
     Poke the lamp five times (or tap out an old cheat code) and the lighthouse puts on a show. */
  var inMenu = true, modal = null, benchOn = false;
  var menuScene = (function () {
    var cvs = $('menu-scene'), c = cvs.getContext('2d');
    var low = document.createElement('canvas'), lowx = low.getContext('2d');
    var LOWPX = 5, BEAM = 0.9, SECRET_MS = 10000;
    var W = 0, H = 0, g = null, raf = 0, running = false, lastT = 0, spawnIn = 2, boats = [], owned = [], parts = [], taken = [];
    var ang = 0, secretT = -1, nextExp = 1.2, volley = false, rockets = [], bump = 0, api = {};
    var FLICKER = [1, 0.4, 0.8, 0.2, 0.9, 0.6];
    var tower = document.createElement('canvas'); tower.width = 24; tower.height = 24;
    tower.getContext('2d').drawImage(beacon.tower, 0, 0);
    tower.getContext('2d').clearRect(17, 13, 5, 6);              /* the sprite's own little sailboat: the harbour has real ones now */
    var SLOTS = [
      { lane: 1, dx: -1.9 }, { lane: 1, dx: 1.5 }, { lane: 2, dx: -0.3 }, { lane: 3, dx: -1.6 },
      { lane: 2, dx: -3.0 }, { lane: 3, dx: 1.4 }, { lane: 0, dx: -2.4 }, { lane: 1, dx: -4.1 },
      { lane: 3, dx: -3.9 }, { lane: 2, dx: -5.3 }, { lane: 0, dx: -4.4 }, { lane: 3, dx: -6.2 }
    ];

    function clamp(v) { return Math.max(0, Math.min(1, v)); }
    function hx(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }

    /* sprites: '.' empty, m mast, s sail, x accent sail, h hull, d hull shade, l lantern, c chimney, w cabin */
    var SAIL_ROWS = [
      '.......l........', '.......m........', '......sm.x......', '.....sssmxx.....', '....ssssmxxx....', '...sssssmxxxx...',
      '..ssssssmxxxxx..', '.sssssssmxxxxxx.', '.......m........', '.hhhhhhhhhhhhhh.', '..hddddddddddh..', '...hhhhhhhhhh...'];
    var FISH_ROWS = [
      '.....cc.........', '.....cc.....l...', '....wwwww...m...', '....wlwlw...m...', '....wwwww...m...',
      'hhhhhhhhhhhhhhhh', '.hddddddddddddh.', '..hhhhhhhhhhhh..'];
    var ACCENTS = ['#D9719A', '#1B7A94', '#F4A261', '#8A6BD0'];
    function mkSprite(rows, pal, dim) {
      var w = rows[0].length, h = rows.length, cv = document.createElement('canvas'), x = cv.getContext('2d');
      cv.width = w; cv.height = h;
      var img = x.createImageData(w, h), sky = [13, 24, 48];
      for (var r = 0; r < h; r++) for (var q = 0; q < w; q++) {
        var ch = rows[r][q], col = pal[ch];
        if (ch === '.' || !col) continue;
        var rgb = hx(col), o = (r * w + q) * 4;
        for (var j = 0; j < 3; j++) img.data[o + j] = (dim && ch !== 'l') ? Math.round(rgb[j] * 0.45 + sky[j] * 0.55) : rgb[j];
        img.data[o + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      return { cv: cv, w: w, h: h };
    }
    var BASE = { m: '#6E5F46', s: '#EADFC4', h: '#7A4A2B', d: '#4B2E1B', l: '#FFD95A', c: '#3B3A46', w: '#CFE3EC' };
    var GOLD = { m: '#8A6A2A', s: '#FFE08A', x: '#F4A261', h: '#B8741E', d: '#6B4513', l: '#FFFFFF' };
    var GHOST = { m: '#9BD6E0', s: '#D4F4FA', x: '#8FE3F0', h: '#7FB5C4', d: '#5D8FA0', l: '#E8FFFF' };
    var SPR = [];
    (function () {
      var i, pal;
      for (i = 0; i < 4; i++) {
        pal = {}; for (var k in BASE) pal[k] = BASE[k]; pal.x = ACCENTS[i];
        SPR.push({ lit: mkSprite(SAIL_ROWS, pal, false), dim: mkSprite(SAIL_ROWS, pal, true), lampCol: 7, lampRow: 0 });
      }
      SPR.push({ lit: mkSprite(FISH_ROWS, BASE, false), dim: mkSprite(FISH_ROWS, BASE, true), lampCol: 12, lampRow: 1 });
      SPR.push({ lit: mkSprite(SAIL_ROWS, GOLD, false), dim: mkSprite(SAIL_ROWS, GOLD, true), lampCol: 7, lampRow: 0 });
      var gs = mkSprite(SAIL_ROWS, GHOST, false);
      SPR.push({ lit: gs, dim: gs, lampCol: 7, lampRow: 0 });
    })();
    function kindOf(fb) { return fb.t === 'fish' ? 4 : fb.t === 'gold' ? 5 : fb.t === 'ghost' ? 6 : (fb.c | 0) % 4; }

    function slotX(i) { return Math.round(g.tx + SLOTS[i].dx * g.bw); }
    function geometry() {
      var oldW = W;
      W = window.innerWidth; H = window.innerHeight;
      cvs.width = W; cvs.height = H;
      low.width = Math.ceil(W / LOWPX); low.height = Math.ceil(H / LOWPX);
      var seaTop = document.querySelector('.pixel-sea').getBoundingClientRect().top, seaH = H - seaTop;
      var P = Math.floor((seaTop - 60) / 19.5);
      P = Math.max(5, Math.min(P, 14));
      P = Math.min(P, Math.floor(W / 28));
      if (W < 900) P = Math.min(P, Math.floor(H * 0.3 / 19.5));
      P = Math.max(3, P);
      var tx = W >= 900 ? W - (12 * P + 36) : Math.round(Math.max(W * 0.5, W - 6.5 * P - 12));
      var Pb = Math.max(3, Math.min(6, Math.round(H / 150))), Y = Math.round(seaTop - 18.5 * P);
      g = { P: P, tx: tx, X: tx - 12 * P, Y: Y, seaTop: seaTop, seaH: seaH, ly: Y + 3 * P, Pb: Pb, bw: 16 * Pb,
        lanes: [0.30, 0.47, 0.64, 0.81].map(function (f) { return Math.round(seaTop + seaH * f); }),
        seaY: Math.round(seaTop + seaH * 0.5), Lmax: tx + 24 * Pb, vmax: Pb * 11, maxBoats: W < 600 ? 3 : 5, ok: [] };
      for (var i = 0; i < SLOTS.length; i++) {
        var sx = slotX(i);
        if (sx >= g.bw * 0.6 && sx <= W - g.bw * 0.6) g.ok.push(i);
      }
      var lh = $('lamp-hit');
      lh.hidden = W < 1000;
      lh.style.left = (g.tx - 3 * P) + 'px'; lh.style.top = (g.ly - 3 * P) + 'px';
      lh.style.width = (6 * P) + 'px'; lh.style.height = (6 * P) + 'px';
      if (oldW) {
        boats.forEach(function (b) { b.x *= W / oldW; });
        owned.forEach(function (b) { b.x *= W / oldW; });
      }
    }
    function phase() { return reduced ? 0.9 : ang; }
    function secretOn(now) { return secretT >= 0 && now - secretT < SECRET_MS; }

    function mkBoat(kind, slot, state, fromLeft) {
      var tgt = slot >= 0 ? slotX(slot) : 0, fl = fromLeft === undefined ? Math.random() < 0.75 : fromLeft, sx = fl ? -g.bw : W + g.bw;
      var b = { slot: slot, lane: slot >= 0 ? SLOTS[slot].lane : Math.floor(Math.random() * 4), x: tgt, dir: 1, kind: kind, ph: Math.random() * 6.28,
        state: state, t: 0, glow: 0.4, sp: 0, home: fl ? -1 : 1, v: g.vmax * (0.75 + 0.5 * Math.random()), gone: false, owned: false, bi: -1 };
      if (state === 'fresh') { b.state = 'in'; b.x = sx; b.dir = tgt >= sx ? 1 : -1; b.glow = 0; }
      else if (state === 'pass') { b.x = sx; b.dir = fl ? 1 : -1; b.glow = 0; }
      else { b.state = 'moored'; b.glow = 0.55; }
      return b;
    }
    function rebuild(announce) {
      var vis = fleetVisible(g.ok.length), newFrom = fleet.boats.length - (fleet.unseen | 0), byBi = {}, fresh = [], k, next = [];
      owned.forEach(function (b) { byBi[b.bi] = b; });
      taken = [];
      for (k = 0; k < SLOTS.length; k++) taken.push(0);
      vis.forEach(function (bi, i) {
        var slot = g.ok[i], fb = fleet.boats[bi], b = byBi[bi];
        if (!b || b.slot !== slot || b.kind !== kindOf(fb)) {
          b = mkBoat(kindOf(fb), slot, bi >= newFrom ? 'fresh' : 'moored');
          b.owned = true; b.bi = bi; b.t = 1e9;
          if (bi >= newFrom) fresh.push(fb);
        }
        taken[slot] = 2; next.push(b);
      });
      owned = next;
      boats.forEach(function (b) {                              /* visitors sitting in a berth that now belongs to you leave */
        if (b.slot >= 0 && taken[b.slot] === 2) { b.state = 'out'; b.slot = -1; b.dir = b.home; }
      });
      boats.forEach(function (b) { if (b.slot >= 0 && b.state !== 'out') taken[b.slot] = 1; });
      if (fleet.unseen) {
        fleet.unseen = 0; lsSet('pharos-fleet-v1', fleet);
        if (announce && fresh.length) {
          fresh.forEach(function (fb) { toast('New boat', TIERS[fb.t].name, 'It sails into your harbour.'); });
        }
      }
    }
    function spawn(initial) {
      var free = [], i;
      for (i = 0; i < g.ok.length; i++) if (!taken[g.ok[i]]) free.push(g.ok[i]);
      var kind = Math.floor(Math.random() * 5), b;
      if (free.length && Math.random() < 0.85) {
        var slot = free[Math.floor(Math.random() * free.length)], tgt = slotX(slot);
        b = mkBoat(kind, slot, 'fresh');
        taken[slot] = 1;
        if (initial) {
          if (!boats.length) { b.x = tgt; b.state = 'moored'; b.t = 3 + Math.random() * 6; b.glow = 0.55; }
          else { b.x = b.x + (tgt - b.x) * (0.15 + Math.random() * 0.7); }
          b.dir = tgt >= b.x ? 1 : -1;
        }
      } else {
        b = mkBoat(kind, -1, 'pass');
        if (initial) b.x = W * (0.1 + Math.random() * 0.8);
      }
      boats.push(b);
    }

    /* how brightly the beam is hitting a boat: the beam meets the water at a point that sweeps out and back */
    function lightAt(bx) {
      var phi = phase(), best = 0, side = bx < g.tx ? -1 : 1, dist = Math.abs(bx - g.tx);
      for (var i = 0; i < 2; i++) {
        var ph = phi + i * Math.PI, dx = Math.cos(ph);
        if ((dx >= 0 ? 1 : -1) !== side) continue;
        var v = clamp(1 - Math.abs(dist - g.Lmax * Math.abs(dx)) / (g.bw * 0.9));
        v *= 0.5 + 0.5 * Math.max(0, Math.sin(ph));
        if (v > best) best = v;
      }
      return best;
    }
    function skyX(f) {                                             /* keep the show in the open sky, clear of the menu cards */
      var a = W >= 1000 ? 760 : W * 0.08, b = W - 40;
      return a + (b - a) * f;
    }
    function explode(x, y, hue) {
      var n = 26, i, sp = Math.max(90, H * 0.17);
      for (i = 0; i < n; i++) {
        var a = i / n * 6.2832, s = sp * (0.6 + Math.random() * 0.5);
        parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1.2, col: 'hsl(' + ((hue + i * 7) % 360) + ',100%,70%)' });
      }
      if (parts.length > 500) parts.splice(0, parts.length - 500);
      sfx.pop();
    }
    function launch(dur, fx, fy) {                                   /* a rocket that bursts exactly dur seconds from now */
      var x = fx !== undefined ? fx : skyX(Math.random()), y = fy !== undefined ? fy : H * (0.1 + Math.random() * 0.28);
      rockets.push({ x: x, y0: g.seaTop + 4, y1: y, t: 0, dur: dur, hue: Math.floor(Math.random() * 360) });
      sfx.whistle(dur);
    }

    function stepBoat(b, dt, now, show) {
      if (b.state === 'in') {
        var tgt = slotX(b.slot), d = tgt - b.x;
        b.dir = d >= 0 ? 1 : -1;
        b.sp = Math.min(b.v, 14 + Math.abs(d) * 0.6);
        b.x += b.dir * b.sp * dt;
        if (Math.abs(d) < 1.5) { b.x = tgt; b.state = 'moored'; b.sp = 0; b.t = b.owned ? 1e9 : 7 + Math.random() * 7; }
      } else if (b.state === 'moored') {
        b.sp = 0; b.t -= dt;
        if (b.t <= 0) { b.state = 'out'; if (b.slot >= 0) taken[b.slot] = 0; b.slot = -1; b.dir = b.home; }
      } else if (b.state === 'pass') {
        b.sp = b.v; b.x += b.dir * b.sp * dt;
        if (b.x < -g.bw * 1.5 || b.x > W + g.bw * 1.5) b.gone = true;
      } else {
        b.sp = Math.min(b.v, b.sp + 30 * dt);
        b.x += b.dir * b.sp * dt;
        if (b.x < -g.bw * 1.5 || b.x > W + g.bw * 1.5) b.gone = true;
      }
      var base = b.owned ? (b.kind === 5 ? 0.9 : b.kind === 6 ? 0.85 : 0.55) : 0.55;
      b.glow = Math.max(lightAt(b.x), b.state === 'moored' ? base : 0, show ? 0.9 : 0, b.glow - dt * 0.8);
    }
    function step(dt, now) {
      var show = secretOn(now), spd = 1, i;
      if (show) {
        var el = (now - secretT) / 1000;
        spd = 1 + 6 * Math.min(1, el / 1.2) * (el > 8.5 ? Math.max(0, (10 - el) / 1.5) : 1);
        while (el + 0.45 >= nextExp && nextExp < 7.4) {              /* bursts land on the beat: 150 bpm is a beat every 0.4 s */
          launch(Math.max(0.25, nextExp - el));
          nextExp += Math.random() < 0.5 ? 0.4 : 0.8;
        }
        if (el > 7.55 && !volley) {                                 /* the finale volley, with the final chord */
          volley = true;
          for (i = 0; i < 5; i++) launch(Math.max(0.25, 8.0 - el), skyX(0.06 + 0.22 * i), H * (0.12 + (i % 2) * 0.14));
        }
      } else if (secretT >= 0) secretT = -1;
      if (!reduced) ang += dt * 0.698 * spd;
      bump = Math.max(0, bump - dt * 3);
      for (i = rockets.length - 1; i >= 0; i--) {
        var rk = rockets[i];
        rk.t += dt;
        if (rk.t >= rk.dur) { explode(rk.x, rk.y1, rk.hue); rockets.splice(i, 1); }
      }
      for (i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 130 * dt; p.vx *= 0.99; p.life -= dt;
        if (p.life <= 0) parts.splice(i, 1);
      }
      spawnIn -= dt;
      if (spawnIn <= 0) { if (boats.length < g.maxBoats) spawn(false); spawnIn = 3.5 + Math.random() * 5; }
      owned.forEach(function (b) { stepBoat(b, dt, now, show); });
      boats.forEach(function (b) { stepBoat(b, dt, now, show); });
      boats = boats.filter(function (b) { return !b.gone; });
    }

    var lamps = [];
    function drawBoat(b, now) {
      var Pb = g.Pb, sp = SPR[b.kind], w = sp.lit.w * Pb, h = sp.lit.h * Pb, y = g.lanes[b.lane];
      var bob = reduced ? 0 : Math.round(Math.sin(now / 1000 * 1.5 + b.ph) * 0.6) * Pb, yy = y + bob, x = Math.round(b.x), i;
      var tick = Math.floor(now / 220 + b.ph * 3) % 2, ghostAlpha = b.kind === 6 ? 0.62 + (reduced ? 0 : 0.15 * Math.sin(now / 600 + b.ph)) : 1;
      c.fillStyle = 'rgba(214,241,248,0.5)';
      c.fillRect(x - w / 2 + tick * Pb, yy, w - Pb, Pb);
      if (b.sp > 6) for (i = 1; i <= 3; i++) {
        c.fillStyle = 'rgba(214,241,248,' + (0.5 / i).toFixed(2) + ')';
        c.fillRect(Math.round(x - b.dir * (w * 0.5 + i * Pb * 3)) - (b.dir > 0 ? Pb * (4 - i) : 0), yy, Pb * (4 - i), Pb);
      }
      c.save();
      c.translate(x, 0); c.scale(b.dir, 1);
      c.globalAlpha = ghostAlpha;
      c.drawImage(sp.dim.cv, -w / 2, yy - h, w, h);
      if (b.glow > 0.02) { c.globalAlpha = Math.min(1, b.glow) * ghostAlpha; c.drawImage(sp.lit.cv, -w / 2, yy - h, w, h); }
      c.globalAlpha = 1;
      c.restore();
      if (b.glow > 0.15) lamps.push({ x: x + b.dir * (sp.lampCol + 0.5 - 8) * Pb, y: yy - (h - (sp.lampRow + 0.5) * Pb), a: b.glow });
    }
    function wedge(x0, y0, x1, y1, x2, y2) {
      lowx.beginPath(); lowx.moveTo(x0, y0); lowx.lineTo(x1, y1); lowx.lineTo(x2, y2); lowx.closePath(); lowx.fill();
    }
    function tint(a, dh, now, plain) {                         /* during the show the light cycles through the rainbow */
      if (secretOn(now)) return 'hsla(' + ((now / 5 + dh) % 360).toFixed(0) + ',100%,76%,' + a.toFixed(3) + ')';
      return plain;
    }

    function draw(now) {
      var k = 1 / LOWPX, i, islandBottom = g.Y + 24 * g.P;
      c.clearRect(0, 0, W, H);
      c.imageSmoothingEnabled = false;
      c.fillStyle = 'rgba(3,8,22,0.3)';
      c.fillRect(0, 0, W, H);
      lamps = [];
      var all = owned.concat(boats).sort(function (a, b) { return a.lane - b.lane; });
      all.forEach(function (b) { if (g.lanes[b.lane] < islandBottom) drawBoat(b, now); });   /* behind the island */
      var fl = reduced ? 1 : 0.88 + 0.12 * FLICKER[Math.floor(now / 90) % 6];
      c.drawImage(tower, 0, 0, 24, 24, g.X, g.Y, 24 * g.P, 24 * g.P);
      c.globalAlpha = fl; c.drawImage(beacon.emit, 0, 0, 24, 24, g.X, g.Y, 24 * g.P, 24 * g.P); c.globalAlpha = 1;
      all.forEach(function (b) { if (g.lanes[b.lane] >= islandBottom) drawBoat(b, now); });

      /* light: halo, two beams that meet the water, and the boats' lanterns, all at 1/5 resolution */
      lowx.clearRect(0, 0, low.width, low.height);
      var Lx = g.tx * k, Ly = g.ly * k, Rh = g.P * 10 * k * (1 + bump * 0.6), halo = lowx.createRadialGradient(Lx, Ly, 0, Lx, Ly, Rh);
      halo.addColorStop(0, tint(0.95 * fl, 0, now, 'rgba(255,238,170,' + (0.95 * fl).toFixed(3) + ')'));
      halo.addColorStop(0.3, tint(0.4 * fl, 40, now, 'rgba(255,205,105,' + (0.4 * fl).toFixed(3) + ')'));
      halo.addColorStop(1, 'rgba(255,170,60,0)');
      lowx.fillStyle = halo; lowx.fillRect(Lx - Rh, Ly - Rh, 2 * Rh, 2 * Rh);
      var phi = phase();
      for (i = 0; i < 2; i++) {
        var ph = phi + i * Math.PI, dx = Math.cos(ph), fc = Math.sin(ph), len = g.Lmax * Math.abs(dx) * k;
        if (len < 2) continue;
        var ex = Lx + (dx >= 0 ? 1 : -1) * len, ey = g.seaY * k, vx = ex - Lx, vy = ey - Ly, vl = Math.sqrt(vx * vx + vy * vy);
        var hw = Math.max(1.5, len * 0.05), px = -vy / vl * hw, py = vx / vl * hw;
        var a = BEAM * (0.45 + 0.5 * Math.max(0, fc));
        var grad = lowx.createLinearGradient(Lx, Ly, ex, ey);
        grad.addColorStop(0, tint(a, i * 180, now, 'rgba(255,240,180,' + a.toFixed(3) + ')'));
        grad.addColorStop(0.6, tint(a * 0.35, i * 180 + 50, now, 'rgba(255,215,125,' + (a * 0.35).toFixed(3) + ')'));
        grad.addColorStop(1, tint(a * 0.25, i * 180 + 100, now, 'rgba(255,200,100,' + (a * 0.25).toFixed(3) + ')'));
        lowx.fillStyle = grad;
        wedge(Lx, Ly, ex + px, ey + py, ex - px, ey - py);
        wedge(Lx, Ly, ex + px * 0.4, ey + py * 0.4, ex - px * 0.4, ey - py * 0.4);
        var pool = lowx.createRadialGradient(ex, ey, 0, ex, ey, Math.max(3, hw * 2.2));
        pool.addColorStop(0, tint(a * 0.6, i * 180, now, 'rgba(255,236,170,' + (a * 0.6).toFixed(3) + ')'));
        pool.addColorStop(1, 'rgba(255,210,120,0)');
        lowx.fillStyle = pool; lowx.fillRect(ex - hw * 3, ey - hw * 3, hw * 6, hw * 6);
      }
      lamps.forEach(function (l) {
        var r = Math.max(3, g.Pb * 5 * k), lx = l.x * k, ly = l.y * k, lg = lowx.createRadialGradient(lx, ly, 0, lx, ly, r);
        lg.addColorStop(0, 'rgba(255,226,140,' + (0.8 * Math.min(1, l.a)).toFixed(3) + ')');
        lg.addColorStop(1, 'rgba(255,200,100,0)');
        lowx.fillStyle = lg; lowx.fillRect(lx - r, ly - r, 2 * r, 2 * r);
      });
      c.globalCompositeOperation = 'screen';
      c.drawImage(low, 0, 0, low.width * LOWPX, low.height * LOWPX);
      c.globalCompositeOperation = 'source-over';
      var st = Math.floor(now / 180);
      for (i = 0; i < 7; i++) {                                    /* the lamp reflected in the water */
        var wv = g.P * (5 - i * 0.55), yy = g.seaTop + g.P * (1.8 + i * 0.9), jit = ((st + i * 3) % 3 - 1) * g.P * 0.5;
        c.fillStyle = 'rgba(255,224,140,' + (0.5 * (1 - i / 8)).toFixed(3) + ')';
        c.fillRect(Math.round(g.tx - wv / 2 + jit), Math.round(yy), Math.round(wv), Math.max(2, Math.round(g.P * 0.35)));
      }
      var ps = Math.max(4, g.Pb + 2);                              /* fireworks */
      parts.forEach(function (p) {
        c.globalAlpha = Math.min(1, p.life * 1.4);
        c.fillStyle = p.col;
        c.fillRect(Math.round(p.x / ps) * ps, Math.round(p.y / ps) * ps, ps, ps);
      });
      rockets.forEach(function (rk) {                              /* rising rockets with a short pixel trail */
        var pr = Math.min(1, rk.t / rk.dur), ry = rk.y0 + (rk.y1 - rk.y0) * (1 - (1 - pr) * (1 - pr)), j;
        for (j = 0; j < 5; j++) {
          c.globalAlpha = 1 - j * 0.2;
          c.fillStyle = j === 0 ? '#ffffff' : 'hsl(' + rk.hue + ',100%,75%)';
          c.fillRect(Math.round(rk.x / ps) * ps, Math.round((ry + j * ps * 1.2) / ps) * ps, ps, ps);
        }
      });
      c.globalAlpha = 1;
    }

    function frame(now) {
      raf = 0;
      if (!running) return;
      if (now - lastT >= 30) { var dt = Math.min(0.1, (now - lastT) / 1000); lastT = now; step(dt, now); draw(now); }
      raf = requestAnimationFrame(frame);
    }
    api.start = function () {
      geometry();
      rebuild(true);
      if (!boats.length) for (var i = 0; i < 3; i++) spawn(true);
      running = true; lastT = 0;
      if (reduced) { draw(performance.now()); return; }
      if (!raf) raf = requestAnimationFrame(frame);
    };
    api.stop = function () { running = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } };
    api.refresh = function () { if (g) rebuild(true); };
    api.poke = function () { bump = 1; };
    api.secret = function () { if (!reduced) { secretT = performance.now(); nextExp = 1.2; volley = false; rockets = []; } };
    window.addEventListener('resize', function () {
      if (!running) return;
      geometry(); rebuild(false);
      if (reduced) draw(performance.now());
    });
    return api;
  })();


  function artCtx(box, w, h) {
    var cv = box.querySelector('canvas');
    cv.width = w; cv.height = h;
    cv.style.width = 'calc(' + w + ' * var(--ip, 3px))';
    return cv.getContext('2d');
  }
  function stringArt(box, rows, pal) {
    var w = rows[0].length, x = artCtx(box, w, rows.length);
    rows.forEach(function (r, y) { for (var i = 0; i < w; i++) if (pal[r[i]]) { x.fillStyle = pal[r[i]]; x.fillRect(i, y, 1, 1); } });
  }
  /* a tiny 8-puzzle in the lighthouse palette: bevelled tiles, a gap where the blank is, a pointer about to slide one */
  function puzzleArt(box) {
    var x = artCtx(box, 22, 20);
    var T = [['#3B4DA8', '#7E8FE0', '#1B2560'], ['#D9719A', '#F3A6C0', '#8E3F66'], ['#F4A261', '#FFD0A0', '#A0592B'],
      ['#1B7A94', '#7FD0DC', '#0E4C6B'], null, ['#FFD95A', '#FFF8C8', '#B8841A'],
      ['#EADFC4', '#FFFFFF', '#A8946A'], ['#6A4A9C', '#A98BE0', '#3C2A66'], ['#5DB6C4', '#C4F0F6', '#2B7C8C']];
    function px(c, X, Y) { x.fillStyle = c; x.fillRect(X, Y, 1, 1); }
    T.forEach(function (t, i) {
      var x0 = 1 + (i % 3) * 6, y0 = 1 + Math.floor(i / 3) * 6, a, b;
      if (!t) {                                       /* the blank: a dark socket with dotted corners */
        x.fillStyle = '#0d1830'; x.fillRect(x0, y0, 5, 5);
        [[0, 0], [4, 0], [0, 4], [4, 4], [2, 0], [0, 2], [4, 2], [2, 4]].forEach(function (d) { px('#486b8d', x0 + d[0], y0 + d[1]); });
        return;
      }
      x.fillStyle = t[0]; x.fillRect(x0, y0, 5, 5);
      for (a = 0; a < 5; a++) { px(t[1], x0 + a, y0); px(t[1], x0, y0 + a); px(t[2], x0 + a, y0 + 4); px(t[2], x0 + 4, y0 + a); }
      px(t[0], x0 + 4, y0); px(t[0], x0, y0 + 4);     /* soft corners */
      px(t[1], x0 + 2, y0 + 2);                       /* glint */
      px(t[2], x0 + 3, y0 + 3);
    });
    var cur = ['o......', 'oo.....', 'owo....', 'owwo...', 'owwwo..', 'owwoo..', 'owowo..', 'oo.owo.', 'o...oo.'];
    cur.forEach(function (r, y) { for (var i = 0; i < 7; i++) if (r[i] !== '.') px(r[i] === 'o' ? '#0b0f1a' : '#ffffff', 15 + i, 9 + y); });
  }
  puzzleArt($('c-play').querySelector('.mcard-icon'));
  stringArt($('c-watch').querySelector('.mcard-icon'), [
        '....ooooo....', '..oowwwwwoo..', '.owwwiiiwwwo.', 'owwwiippiwwwo', '.owwwiiiwwwo.', '..oowwwwwoo..', '....ooooo....'],
      { o: '#f8e7b0', w: '#ffffff', i: '#5DB6C4', p: '#151F4A' });

  var TROPHY_ROWS = [
    '.#########.', '#.#######.#', '#.#######.#', '#..#####..#', '.#.#####.#.', '..#######..',
    '...#####...', '....###....', '.....#.....', '....###....', '...#####...'];
  var QMARK_ROWS = ['..###..', '.#...#.', '.....#.', '....#..', '...#...', '.......', '...#...'];
  function trophyIcon(box, state) {                             /* state: 'got', 'locked', 'secret' */
    var pal = state === 'got' ? { '#': '#FFD95A' } : state === 'secret' ? { '#': '#8A6BD0' } : { '#': '#5b6f8a' };
    stringArt(box, state === 'secret' ? QMARK_ROWS : TROPHY_ROWS, pal);
  }
  stringArt($('c-bench').querySelector('.mcard-icon'), [
        '#...........', '#........cc.', '#........cc.', '#...bb...cc.', '#...bb...cc.', '#aa.bb...cc.', '#aa.bb...cc.', '#aa.bb...cc.', '#aa.bb...cc.', '############'],
      { '#': '#f8e7b0', a: '#5DB6C4', b: '#D9719A', c: '#FFD95A' });
  stringArt($('c-trophy').querySelector('.mcard-icon'), TROPHY_ROWS, { '#': '#FFD95A' });
  trophyIcon($('toast').querySelector('.ticon'), 'got');
  $('c-bench').querySelector('.mcard-icon').style.setProperty('--ip', '5px');
  $('c-trophy').querySelector('.mcard-icon').style.setProperty('--ip', '5px');

  function refreshCards() {
    var n = playMode ? (R && shown() > 0 && states[shown()] !== GOAL ? shown() : 0) : (playSaved ? playSaved.moves.length : 0);
    $('c-play-k').textContent = n > 0 ? 'Resume · ' + n + (n === 1 ? ' move' : ' moves') : 'You steer';
    var b = fleet.boats.length;
    $('c-trophy-d').textContent = achCount() + ' of ' + ACH.length + ' trophies · ' + b + (b === 1 ? ' boat' : ' boats') + (b === 0 ? '. Win a game to dock one.' : '.');
  }

  /* ---------- trophy room ---------- */
  var trophyReset = false;
  function renderTrophies() {
    var html = '';
    ACH.forEach(function (a) {
      var got = ach[a.id], hid = a.secret && !got;
      html += '<div class="tcard ' + (got ? 'got' : 'locked') + '"><span class="ticon" data-st="' + (got ? 'got' : hid ? 'secret' : 'locked') + '" aria-hidden="true"><canvas></canvas></span><div>' +
          '<b>' + (hid ? '???' : a.name) + '</b><span>' + (hid ? 'A secret. ' + a.hint : a.desc) + '</span>' +
          (got ? '<small>Unlocked ' + new Date(got).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + '</small>' : '<small>Locked</small>') + '</div></div>';
    });
    $('t-grid').innerHTML = html;
    Array.prototype.forEach.call($('t-grid').querySelectorAll('.ticon'), function (el) { trophyIcon(el, el.getAttribute('data-st')); });
    $('t-sum').textContent = achCount() + ' of ' + ACH.length + ' trophies unlocked.';
    var counts = { fish: 0, sail: 0, gold: 0, ghost: 0 }, parts = [];
    fleet.boats.forEach(function (b) { counts[b.t]++; });
    Object.keys(TIERS).forEach(function (t) { if (counts[t]) parts.push('<span>' + TIERS[t].name + (counts[t] > 1 ? 's' : '') + ' × ' + counts[t] + '</span>'); });
    $('t-fleet').innerHTML = parts.length ? parts.join('') : '<span>No boats yet. The harbour is waiting.</span>';
  }
  function openTrophy() {
    renderTrophies();
    modal = 'trophy';
    $('trophy').hidden = false;
    $('t-close').focus();
  }
  function closeModal() {
    if (modal === 'ghost') {
      gh.open = false; cancelAnimationFrame(gh.raf);
      $('ghost').hidden = true;
      if (!$('p-ghost').disabled) $('p-ghost').focus();
    } else if (modal === 'trophy') {
      $('trophy').hidden = true;
      if (inMenu) $('c-trophy').focus();
    }
    modal = null;
    refreshCards();
  }
  onClick('t-close', closeModal);
  onClick('g-close', closeModal);
  ['trophy', 'ghost'].forEach(function (id) { $(id).addEventListener('click', function (e) { if (e.target === this) closeModal(); }); });
  onClick('t-reset', function () {
    var b = $('t-reset');
    if (!trophyReset) {
      trophyReset = true; b.textContent = 'Sure? Click again';
      setTimeout(function () { trophyReset = false; b.textContent = 'Reset trophies and fleet'; }, 3000);
      return;
    }
    trophyReset = false; b.textContent = 'Reset trophies and fleet';
    ach = {}; fleet = { boats: [], unseen: 0 }; pstats = { algos: {} };
    lsSet('pharos-ach-v1', ach); lsSet('pharos-fleet-v1', fleet); lsSet('pharos-stats-v1', pstats);
    renderTrophies(); menuScene.refresh(); refreshCards();
  });

  /* ---------- ghost race ---------- */
  var gh = { open: false, you: [], opt: [], t0: 0, raf: 0, ms: 500, lastK: -1, finished: false, youC: null, optC: null };
  function drawTileOn(c, v, x, y, alpha, badge) {
    var sx = (v % 3) * 8, sy = Math.floor(v / 3) * 8;
    c.globalAlpha = alpha;
    c.drawImage(spriteCv, sx, sy, 8, 8, x, y, T, T);
    if (badge !== null) {
      c.fillStyle = 'rgba(255,255,255,0.28)';
      c.fillRect(x + 4, y + 4, T - 8, 4); c.fillRect(x + 4, y + 4, 4, T - 8);
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(x + 4, y + T - 8, T - 8, 4); c.fillRect(x + T - 8, y + 4, 4, T - 8);
      c.fillStyle = '#0B0F1A';
      c.fillRect(x, y, T, 4); c.fillRect(x, y + T - 4, T, 4); c.fillRect(x, y, 4, T); c.fillRect(x + T - 4, y, 4, T);
      if (badge) {
        var s = 4, bw = 3 * s + 12, bh = 5 * s + 12, gl = GLYPH[v], r, cc;
        c.fillStyle = 'rgba(10,14,26,0.88)';
        c.fillRect(x + 10, y + 10, bw, bh);
        c.fillStyle = '#FFFFFF';
        for (r = 0; r < 5; r++) for (cc = 0; cc < 3; cc++) if (gl[r][cc] === '1') c.fillRect(x + 16 + cc * s, y + 16 + r * s, s, s);
      }
    }
    c.globalAlpha = 1;
  }
  function ghostBoard(c, a, b, t, merged) {
    var p, v;
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, 448, 448);
    if (merged) {
      for (p = 0; p < 9; p++) c.drawImage(spriteCv, (p % 3) * 8, Math.floor(p / 3) * 8, 8, 8, 32 + (p % 3) * T, 32 + Math.floor(p / 3) * T, T, T);
      c.strokeStyle = 'rgba(255,217,90,0.9)'; c.lineWidth = 4;
      c.strokeRect(30, 30, 3 * T + 4, 3 * T + 4);
      return;
    }
    c.fillStyle = 'rgba(255,255,255,0.06)';
    for (p = 0; p < 9; p++) { var xy = slotXY(p); c.fillRect(xy[0], xy[1], T, T); }
    var te = 1 - (1 - t) * (1 - t), moving = [];
    for (v = 0; v < 9; v++) {
      var pa = a.indexOf(String(v)), pb = b.indexOf(String(v)), A = slotXY(pa), B = slotXY(pb);
      var x = q(A[0] + (B[0] - A[0]) * te), y = q(A[1] + (B[1] - A[1]) * te);
      if (v === 0) { drawTileOn(c, 0, x, y, 0.1, null); continue; }
      if (pa === pb) drawTileOn(c, v, x, y, 1, true); else moving.push([v, x, y]);
    }
    moving.forEach(function (m) { drawTileOn(c, m[0], m[1], m[2], 1, true); });
  }
  function ghostPaint(c, L, k, f) {
    var n = L.length - 1;
    if (k >= n) ghostBoard(c, L[n], L[n], 1, true);
    else ghostBoard(c, L[k], L[k + 1], f, false);
  }
  function ghostTick(ts) {
    gh.raf = 0;
    if (!gh.open) return;
    if (!gh.t0) gh.t0 = ts;
    var el = ts - gh.t0, k = Math.floor(el / gh.ms), f = reduced ? 1 : (el % gh.ms) / gh.ms;
    var yn = gh.you.length - 1, on = gh.opt.length - 1, last = Math.max(yn, on);
    ghostPaint(gh.youC, gh.you, k, f);
    ghostPaint(gh.optC, gh.opt, k, f);
    $('g-you-c').textContent = 'You · move ' + Math.min(k, yn) + ' of ' + yn + (k >= yn ? '  ✓' : '');
    $('g-opt-c').textContent = 'Ghost · move ' + Math.min(k, on) + ' of ' + on + (k >= on ? '  ✓' : '');
    if (k !== gh.lastK && k < last) sfx.move(k % 9);
    gh.lastK = k;
    if (k >= last) { finishGhost(); return; }
    gh.raf = requestAnimationFrame(ghostTick);
  }
  function finishGhost() {
    gh.finished = true;
    var yn = gh.you.length - 1, on = gh.opt.length - 1;
    msg($('g-msg'), yn === on ? 'A dead heat: you matched the ghost move for move.' : 'The ghost needs ' + on + ' moves. You took ' + yn + ', which is ' + (yn - on) + ' more. Replay to watch again.', yn === on ? 'good' : '');
    unlock('ghost');
  }
  function startGhost() {
    if (!gh.opt) return;
    cancelAnimationFrame(gh.raf);
    gh.t0 = 0; gh.lastK = -1; gh.finished = false; gh.open = true;
    msg($('g-msg'), '', '');
    gh.raf = requestAnimationFrame(ghostTick);
  }
  async function openGhost() {
    if (!R || states[shown()] !== GOAL || N < 1) return;
    var init = R.initial, you = states.slice(0, N + 1);
    gh.you = you; gh.opt = null; gh.open = false;
    gh.youC = $('g-you').getContext('2d'); gh.optC = $('g-opt').getContext('2d');
    gh.ms = +$('g-speed').value;
    [gh.youC, gh.optC].forEach(function (c) { c.clearRect(0, 0, 448, 448); });
    $('g-you-c').textContent = 'You · ' + (you.length - 1) + ' moves';
    $('g-opt-c').textContent = 'Ghost · …';
    msg($('g-msg'), 'Asking the solver for the optimal route…', '');
    $('g-replay').disabled = true;
    modal = 'ghost';
    $('ghost').hidden = false;
    $('g-close').focus();
    var opt;
    try { opt = await optimal(init); }
    catch (err) { if (gh.you === you) { msg($('g-msg'), 'The ghost needs the solver server. ' + err.message, 'bad'); } return; }
    if (modal !== 'ghost' || gh.you !== you) return;      /* closed, or a different race, while waiting */
    if (!opt.solved) { msg($('g-msg'), 'The solver found no solution for this board.', 'bad'); return; }
    gh.opt = applyMoves(init, opt.moves);
    $('g-replay').disabled = false;
    startGhost();
  }
  onClick('p-ghost', openGhost);
  onClick('g-replay', startGhost);
  $('g-speed').addEventListener('change', function () { gh.ms = +this.value; startGhost(); });

  /* ---------- benchmark lab ---------- */
  var ALGO_COL = { bfs: '#5DB6C4', dfs: '#D9719A', iddfs: '#F4A261', 'astar-m': '#FFD95A', 'astar-e': '#9be7a2' };
  var BN_MODES = { '8': 'Easy', '16': 'Medium', '24': 'Hard', perm: 'Random boards' };
  var BN = { ctl: null, running: false, cancel: false, last: lsGet('pharos-bench-v1', null) };
  (function () {
    var html = '<legend>Algorithms</legend>';
    ALGOS.forEach(function (a) {
      html += '<label class="chk"><input type="checkbox" id="bn-a-' + a.key + '" checked><i style="background:' + ALGO_COL[a.key] + '"></i>' + a.label + '</label>';
    });
    $('bn-algos').innerHTML = html;
  })();

  function hashSeed(str) {                                      /* xmur3 */
    var h = 1779033703 ^ str.length, i;
    for (i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function mulberry(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function seededBoards(seed, count, mode) {
    var rnd = mulberry(hashSeed(seed)), out = [], seen = {}, guard = 0, s, i;
    while (out.length < count && guard++ < 20000) {
      if (mode === 'perm') {
        var a = [0, 1, 2, 3, 4, 5, 6, 7, 8], t, j;
        for (i = 8; i > 0; i--) { j = Math.floor(rnd() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
        if (inversions(a.join('')) % 2 === 1) {
          var nz = [];
          a.forEach(function (v, k) { if (v !== 0) nz.push(k); });
          t = a[nz[0]]; a[nz[0]] = a[nz[1]]; a[nz[1]] = t;
        }
        s = a.join('');
      } else {
        var prev = '';
        s = GOAL;
        for (i = 0; i < +mode; i++) {
          var z = s.indexOf('0'), opts = NEI[z].filter(function (m) { return m[0] !== OPP[prev]; });
          var pick = opts[Math.floor(rnd() * opts.length)];
          s = swap(s, z, pick[1]); prev = pick[0];
        }
      }
      if (s === GOAL || seen[s]) continue;
      seen[s] = 1; out.push(s);
    }
    return out;
  }

  /* One run on the server. Resolves to { status: 'ok' | 'fail' | 'timeout' | 'cancel' | 'error', ... }.
     The time limit is enforced here: the page stops waiting, the server is not told to stop. */
  function bnJob(key, init, limit) {
    var ctl = new AbortController();
    BN.ctl = ctl;
    return requestSolve(init, [key], { timeoutMs: limit, signal: ctl.signal }).then(function (o) {
      var r = o[key];
      return { status: r.solved ? 'ok' : 'fail', len: r.cost === null ? r.moves.length : r.cost, expanded: r.expanded, generated: r.generated, ms: r.ms };
    }, function (err) {
      return { status: err.kind === 'timeout' ? 'timeout' : err.kind === 'cancel' ? 'cancel' : 'error', error: err.message };
    }).then(function (r) { if (BN.ctl === ctl) BN.ctl = null; return r; });
  }

  function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
  function fmtAvg(n) {
    if (n === null || n === undefined) return '—';
    if (n < 10) return n.toFixed(2);
    if (n < 1000) return n.toFixed(1);
    return Math.round(n).toLocaleString('en-US');
  }
  function bnSummarize(d) {
    return d.keys.map(function (k) {
      var lens = [], exps = [], ms = [], gaps = [], fails = 0, tos = 0, optN = 0;
      d.rows.forEach(function (row) {
        var r = row.res[k];
        if (!r) return;
        if (r.status === 'ok') {
          lens.push(r.len); exps.push(r.expanded); ms.push(r.ms);
          if (row.opt !== null) { gaps.push(r.len - row.opt); if (r.len === row.opt) optN++; }
        } else { fails++; if (r.status === 'timeout') tos++; }
      });
      return { key: k, solved: lens.length, failed: fails, timeouts: tos, len: mean(lens), gap: mean(gaps), exp: mean(exps),
        ms: mean(ms), maxMs: ms.length ? Math.max.apply(null, ms) : null, optimal: optN };
    });
  }
  function algoLabel(k) { return ALGOS.filter(function (a) { return a.key === k; })[0].label; }
  function chartHTML(title, note, rows, fmtv, log) {
    var vals = rows.map(function (r) { return r.v; }).filter(function (v) { return v !== null; }), max = vals.length ? Math.max.apply(null, vals) : 0;
    var h = '<figure class="chart"><figcaption>' + title + '<span>' + note + '</span></figcaption>';
    rows.forEach(function (r) {
      var pct = r.v === null || max <= 0 ? 0 : (log ? Math.log(1 + r.v) / Math.log(1 + max) : r.v / max) * 100;
      if (r.v !== null && r.v > 0 && pct < 2) pct = 2;
      h += '<div class="crow"><span>' + algoLabel(r.key) + '</span><span class="ctrack" aria-hidden="true"><i style="width:' + pct.toFixed(1) + '%;background:' + ALGO_COL[r.key] + '"></i></span><span class="cv">' + (r.v === null ? 'n/a' : fmtv(r.v, r)) + '</span></div>';
    });
    return h + '</figure>';
  }
  function bnRender() {
    var d = BN.last;
    if (!d || !d.rows.length) { $('bn-out').hidden = true; return; }
    var S = bnSummarize(d), n = d.rows.length;
    function best(f, lowerBetter) {
      var v = S.filter(function (s) { return s[f] !== null && s.solved > 0; }).map(function (s) { return s[f]; });
      return v.length > 1 ? Math.min.apply(null, v) : null;
    }
    var bl = best('len'), bg = best('gap'), be = best('exp'), bm = best('ms'), bx = best('maxMs');
    $('bn-sub').textContent = '· seed "' + d.seed + '" · ' + n + (n === 1 ? ' puzzle' : ' puzzles') + ' · ' + BN_MODES[d.mode] + ' · limit ' + (d.limit / 1000) + ' s';
    $('bn-sum').querySelector('tbody').innerHTML = S.map(function (s) {
      function cell(v, b, f) { return '<td class="num' + (v !== null && v === b ? ' best' : '') + '">' + f(v) + '</td>'; }
      return '<tr><td><i style="display:inline-block;width:10px;height:10px;margin-right:8px;background:' + ALGO_COL[s.key] + '"></i>' + algoLabel(s.key) + '</td>' +
          '<td class="num">' + s.solved + ' / ' + (s.solved + s.failed) + '</td><td class="num">' + s.failed + (s.timeouts ? ' (timeout)' : '') + '</td>' +
          cell(s.len, bl, fmtAvg) + cell(s.gap, bg, fmtAvg) + cell(s.exp, be, fmtAvg) +
          cell(s.ms, bm, fmtMs) + cell(s.maxMs, bx, fmtMs) + '</tr>';
    }).join('');
    var ch = '';
    ch += chartHTML('Average runtime', 'milliseconds, log scale, shorter is faster', S.map(function (s) { return { key: s.key, v: s.ms }; }), fmtMs, true);
    ch += chartHTML('Average nodes expanded', 'log scale, shorter is leaner', S.map(function (s) { return { key: s.key, v: s.exp }; }), fmtAvg, true);
    ch += chartHTML('Average solution length', 'moves, log scale, shorter is better', S.map(function (s) { return { key: s.key, v: s.len }; }), fmtAvg, true);
    ch += chartHTML('Average extra moves over optimal', 'log scale, zero means always optimal', S.map(function (s) { return { key: s.key, v: s.gap }; }), fmtAvg, true);
    ch += chartHTML('Puzzles solved', 'within the time limit, longer is better', S.map(function (s) { return { key: s.key, v: (s.solved + s.failed) ? s.solved / (s.solved + s.failed) * 100 : null }; }),
        function (v, r) { var s = S.filter(function (x) { return x.key === r.key; })[0]; return s.solved + ' of ' + (s.solved + s.failed); }, false);
    $('bn-charts').innerHTML = ch;
    var head = '<tr><th>#</th><th>Start</th><th class="num">Optimal</th>' + d.keys.map(function (k) { return '<th class="num">' + algoLabel(k) + '</th>'; }).join('') + '</tr>';
    $('bn-per').querySelector('thead').innerHTML = head;
    $('bn-per').querySelector('tbody').innerHTML = d.rows.map(function (row, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + flatText(row.init) + '</td><td class="num">' + (row.opt === null ? '—' : row.opt) + '</td>' +
          d.keys.map(function (k) {
            var r = row.res[k];
            return '<td class="num">' + (!r ? '—' : r.status === 'ok' ? r.len + ' · ' + fmtMs(r.ms) : r.status) + '</td>';
          }).join('') + '</tr>';
    }).join('');
    $('bn-out').hidden = false;
  }
  function bnSetBusy(on) {
    BN.running = on;
    ['bn-run', 'bn-seed', 'bn-count', 'bn-mode', 'bn-time'].forEach(function (id) { $(id).disabled = on; });
    ALGOS.forEach(function (a) { $('bn-a-' + a.key).disabled = on; });
    $('bn-cancel').disabled = !on;
  }
  function bnProgress(done, total) {
    var pct = total ? Math.round(done / total * 100) : 0;
    $('bn-bar').querySelector('i').style.width = pct + '%';
    $('bn-bar').setAttribute('aria-valuenow', String(pct));
  }
  async function runBench() {
    if (BN.running) return;
    var keys = ALGOS.map(function (a) { return a.key; }).filter(function (k) { return $('bn-a-' + k).checked; });
    if (!keys.length) { msg($('bn-msg'), 'Pick at least one algorithm.', 'bad'); return; }
    var seed = $('bn-seed').value.trim() || 'lighthouse', count = +$('bn-count').value, mode = $('bn-mode').value, limit = +$('bn-time').value;
    var boards = seededBoards(seed, count, mode);
    var data = { seed: seed, mode: mode, limit: limit, keys: keys, rows: [], at: Date.now() };
    BN.last = data; BN.cancel = false;
    bnSetBusy(true); bnProgress(0, boards.length);
    var i, j, aborted = false, fatal = null;
    for (i = 0; i < boards.length && !aborted; i++) {
      var row = { init: boards[i], opt: null, res: {} };
      msg($('bn-msg'), 'Puzzle ' + (i + 1) + ' of ' + boards.length + ': finding the optimal length…', '');
      var ref = await bnJob('astar-m', boards[i], 60000);
      if (BN.cancel || ref.status === 'cancel') { aborted = true; break; }
      if (ref.status === 'error') { aborted = true; fatal = ref.error; break; }
      if (ref.status === 'ok') row.opt = ref.len;
      for (j = 0; j < keys.length; j++) {
        msg($('bn-msg'), 'Puzzle ' + (i + 1) + ' of ' + boards.length + ': ' + algoLabel(keys[j]) + '…', '');
        var r = keys[j] === 'astar-m' && ref.status === 'ok' ? ref : await bnJob(keys[j], boards[i], limit);
        if (BN.cancel || r.status === 'cancel') { aborted = true; break; }
        if (r.status === 'error') { aborted = true; fatal = r.error; break; }
        row.res[keys[j]] = r;
      }
      if (!aborted) { data.rows.push(row); bnProgress(i + 1, boards.length); bnRender(); }
    }
    bnSetBusy(false);
    lsSet('pharos-bench-v1', data);
    bnRender();
    if (fatal) msg($('bn-msg'), fatal + ' Stopped after ' + data.rows.length + ' of ' + boards.length + ' puzzles. The results so far are below.', 'bad');
    else if (aborted) msg($('bn-msg'), 'Cancelled after ' + data.rows.length + ' of ' + boards.length + ' puzzles. The results so far are below.', '');
    else { msg($('bn-msg'), 'Done: ' + boards.length + ' puzzles, ' + keys.length + ' algorithms.', 'good'); unlock('scientist'); }
  }
  function bnCSV() {
    var d = BN.last;
    if (!d) return;
    var lines = ['seed,difficulty,puzzle,start,optimal,algorithm,status,length,nodes_expanded,nodes_generated,ms'];
    d.rows.forEach(function (row, i) {
      d.keys.forEach(function (k) {
        var r = row.res[k];
        if (!r) return;
        lines.push([JSON.stringify(d.seed), BN_MODES[d.mode], i + 1, row.init, row.opt === null ? '' : row.opt, algoLabel(k), r.status,
          r.status === 'ok' ? r.len : '', r.expanded === undefined || r.expanded === null ? '' : r.expanded,
          r.generated === undefined || r.generated === null ? '' : r.generated, r.ms === undefined ? '' : r.ms.toFixed(3)].join(','));
      });
    });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/csv' }));
    a.download = 'lighthouse-benchmark-' + d.seed.replace(/[^a-z0-9_-]+/gi, '_') + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function bnShow() {
    var d = BN.last;
    if (d) {
      $('bn-seed').value = d.seed; $('bn-mode').value = d.mode; $('bn-time').value = String(d.limit);
      ALGOS.forEach(function (a) { $('bn-a-' + a.key).checked = d.keys.indexOf(a.key) >= 0; });
      bnRender();
    }
    msg($('bn-msg'), '', '');
    bnProgress(0, 0);
    $('bench').scrollTop = 0;
    $('bn-run').focus();
  }
  function bnLeave() {
    if (BN.running) { BN.cancel = true; if (BN.ctl) BN.ctl.abort(); }
  }
  onClick('bn-run', runBench);
  onClick('bn-cancel', function () { BN.cancel = true; if (BN.ctl) BN.ctl.abort(); });
  onClick('bn-back', function () { showBench(false); });
  onClick('bn-csv', bnCSV);

  /* ---------- screens ---------- */
  function showMenu(on) {
    if (on === inMenu) return;
    inMenu = on;
    document.body.classList.toggle('menu', on);
    if (on) {
      playing = false;
      tmPause();
      beacon.stop();
      if (document.body.classList.contains('watch')) setWatch(false);
      refreshCards();
      menuScene.start();
      sfx.menuStart();
    } else {
      menuScene.stop();
      sfx.menuStop();
      if (playMode && !editMode && !recorded && R && shown() > 0 && states[shown()] !== GOAL) tmStart();
      drawNow(); updateUI(true);
    }
  }
  function showBench(on) {
    if (on === benchOn) return;
    benchOn = on;
    document.body.classList.toggle('bench', on);
    document.body.classList.toggle('menu', !on);
    if (on) { menuScene.stop(); bnShow(); }
    else { bnLeave(); refreshCards(); menuScene.start(); $('c-bench').focus(); }
  }
  function pickMode(mode) {
    if (mode === 'bench') { sfx.fuse(); showBench(true); return; }
    if (mode === 'trophy') { openTrophy(); return; }
    sfx.fuse();
    setPlayMode(mode === 'play');
    if (mode === 'play' && !editMode && R && states[shown()] === GOAL) newGame();   /* a finished game starts a fresh one */
    showMenu(false);
  }
  onClick('c-play', function () { pickMode('play'); });
  onClick('c-watch', function () { pickMode('watch'); });
  onClick('c-bench', function () { pickMode('bench'); });
  onClick('c-trophy', function () { pickMode('trophy'); });
  onClick('m-menu', function () { showMenu(true); });
  ['c-play', 'c-watch', 'c-bench', 'c-trophy'].forEach(function (id) {
    $(id).addEventListener('mouseenter', function () { sfx.move(3); });
    $(id).addEventListener('focus', function () { sfx.move(5); });
  });

  /* ---------- the secret: poke the lamp five times, or the old cheat code ---------- */
  function triggerSecret() {
    if (!inMenu || benchOn || modal) return;
    sfx.secret();
    menuScene.secret();
    if (unlock('secret')) {
      awardBoat('ghost');
      setTimeout(function () { menuScene.refresh(); refreshCards(); }, 2200);
    }
  }
  var lampClicks = 0, lampT = 0, konami = [], KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  $('lamp-hit').addEventListener('click', function () {
    var now = performance.now();
    if (now - lampT > 2200) lampClicks = 0;
    lampT = now; lampClicks++;
    menuScene.poke();
    sfx.move(Math.min(8, lampClicks + 2));
    if (lampClicks >= 5) { lampClicks = 0; triggerSecret(); }
  });
  document.addEventListener('keydown', function (e) {
    if (!inMenu || benchOn || modal || e.ctrlKey || e.metaKey || e.altKey) return;
    konami.push(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    if (konami.length > KONAMI.length) konami.shift();
    if (konami.join() === KONAMI.join()) { konami = []; triggerSecret(); }
    var cards = [$('c-play'), $('c-watch'), $('c-bench'), $('c-trophy')], i = cards.indexOf(document.activeElement);
    if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4') cards[+e.key - 1].click();
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); cards[(i + 1) % cards.length].focus(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); cards[i <= 0 ? cards.length - 1 : i - 1].focus(); }
  });
  refreshCards();
  menuScene.start();

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
    if (!reduced && !anim && !raf && !document.hidden && !inMenu) drawNow();
  }, 70);
  checkInput();
  states = [parseState($('initial').value) || GOAL];
  drawNow();
  updateUI(true);
  renderCompare();
  doSolve();
})();