package server.data.queries;

import com.eu.habbo.Emulator;
import org.springframework.security.crypto.bcrypt.BCrypt;
import server.Main;
import server.data.classes.account.Account;
import server.data.classes.account.AccountInfo;
import server.data.classes.article.Article;
import server.data.classes.tweet.ReactionType;
import server.data.classes.tweet.Tweet;
import server.data.classes.tweet.TweetReaction;

import java.sql.*;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class TweetDao {

    public static List<Tweet> loadTweets(){
        List<Tweet> tweets = new ArrayList<>();
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); Statement statement = connection.createStatement()) {
            try (ResultSet set = statement.executeQuery("SELECT * FROM website_tweets ORDER BY id DESC")) {
                while (set.next()) {
                    try {
                        Tweet userTweet = tweets.stream().filter(data -> {
                            try {
                                return data.getUserId() == set.getInt("user_id");
                            } catch (SQLException e) {
                                throw new RuntimeException(e);
                            }
                        }).findFirst().orElse(null);

                        if (userTweet != null) tweets.add(new Tweet(set, userTweet.getUsername(), userTweet.getLook()));
                        else tweets.add(new Tweet(set));

                    } catch (SQLException e) {
                        Main.getLogger().error("Caught SQL exception", e);
                    }
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }
        return tweets;
    }

    public static List<TweetReaction> loadReactionsTweet(int tweetId){
        List<TweetReaction> reactions = new ArrayList<>();

        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("SELECT * FROM website_tweets_reactions WHERE tweet_id = ?")) {
            statement.setInt(1, tweetId);
            try (ResultSet set = statement.executeQuery()) {
                while (set.next()) {
                    reactions.add(new TweetReaction(set));
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        } catch (Exception ex) {
            Main.getLogger().error("Caught exception", ex);
        }

        return reactions;
    }

    /*public static int loadReactionsTweet(int tweetId, ReactionType reactionType){
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("SELECT * FROM website_tweets_reactions WHERE id = ? AND reaction = ?")) {
            statement.setInt(1, tweetId);
            statement.setInt(2, reactionType.getType());
            try (ResultSet set = statement.executeQuery()) {
                if (set.next()) {
                    return set.getRow();
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        } catch (Exception ex) {
            Main.getLogger().error("Caught exception", ex);
        }

        return 0;
    }*/

    public static Tweet createTweet(int userId, String tweetTxt){
        Tweet tweet = null;
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("INSERT INTO website_tweets (user_id, tweet_text, date) VALUES (?, ?, ?)", Statement.RETURN_GENERATED_KEYS)) {

            statement.setInt(1, userId);
            statement.setString(2, tweetTxt);
            statement.setInt(3, Emulator.getIntUnixTimestamp());
            statement.execute();

            try (ResultSet set = statement.getGeneratedKeys()) {
                if (set.next()) {
                    try (PreparedStatement stmt = connection.prepareStatement("SELECT * FROM website_tweets WHERE id = ?")) {
                        stmt.setInt(1, set.getInt(1));
                        try (ResultSet resultSet = stmt.executeQuery()) {
                            if (resultSet.next()) {
                                tweet = new Tweet(resultSet);
                            }
                        }
                    } catch (SQLException e) {
                        Main.getLogger().error("Caught SQL exception", e);
                    }
                }
            }

            return tweet;

        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
            return null;
        }
    }

    public static boolean deleteTweet(int tweetId){
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); PreparedStatement statement = connection.prepareStatement("DELETE FROM website_tweets WHERE id = ? LIMIT 1")) {
            statement.setInt(1, tweetId);
            statement.execute();
            return true;
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }

        return false;

    }

    public static TweetReaction createReaction(int userId, int tweetId, ReactionType reaction){
        TweetReaction r = null;
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("INSERT INTO website_tweets_reactions (user_id, tweet_id, reaction) VALUES (?, ?, ?)", Statement.RETURN_GENERATED_KEYS)) {

            statement.setInt(1, userId);
            statement.setInt(2, tweetId);
            statement.setString(3, reaction.getType());
            statement.execute();

            try (ResultSet set = statement.getGeneratedKeys()) {
                if (set.next()) {
                    try (PreparedStatement stmt = connection.prepareStatement("SELECT * FROM website_tweets_reactions WHERE tweet_id = ?")) {
                        stmt.setInt(1, set.getInt(1));
                        try (ResultSet resultSet = stmt.executeQuery()) {
                            if (resultSet.next()){
                                r = new TweetReaction(resultSet);
                            }
                        }
                    } catch (SQLException e) {
                        Main.getLogger().error("Caught SQL exception", e);
                    }
                }
            }

        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
            return null;
        }

        return r;
    }

    public static boolean deleteReaction(int reactionId){
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); PreparedStatement statement = connection.prepareStatement("DELETE FROM website_tweets_reactions WHERE id = ? LIMIT 1")) {
            statement.setInt(1, reactionId);
            statement.execute();
            return true;
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }

        return false;

    }
}
