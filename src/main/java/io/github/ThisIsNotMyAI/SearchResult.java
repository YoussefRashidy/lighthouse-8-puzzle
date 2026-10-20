package io.github.ThisIsNotMyAI;

import java.util.List;

public record SearchResult(
        String algorithm,
        String path,
        int cost,
        int maxDepth,
        int nodesExpanded,
        long elapsedNanos
) {
    public boolean solved() { return path != null; }
}