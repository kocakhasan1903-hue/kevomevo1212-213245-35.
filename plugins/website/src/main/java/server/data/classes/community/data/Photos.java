package server.data.classes.community.data;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.rooms.RoomManager;
import com.eu.habbo.habbohotel.users.HabboInfo;
import com.eu.habbo.habbohotel.users.HabboManager;
import server.data.classes.account.AccountInfo;
import server.data.queries.MiscDao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class Photos {

    public int id;
    public AccountInfo account;
    public int roomId;
    public int date;
    public String url;

    public Photos (ResultSet set) throws SQLException {
        this.id = set.getInt("id");
        this.account = new AccountInfo(set.getInt("user_id"));
        this.roomId = set.getInt("room_id");
        this.date = set.getInt("timestamp");
        this.url = set.getString("url");
    }

    public int getId() {
        return id;
    }

    public AccountInfo getAccount() {
        return account;
    }

    public int getRoomId() {
        return roomId;
    }

    public int getDate() {
        return date;
    }

    public String getUrl() {
        return url;
    }
}
