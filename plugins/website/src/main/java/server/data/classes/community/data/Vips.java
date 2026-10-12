package server.data.classes.community.data;

import java.sql.ResultSet;
import java.sql.SQLException;

public class Vips {
    public int userId;
    public String username;
    public String look;

    public Vips(ResultSet set) throws SQLException {
        this.userId = set.getInt("id");
        this.username = set.getString("username");
        this.look = set.getString("look");
    }
}
