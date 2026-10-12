package server.data.classes.article;

import server.data.classes.account.AccountInfo;
import server.data.queries.ArticleDao;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public class Article {
    public int id;
    public AccountInfo author;
    public String category;
    public String header;
    public String title;
    public String shortStory;
    public String fullStory;
    public int date;
    public List<Comments> comments = new ArrayList<>();

    public Article(ResultSet set) throws SQLException {
        this.id = set.getInt("id");
        this.author = new AccountInfo(set.getInt("user_id"));
        this.category = "";
        this.header = set.getString("image");
        this.title = set.getString("title");
        this.shortStory = set.getString("short_story");
        this.fullStory = set.getString("full_Story");
        this.date = set.getInt("timestamp");

        this.comments = ArticleDao.loadComments(this.id);
    }

    public Article(ResultSet set, AccountInfo account) throws SQLException {
        this.id = set.getInt("id");
        this.author = account;
        this.category = "";
        this.header = set.getString("image");
        this.title = set.getString("title");
        this.shortStory = set.getString("short_story");
        this.fullStory = set.getString("full_Story");
        this.date = set.getInt("timestamp");

        this.comments = ArticleDao.loadComments(this.id);
    }

    public int getId() {
        return id;
    }

    public AccountInfo getAuthor() {
        return author;
    }

    public String getCategory() {
        return category;
    }

    public String getHeader() {
        return header;
    }

    public String getTitle() {
        return title;
    }

    public String getShortStory() {
        return shortStory;
    }

    public String getFullStory() {
        return fullStory;
    }

    public int getDate() {
        return date;
    }

    public void addComment(Comments comment){
        this.comments.add(comment);
        this.comments.sort(Comments.SORT_ID);
    }
    public boolean deleteMyComment(int commentId, int userId) {
        Comments comment = this.comments.stream().filter(data -> commentId == data.getId() && data.getAccount().getId() == userId).findAny().orElse(null);

        if (comment != null){
            this.comments.remove(comment);
            return true;
        }else return false;
    }
}
