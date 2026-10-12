package server.data.classes.community.data;

import java.sql.ResultSet;
import java.sql.SQLException;

public class Ranks {
    public int id;
    public String name;
    public String badge;
    public String description;

    public Ranks(ResultSet set) throws SQLException {
        this.id = set.getInt("id");
        this.name = set.getString("rank_name");
        this.badge = set.getString("badge");
        this.description = set.getString("rank_description");
    }

    public int getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getBadge() {
        return badge;
    }
}
