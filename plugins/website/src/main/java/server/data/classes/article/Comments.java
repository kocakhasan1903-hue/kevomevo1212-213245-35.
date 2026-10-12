package server.data.classes.article;

import server.data.classes.account.AccountInfo;
import server.data.classes.misc.RoomData;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Comparator;

public class Comments implements Comparable<Comments>{
    private final int id;
    private final int articleId;
    private final AccountInfo account;
    private final String message;
    private final int timesTamp;

    public static final Comparator SORT_ID = (o1, o2) -> {
        return o1 instanceof Comments && o2 instanceof Comments ? ((Comments)o2).getId() - ((Comments)o1).getId() : 0;
    };

    public Comments(ResultSet set) throws SQLException {
        this.id = set.getInt("id");
        this.articleId = set.getInt("news_id");
        this.account = new AccountInfo(set.getInt("player_id"));
        this.message = set.getString("message");
        this.timesTamp = set.getInt("timestamp");
    }

    public Comments(ResultSet set, AccountInfo account) throws SQLException {
        this.id = set.getInt("id");
        this.articleId = set.getInt("news_id");
        this.account = account;
        this.message = set.getString("message");
        this.timesTamp = set.getInt("timestamp");
    }

    public int getId() {
        return id;
    }

    public int getArticleId() {
        return articleId;
    }

    public AccountInfo getAccount() {
        return account;
    }

    public String getMessage() {
        return message;
    }

    public int getTimesTamp() {
        return timesTamp;
    }

    @Override
    public int compareTo(Comments o) {
        return 0;
    }
}
