package io.github.ThisIsNotMyAI.server.json;

import java.util.List;

public record SolveRequest(String initialConfiguration , List<Algorithm> algorithms) {
     public SolveRequest{
         if(initialConfiguration.length()!= 9)
             throw new IllegalArgumentException() ;
         int found = 0 ;
         for(char ch : initialConfiguration.toCharArray()){
             if(ch > '8' || ch < '0')
                 throw new IllegalArgumentException("Initial Configuration must be exactly 9 digits") ;
             found |= (1<<(ch-'0')) ;
         }
         if(found != 0X1FF )
             throw new IllegalArgumentException("Initial Configuration must be a permutation of 0..8") ;
         int inversions = 0;
         for (int i = 0; i < 9; i++) {
             for (int j = i + 1; j < 9; j++) {
                 int a = initialConfiguration.charAt(i) - '0';
                 int b = initialConfiguration.charAt(j) - '0';
                 if (a != 0 && b != 0 && a > b) inversions++;
             }
         }
         if (inversions % 2 != 0)
             throw new IllegalArgumentException("Initial Configuration is not solvable (odd number of inversions)");
         if(algorithms== null || algorithms.isEmpty())
             throw new IllegalArgumentException() ;
    }
}
