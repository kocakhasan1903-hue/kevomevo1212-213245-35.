package server.data.queries;

import com.eu.habbo.Emulator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.bcrypt.BCrypt;
import server.Main;
import server.data.classes.account.Account;
import server.data.classes.article.Article;
import server.data.classes.article.Comments;

import java.sql.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ArticleDao {

    public static List<Article> loadArticles(){
        List<Article> article = new ArrayList<Article>();
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); Statement statement = connection.createStatement()) {
            try (ResultSet set = statement.executeQuery("SELECT * FROM website_articles ORDER BY `id` DESC")) {
                while (set.next()) {
                    try {
                        Article userArticle = article.stream().filter(data -> {
                            try {
                                return data.author.getId() == set.getInt("user_id");
                            } catch (SQLException e) {
                                throw new RuntimeException(e);
                            }
                        }).findFirst().orElse(null);

                        if (userArticle != null) article.add(new Article(set, userArticle.author));
                        else article.add(new Article(set));


                    } catch (SQLException e) {
                        Main.getLogger().error("Caught SQL exception", e);
                    }
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }

        return article;
    }


    public static Map<Integer, String> loadCategories(){
    Map<Integer, String> category = new HashMap<Integer, String>();
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); Statement statement = connection.createStatement()) {
        try (ResultSet set = statement.executeQuery("SELECT * FROM website_news_categories")) {
            while (set.next()) {
                try {
                    category.put(set.getInt("id"), set.getString("category"));
                } catch (SQLException e) {
                    Main.getLogger().error("Caught SQL exception", e);
                }
            }
        }
    } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
    }
        return category;
    }

    public static List<Comments> loadComments(int id){
        List<Comments> comments = new ArrayList<>();
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement statement = connection.prepareStatement("SELECT * FROM website_news_reactions WHERE news_id = ? ORDER BY `id` DESC")) {
                statement.setInt(1, id);
            try (ResultSet set = statement.executeQuery()) {
                while (set.next()) {

                  Comments userComment = comments.stream().filter(data -> {
                        try {
                            return data.getAccount().getId() == set.getInt("player_id");
                        } catch (SQLException e) {
                            throw new RuntimeException(e);
                        }
                    }).findFirst().orElse(null);

                    if (userComment != null) comments.add(new Comments(set, userComment.getAccount()));
                    else comments.add(new Comments(set));
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }
        return comments;
    }

    public static Comments insertComment(Article article, String text, Account account){
        Comments comment = null;
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("INSERT INTO website_news_reactions (news_id, player_id, message, timestamp) VALUES (?, ?, ? ,?)", Statement.RETURN_GENERATED_KEYS)) {

            statement.setInt(1, article.getId());
            statement.setInt(2, account.getId());
            statement.setString(3, text);
            statement.setInt(4, Emulator.getIntUnixTimestamp());
            statement.execute();



            try (ResultSet set = statement.getGeneratedKeys()) {
                if (set.next()) {
                    try (PreparedStatement stmt = connection.prepareStatement("SELECT * FROM website_news_reactions WHERE id = ?")) {
                        stmt.setInt(1, set.getInt(1));
                        try (ResultSet resultSet = stmt.executeQuery()) {
                            if (resultSet.next()) {
                                comment = new Comments(resultSet);
                            }
                        }
                    } catch (SQLException e) {
                        Main.getLogger().error("Caught SQL exception", e);
                    }
                }
            }

            return comment;

        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
            return null;
        }
    }

    public static boolean deleteComment(int commentId){
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); PreparedStatement statement = connection.prepareStatement("DELETE FROM website_news_reactions WHERE id = ? LIMIT 1")) {
            statement.setInt(1, commentId);
            statement.execute();
            return true;
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }

        return false;

    }
}
