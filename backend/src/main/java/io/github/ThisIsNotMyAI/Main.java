package io.github.ThisIsNotMyAI;

import io.github.ThisIsNotMyAI.server.Server;

import java.io.IOException;

public class Main {
    public static void main(String[] args) throws IOException {
        var server = new Server(8080);
        server.start();
    }
}