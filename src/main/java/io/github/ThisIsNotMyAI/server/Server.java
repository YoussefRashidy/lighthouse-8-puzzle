package io.github.ThisIsNotMyAI.server;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import io.github.ThisIsNotMyAI.server.json.SolveRequest;
import static io.github.ThisIsNotMyAI.server.HeaderName.* ;
import static io.github.ThisIsNotMyAI.server.HeaderValue.*;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import static java.net.HttpURLConnection.*;
import java.net.InetSocketAddress;
import java.util.Map;
import java.util.Objects;

public class Server {
    private static final ObjectMapper mapper = new ObjectMapper() ;
    private final HttpServer server ;

    public Server(int port) throws IOException {
        this.server = HttpServer.create(new InetSocketAddress(port),0);
        this.server.createContext("/solve",this::handleSolve) ;
    }

    private final void handleSolve(HttpExchange exchange) throws IOException {
        //TODO call the solver to solve and return the results
        try(exchange){
            exchange.getResponseHeaders().set(ALLOW_ORIGIN.value(), ANY_ORIGIN);
            exchange.getResponseHeaders().set(ALLOW_HEADERS.value(), ALLOWED_HEADERS);
            exchange.getResponseHeaders().set(ALLOW_METHODS.value(),ALLOWED_METHODS );
            String httpMethod = exchange.getRequestMethod() ;
            if (httpMethod.equals("OPTIONS")) {
                exchange.sendResponseHeaders(HTTP_NO_CONTENT, -1);
                return;
            }

            if(!Objects.equals(httpMethod, "POST")){
                byte[] bytes = mapper.writeValueAsBytes(Map.of("Error","Unexpected HttpMethod use POST")) ;
                exchange.getResponseHeaders().set(CONTENT_TYPE.value(), JSON);
                exchange.sendResponseHeaders(HTTP_BAD_METHOD, bytes.length);
                try(OutputStream os = exchange.getResponseBody()){
                    os.write(bytes);
                }
                return;
            }

            try(InputStream is = exchange.getRequestBody()){
                SolveRequest solveRequest = mapper.readValue(is, SolveRequest.class) ;
                //TODO call the solver for now i will return the request as is
                byte[] bytes = mapper.writeValueAsBytes(solveRequest) ;
                exchange.getResponseHeaders().set(CONTENT_TYPE.value(), JSON);
                exchange.sendResponseHeaders(HTTP_OK, bytes.length);
                try(OutputStream os = exchange.getResponseBody()){
                    os.write(bytes);
                }
            }
            catch (JsonProcessingException e) {
                byte[] bytes = mapper.writeValueAsBytes(Map.of("Error",String.valueOf(e.getMessage()))) ;
                exchange.getResponseHeaders().set(CONTENT_TYPE.value(), JSON);
                exchange.sendResponseHeaders(HTTP_BAD_REQUEST, bytes.length);
                try(OutputStream os = exchange.getResponseBody()){
                    os.write(bytes);
                }
            }

        }
    }

    public void start(){
        this.server.start();
    }

    public void stop(){
        this.server.stop(1000);
    }

    public static void main(String[] args) throws IOException {
        var server = new Server(8080) ;
        server.start();
    }
}
