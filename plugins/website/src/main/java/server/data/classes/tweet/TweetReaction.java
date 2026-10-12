package server.data.classes.tweet;


import java.sql.ResultSet;
import java.sql.SQLException;

public class TweetReaction {
    private int id;
    private int userId;
    private int tweetId;
    private ReactionType reaction;

    public TweetReaction(ResultSet set) throws SQLException {
        this.id = set.getInt("id");
        this.userId = set.getInt("user_id");
        this.tweetId = set.getInt("tweet_id");
        this.reaction = ReactionType.valueOf(set.getString("reaction").toUpperCase());
    }

    public int getId() {
        return id;
    }

    public int getUserId() {
        return userId;
    }

    public int getTweetId() {
        return tweetId;
    }

    public ReactionType getReaction() {
        return reaction;
    }
}
