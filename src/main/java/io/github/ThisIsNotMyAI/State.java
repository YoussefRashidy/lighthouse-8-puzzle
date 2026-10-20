package io.github.ThisIsNotMyAI;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public record State(long mask) {
    private static final Action[][] LEGAL_ACTIONS = new Action[9][] ;

    static {
        for(int cell = 0 ; cell < 9 ; cell++){
            int row = cell / 3 ; int col = cell % 3 ;
            List<Action> actionList = new ArrayList<>() ;
            for(Action action : Action.values()){
                int nRow = row + action.rowDirection ;
                int nCol = col + action.colDirection ;
                if(nRow >= 0 && nRow < 3 && nCol >= 0 && nCol < 3)
                    actionList.add(action) ;
            }
            LEGAL_ACTIONS[cell] = actionList.toArray(Action[]::new) ;
        }
    }

    public static State parse(String stateString){
        if(stateString.length() != 9)
            throw new IllegalArgumentException("need 9 digits: " + stateString) ;
        char[] chars = stateString.toCharArray() ;
        Arrays.sort(chars);
        String sorted =  new String(chars) ;
        if (!sorted.equals("012345678"))
            throw new IllegalArgumentException("Invalid state permutation (must contain digits 0-8 once): " + stateString) ;

        String reversed = new StringBuilder(stateString).reverse().toString() ;
        return new State(Long.parseLong(reversed,16)) ;
    }

    public static State of (int...cells){
        StringBuilder sb = new StringBuilder() ;
        for(int cell : cells)
            sb.append(cell) ;
        return parse(sb.toString()) ;
    }


    public long get(int i){
        return (mask>>>4*i)& 0xFL ;
    }

    public long getBlank(){
        for(int i = 0 ; i < 9 ; i++)
            if(get(i) == 0) return  i ;
        throw new IllegalStateException("no blank cell found in state %s".formatted(this));
    }

    public State swap(int i ,int j){
        long cellI = get(i);
        long cellJ = get(j);
        long clearedMask = mask & ~((0XFL << 4*i)|(0XFL << 4*j)) ;
        return new State(clearedMask | (cellI << 4*j) | (cellJ << 4*i)) ;
    }

    public Action[] getLegalActions() {
        int blankIndex = (int) getBlank() ;
        return LEGAL_ACTIONS[blankIndex];
    }


    public boolean isGoal(){
        return mask == 0x876543210L ;
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        for (int r = 0; r < 3; r++) {
            for (int c = 0; c < 3; c++) {
                long v = get(r * 3 + c);
                sb.append(v == 0 ? '_' : (char) ('0' + v));
                if (c < 2) sb.append(' ');
            }
            if (r < 2) sb.append('\n');
        }
        return sb.toString();
    }
}
