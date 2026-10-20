package io.github.ThisIsNotMyAI;

import java.util.*;

public class Solver {

    private record Pass(Node goal, boolean cutoff, int expanded, int maxDepth) {}


    public static SearchResult bfs(State start) {
        return search("BFS", start, new ArrayDeque<>(), null);
    }

    public static SearchResult dfs(State start) {
        return search("DFS", start, Collections.asLifoQueue(new ArrayDeque<>()), null);
    }

    public static SearchResult aStar(State start, Heuristic h) {
        return search("A*", start, new PriorityQueue<>(), h);
    }

    public static SearchResult iddfs(State start) {
        long t0 = System.nanoTime();
        int totalExp = 0, maxDepth = 0;

        for (int limit = 0; ; limit++) {
            Pass p = depthLimited(start, limit);
            totalExp += p.expanded();
            maxDepth = Math.max(maxDepth, p.maxDepth());

            if (p.goal() != null) {
                return success("IDDFS", p.goal(), totalExp, maxDepth, t0);
            }
            if (!p.cutoff()) {
                return new SearchResult("IDDFS", null, 0, 0, totalExp,
                        System.nanoTime() - t0);
            }
        }
    }

    // Unified Search

    private static SearchResult search(String name, State start, Queue<Node> frontier, Heuristic h) {
        long t0 = System.nanoTime();
        Set<State> explored = new HashSet<>();
        int expanded = 0, maxDepth = 0;

        frontier.add(new Node(start, null, null, 0, h == null ? 0 : h.estimate(start)));

        while (!frontier.isEmpty()) {
            Node current = frontier.poll();

            if (current.s().isGoal()) {
                return success(name, current, expanded, maxDepth, t0);
            }

            if (explored.add(current.s())) {
                expanded++;
                maxDepth = Math.max(maxDepth, current.g());
                for (Action action : current.s().getLegalActions()) {
                    State next = action.apply(current.s());
                    if (!explored.contains(next)) {
                        frontier.add(new Node(next, current, action,
                                current.g() + 1,
                                h == null ? 0 : h.estimate(next)));
                    }
                }
            }
        }

        return new SearchResult(name, null, 0, maxDepth, expanded,
                System.nanoTime() - t0);
    }


    private static Pass depthLimited(State start, int limit) {
        Deque<Node> stack = new ArrayDeque<>();
        Map<State, Integer> bestDepth = new HashMap<>();
        boolean cutoff = false;
        int expanded = 0, maxDepth = 0;

        stack.push(new Node(start, null, null, 0, 0));

        while (!stack.isEmpty()) {
            Node current = stack.pop();

            if (current.s().isGoal()) {
                return new Pass(current, cutoff, expanded, maxDepth);
            }

            Integer seen = bestDepth.get(current.s());
            if (seen != null && seen <= current.g()) continue;
            bestDepth.put(current.s(), current.g());

            if (current.g() == limit) {
                cutoff = true;
                continue;
            }

            expanded++;
            for (Action action : current.s().getLegalActions()) {
                State next = action.apply(current.s());
                stack.push(new Node(next, current, action, current.g() + 1, 0));
            }
        }
        return new Pass(null, cutoff, expanded, maxDepth);
    }


    private static SearchResult success(String name, Node goal, int expanded, int maxDepth, long t0) {
        List<Action> path = reconstructPath(goal);
        return new SearchResult(name, path, goal.g(), maxDepth,
                expanded, System.nanoTime() - t0);
    }

    private static List<Action> reconstructPath(Node goalNode) {
        List<Action> path = new ArrayList<>();
        for (Node n = goalNode; n.parent() != null; n = n.parent()) {
            path.add(n.a());
        }
        Collections.reverse(path);
        return path;
    }


    public static String report(SearchResult r) {
        StringBuilder sb = new StringBuilder();
        sb.append(String.format("Algorithm:        %s%n", r.algorithm()));

        if (!r.solved()) {
            sb.append("Result:           no solution found\n");
        } else {
            sb.append(String.format("Path to goal:     %s%n", r.path()));
            sb.append(String.format("Path cost:        %d%n", r.cost()));
            sb.append(String.format("Search maxDepth:     %d%n", r.maxDepth()));
        }

        sb.append(String.format("Nodes expanded:   %,d%n", r.nodesExpanded()));
        sb.append(String.format("Running time:     %.3f ms%n", r.elapsedNanos() / 1e6));
        return sb.toString();
    }
}