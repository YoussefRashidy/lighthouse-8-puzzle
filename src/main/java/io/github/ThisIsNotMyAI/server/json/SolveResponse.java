package io.github.ThisIsNotMyAI.server.json;

import java.util.List;
import java.util.Map;

public record SolveResponse(Map<Algorithm, SolveResult> results) {}