package server.data.classes.profile;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.GameEnvironment;
import com.eu.habbo.habbohotel.guilds.Guild;
import com.eu.habbo.habbohotel.guilds.GuildMember;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.users.HabboBadge;
import com.eu.habbo.habbohotel.users.inventory.BadgesComponent;
import server.Main;
import server.data.classes.account.AccountInfo;
import server.data.classes.misc.GroupData;
import server.data.classes.misc.RoomData;
import server.data.classes.tweet.Tweet;
import server.data.queries.CommunityDao;
import server.data.queries.ProfileDao;
import server.utils.Utils;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public class Profile {
    public int id;
    public AccountInfo account;
    public int lastOnline;
    public int lastRegister;

    //Misc
    public List<RoomData> rooms = new ArrayList<>();
    public List<GroupData> groups;
    public List<String> badges = new ArrayList<>();
    public List<AccountInfo> friends;
    public String style;
    public Profile(ResultSet set) throws SQLException {
        this.id = set.getInt("id");

        this.account = new AccountInfo(this.getId());

        this.lastOnline = set.getInt("last_online");
        this.lastRegister = set.getInt("account_created");

        this.style = "{\"background\":\"\",\"widgets\":[],\"notes\":[],\"stickers\":[]}";
        // Legacy sticker layout is optional; older server schemas may not contain it.
        java.sql.ResultSetMetaData columns = set.getMetaData();
        for (int i=1; i<=columns.getColumnCount(); i++) {
            if ("profile_style".equalsIgnoreCase(columns.getColumnLabel(i))) {
                String saved = set.getString(i);
                if(saved != null && !saved.trim().isEmpty()) this.style = saved;
                break;
            }
        }

        // A web profile needs room summaries, not running emulator room instances.
        try (java.sql.Connection connection = Emulator.getDatabase().getDataSource().getConnection()) {
            this.rooms = server.data.queries.ProfileRooms.load(connection, this.account.username);
        }

        this.groups = ProfileDao.getGroupsByUser(this.id);

        for (HabboBadge badgeCode : ProfileDao.getBadgesOfflineHabbo(this.getId())){
            this.badges.add(badgeCode.getCode());
        }

        this.friends = ProfileDao.loadFriends(this.id);

    }

    public int getId() {
        return id;
    }

    public AccountInfo getAccount() {
        return account;
    }

    public int getLastOnline() {
        return lastOnline;
    }

    public int getLastRegister() {
        return lastRegister;
    }

    public List<RoomData> getRooms() {
        return rooms;
    }

    public List<GroupData> getGroups() {
        return groups;
    }

    public List<String> getBadges() {
        return badges;
    }

    public List<AccountInfo> getFriends() {
        return friends;
    }

    public String getStyle() {
        return style;
    }

    public void setStyle(String style) {
        this.style = style;
        ProfileDao.updateStyle(this.getId(), style);
    }
}
