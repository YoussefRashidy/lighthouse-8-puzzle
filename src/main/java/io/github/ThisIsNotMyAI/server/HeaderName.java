package io.github.ThisIsNotMyAI.server;

public enum HeaderName {
    CONTENT_TYPE("Content-Type"),
    ALLOW_ORIGIN("Access-Control-Allow-Origin"),
    ALLOW_HEADERS("Access-Control-Allow-Headers"),
    ALLOW_METHODS("Access-Control-Allow-Methods");

    private final String value;
    HeaderName(String value) { this.value = value; }
    public String value() { return value; }
}
