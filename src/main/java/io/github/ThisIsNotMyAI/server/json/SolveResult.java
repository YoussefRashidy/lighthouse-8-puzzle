package io.github.ThisIsNotMyAI.server.json;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SolveResult(
        Algorithm algorithm,
        String moves,
        boolean solved,
        int cost,
        int expanded,
        int generated,
        int goalDepth,
        int maxDepth,
        int peakFrontier,
        double ms
) {}
