package io.github.ThisIsNotMyAI.solver;

import static java.lang.Math.*;

@FunctionalInterface
public interface Heuristic {
    double estimate(State s) ;

    Heuristic MANHATTAN  = s -> {
        double estimate = 0 ;
        for (int cell = 0 ; cell < 9 ; cell++){
            int cellValue = (int) s.get(cell);
            if(cellValue == 0) continue ;
            int row = cell / 3 , col = cell % 3 ;
            int trueRow = cellValue/3 , trueCol = cellValue % 3 ;
            estimate += abs(trueRow - row) + abs(trueCol - col) ;
        }
        return estimate ;
    } ;
    Heuristic EUCLIDEAN = s -> {
        double estimate = 0 ;
        for (int cell = 0 ; cell < 9 ; cell++){
            int cellValue = (int) s.get(cell);
            if(cellValue == 0) continue ;
            int row = cell / 3 , col = cell % 3 ;
            int trueRow = cellValue/3 , trueCol = cellValue % 3 ;
            estimate += sqrt(pow(trueRow-row, 2) + pow(trueCol-col, 2)) ;
        }
        return estimate ;
    } ;
}
