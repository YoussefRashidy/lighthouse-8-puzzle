/* Board helpers shared by the page. The search itself lives on the solver server (see api.js). */
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

var LETTER = { Up: 'U', Down: 'D', Left: 'L', Right: 'R' };
var NAME = { U: 'Up', D: 'Down', L: 'Left', R: 'Right' };

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