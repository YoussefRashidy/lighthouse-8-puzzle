package io.github.ThisIsNotMyAI;

import java.util.List;

public record SearchResult(
        String algorithm,
        List<Action> path,
        int cost,
        int maxDepth,
        int nodesExpanded,
        long elapsedNanos
) {
    public boolean solved() { return path != null; }
}