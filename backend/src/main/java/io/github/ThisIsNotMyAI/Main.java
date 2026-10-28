package io.github.ThisIsNotMyAI;

import io.github.ThisIsNotMyAI.solver.Action;
import io.github.ThisIsNotMyAI.solver.Solver;
import io.github.ThisIsNotMyAI.solver.State;
import io.github.ThisIsNotMyAI.solver.Heuristic;
import io.github.ThisIsNotMyAI.solver.SearchResult;

import java.util.Scanner;

public class Main {

    private static final int MAX_STEPS_TO_PRINT = 1000;

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        String input = args.length > 0 ? args[0] : null;
        String digits = null;
        State start = null;

        while (start == null) {
            if (input == null) {
                System.out.print("Enter start state (e.g. 125340678 or 1,2,5,3,4,0,6,7,8): ");
                input = scanner.nextLine();
            }
            try {
                digits = stripCommas(input.trim());
                start = State.parse(digits);
            } catch (IllegalArgumentException e) {
                System.out.println("Invalid input: " + e.getMessage());
                input = null;
            }
        }

        System.out.println("Start state:");
        System.out.println(box(start));

        if (!isSolvable(digits)) {
            System.out.println("This state is unsolvable (odd number of inversions). No search was run.");
            return;
        }

        run("BFS", Solver.bfs(start), start);
        run("DFS", Solver.dfs(start), start);
        run("IDDFS", Solver.iddfs(start), start);
        run("A* (Manhattan)", Solver.aStar(start, Heuristic.MANHATTAN), start);
        run("A* (Euclidean)", Solver.aStar(start, Heuristic.EUCLIDEAN), start);
    }


    private static String stripCommas(String s) {
        if (!s.contains(",")) return s;
        StringBuilder sb = new StringBuilder();
        for (String token : s.split(",", -1)) {
            token = token.trim();
            if (token.length() != 1)   // blocks "10,2,3,..." from sneaking in as "102..."
                throw new IllegalArgumentException("each comma-separated entry must be a single digit");
            sb.append(token);
        }
        return sb.toString();
    }


    private static boolean isSolvable(String digits) {
        int inversions = 0;
        for (int i = 0; i < 9; i++) {
            for (int j = i + 1; j < 9; j++) {
                char a = digits.charAt(i), b = digits.charAt(j);
                if (a != '0' && b != '0' && a > b) inversions++;
            }
        }
        return inversions % 2 == 0;
    }

    private static void run(String label, SearchResult r, State start) {
        System.out.println("=".repeat(45));
        System.out.println(label);
        System.out.println("=".repeat(45));
        System.out.println(Solver.report(r));

        if (r.solved()) {
            printSteps(start, r.path());
        }
    }

    private static void printSteps(State start, String path) {
        State s = start;
        System.out.println("Step 0 (start)");
        System.out.println(box(s));

        for (int i = 0; i < path.length() && i < MAX_STEPS_TO_PRINT; i++) {
            Action a = fromCode(path.charAt(i));
            s = a.apply(s);
            System.out.println("Step " + (i + 1) + ": move blank " + a);
            System.out.println(box(s));
        }
        if (path.length() > MAX_STEPS_TO_PRINT) {
            System.out.println("... (" + (path.length() - MAX_STEPS_TO_PRINT) + " more steps not shown)");
        }
        System.out.println(s.isGoal() ? "Goal reached!\n" : "Printing stopped before the goal.\n");
    }

    private static Action fromCode(char c) {
        for (Action a : Action.values()) {
            if (a.encoding == c) return a;
        }
        throw new IllegalArgumentException("Unknown move: " + c);
    }

    private static String box(State s) {
        StringBuilder sb = new StringBuilder();
        sb.append("┌───┬───┬───┐\n");
        for (int r = 0; r < 3; r++) {
            sb.append("│");
            for (int c = 0; c < 3; c++) {
                long v = s.get(r * 3 + c);
                sb.append(' ').append(v == 0 ? ' ' : (char) ('0' + v)).append(" │");
            }
            sb.append('\n');
            sb.append(r < 2 ? "├───┼───┼───┤\n" : "└───┴───┴───┘");
        }
        return sb.toString();
    }
}