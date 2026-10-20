package io.github.ThisIsNotMyAI;

public enum Action {
    UP(-1,0) ,
    DOWN(1,0),
    LEFT(0,-1),
    RIGHT(0,1) ;

    final int rowDirection ;
    final int colDirection ;

    Action(int rowDirection, int colDirection) {
        this.rowDirection = rowDirection;
        this.colDirection = colDirection;
    }

    public State apply(State state){
        int blank = (int) state.getBlank() ;
        int nRow = blank / 3 + this.rowDirection ;
        int nCol = blank % 3 + this.colDirection ;
        int cell = nRow*3 + nCol ;
        return state.swap(blank, cell) ;
    }
}
