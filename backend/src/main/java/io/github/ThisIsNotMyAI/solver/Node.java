package io.github.ThisIsNotMyAI.solver;

public record Node(State s , Node parent , Action a , int g , double h) implements Comparable<Node> {
    double f(){return g+h;}

    public int compareTo(Node n){
        return Double.compare(this.f(),n.f());
    }
}
