package io.github.ThisIsNotMyAI.solver;

import io.github.ThisIsNotMyAI.server.json.Algorithm;
import io.github.ThisIsNotMyAI.server.json.SolveResult;

public record SearchResult(
        String algorithm,
        String path,
        int cost,
        int maxDepth,
        int nodesExpanded,
        int nodesGenerated,
        long elapsedNanos
) {
    public boolean solved() { return path != null; }

    private static SolveResult toSolveResult(SearchResult result) {
        String moves = result.solved()
                ? result.path()
                : null;
        return new SolveResult(
                Algorithm.valueOf(result.algorithm()), // TODO: Fix this
                moves,
                result.solved(),
                result.cost(),
                result.nodesExpanded(),
                result.nodesGenerated(),
                result.cost(),
                result.maxDepth(),
                result.elapsedNanos() / 1_000_000.0
        );
    }
}