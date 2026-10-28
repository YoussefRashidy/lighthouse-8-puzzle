package io.github.ThisIsNotMyAI.solver;

public enum Action {
    UP(-1,0,'U') ,
    DOWN(1,0,'D'),
    LEFT(0,-1,'L'),
    RIGHT(0,1,'R') ;

    final int rowDirection ;
    final int colDirection ;
    public final char encoding ;

    Action(int rowDirection, int colDirection , char encoding) {
        this.rowDirection = rowDirection;
        this.colDirection = colDirection;
        this.encoding = encoding ;
    }

    public State apply(State state){
        int blank = (int) state.getBlank() ;
        int nRow = blank / 3 + this.rowDirection ;
        int nCol = blank % 3 + this.colDirection ;
        int cell = nRow*3 + nCol ;
        return state.swap(blank, cell) ;
    }
}
