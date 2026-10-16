package io.github.ThisIsNotMyAI.server.json;

import java.util.List;

public record SolveRequest(String initialConfiguration , List<Algorithm> algorithms) {
     public SolveRequest{
         if(initialConfiguration.length()!= 9)
             throw new IllegalArgumentException() ;
         int found = 0 ;
         for(char ch : initialConfiguration.toCharArray()){
             if(ch > '8' || ch < '0')
                 throw new IllegalArgumentException() ;
             found |= (1<<(ch-'0')) ;
         }
         if(found != 0X1FF )
             throw new IllegalArgumentException() ;
         //TODO check the parity of the board ;
    }
}
