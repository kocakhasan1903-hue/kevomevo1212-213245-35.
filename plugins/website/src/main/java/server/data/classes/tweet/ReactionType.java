package server.data.classes.tweet;

public enum ReactionType {
    LIKE("like"),
    SLIME("slime"),
    HEART("heart"),
    BOBBA("bobba"),
    POOP("poop");

    private final String type;

    ReactionType(String type) {
        this.type = type;
    }

    public String getType() {
        return this.type;
    }
}
