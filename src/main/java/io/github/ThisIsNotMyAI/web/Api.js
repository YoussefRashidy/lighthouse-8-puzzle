/* Solver server client. Every search in the page (watch, play, ghost race, benchmark) goes through here.
   POST SERVER_URL  { "initialConfiguration": "125340678", "algorithms": ["BFS", "ASTAR_MANHATTAN"] }
   ->  { "results": { "BFS": { solved, moves, cost, expanded, generated, goalDepth, maxDepth, peakFrontier, ms }, ... } }
   Errors come back as { "Error": "..." } with a non-2xx status. */
var SERVER_URL = 'http://localhost:8080/solve';
var SOLVE_TIMEOUT_MS = 60000;

/* key = this page's id, server = the algorithm name the server expects and uses as the key in `results`. */
var ALGOS = [
    { key: 'bfs', label: 'BFS', server: 'BFS' },
    { key: 'dfs', label: 'DFS', server: 'DFS' },
    { key: 'iddfs', label: 'Iterative DFS', server: 'IDDFS' },
    { key: 'astar-m', label: 'A* (Manhattan)', server: 'ASTAR_MANHATTAN' },
    { key: 'astar-e', label: 'A* (Euclidean)', server: 'ASTAR_EUCLIDEAN' }
];
var ALGO_BY_KEY = {};
ALGOS.forEach(function (a) { ALGO_BY_KEY[a.key] = a; });

function apiError(kind, message) {
    var e = new Error(message);
    e.kind = kind;                       /* 'timeout' | 'network' | 'cancel' | 'http' | 'format' */
    return e;
}
function numOrNull(v) { return typeof v === 'number' ? v : null; }

/* SolveResult (server) -> the result object the rest of the page uses */
function fromServer(key, init, r) {
    var names = (r.moves || '').split('').map(function (ch) {
        if (!NAME[ch]) throw apiError('format', 'The server sent an unknown move "' + ch + '".');
        return NAME[ch];
    });
    return { algo: ALGO_BY_KEY[key].label, initial: init, moves: names, solved: !!r.solved,
        cost: numOrNull(r.cost), expanded: numOrNull(r.expanded), generated: numOrNull(r.generated),
        goalDepth: r.solved ? numOrNull(r.goalDepth) : null, maxDepth: numOrNull(r.maxDepth),
        peak: numOrNull(r.peakFrontier), ms: numOrNull(r.ms) };
}

/* One POST for any number of algorithms. Resolves to { uiKey: result }.
   opts.timeoutMs: give up after this long (default SOLVE_TIMEOUT_MS). opts.signal: an AbortSignal to cancel early. */
async function requestSolve(init, keys, opts) {
    opts = opts || {};
    var limit = opts.timeoutMs || SOLVE_TIMEOUT_MS, ctl = new AbortController(), timedOut = false, res;
    var timer = setTimeout(function () { timedOut = true; ctl.abort(); }, limit);
    function onAbort() { ctl.abort(); }
    if (opts.signal) {
        if (opts.signal.aborted) { clearTimeout(timer); throw apiError('cancel', 'Cancelled.'); }
        opts.signal.addEventListener('abort', onAbort);
    }
    try {
        res = await fetch(SERVER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                initialConfiguration: init,
                algorithms: keys.map(function (k) { return ALGO_BY_KEY[k].server; })
            }),
            signal: ctl.signal
        });
        var data = null;
        try { data = await res.json(); } catch (err) { if (ctl.signal.aborted) throw err; /* else: non-JSON body */ }
        if (!res.ok) throw apiError('http', (data && data.Error) || 'Solver error: HTTP ' + res.status + '.');
        if (!data || !data.results) throw apiError('format', 'Unexpected response: no "results" field.');
        var out = {};
        keys.forEach(function (k) {
            var r = data.results[ALGO_BY_KEY[k].server];
            if (!r) throw apiError('format', 'The response has no result for ' + ALGO_BY_KEY[k].label + '.');
            out[k] = fromServer(k, init, r);
        });
        return out;
    } catch (err) {
        if (err.kind) throw err;
        if (timedOut) throw apiError('timeout', 'The solver did not answer within ' + (limit / 1000) + ' s.');
        if (opts.signal && opts.signal.aborted) throw apiError('cancel', 'Cancelled.');
        throw apiError('network', 'Could not reach the solver at ' + SERVER_URL + '. Is the solver server running?');
    } finally {
        clearTimeout(timer);
        if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
    }
}

/* The optimal solution for a board (A* with Manhattan distance), cached so par, hints and the ghost
   race never ask twice for the same board. Failed requests are not cached. */
var optCache = new Map();
function optimal(state) {
    var p = optCache.get(state);
    if (!p) {
        p = requestSolve(state, ['astar-m']).then(function (o) { return o['astar-m']; });
        optCache.set(state, p);
        if (optCache.size > 300) optCache.delete(optCache.keys().next().value);
        p.catch(function () { if (optCache.get(state) === p) optCache.delete(state); });
    }
    return p;
}