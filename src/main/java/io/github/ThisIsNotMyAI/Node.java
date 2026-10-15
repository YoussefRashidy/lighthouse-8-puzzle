package io.github.ThisIsNotMyAI;

public record Node(State s , Node parent , Action a , int g , double h) {
    double f(){return g+h;}
}
