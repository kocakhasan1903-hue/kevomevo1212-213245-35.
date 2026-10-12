package server.data.classes.account;

import server.data.queries.AccountDao;

import java.sql.ResultSet;
import java.sql.SQLException;

public class AccountSetting {
    private final int userId;
    private boolean blockFollowing;
    private boolean blockFriendRequests;
    private boolean blockRoomInvites;
    private boolean allowTrade;
    private boolean blockAlerts;

    public AccountSetting(ResultSet set) throws SQLException {
        this.userId = set.getInt("user_id");
        this.blockFollowing = set.getString("block_following").equals("1");
        this.blockFriendRequests = set.getString("block_friendrequests").equals("1");
        this.blockRoomInvites = set.getString("block_roominvites").equals("1");
        this.allowTrade = set.getString("can_trade").equals("1");
        this.blockAlerts = set.getString("block_alerts").equals("1");
    }

    public int getUserId() {
        return userId;
    }

    public boolean isBlockFollowing() {
        return blockFollowing;
    }

    public void setBlockFollowing(boolean blockFollowing) {
        this.blockFollowing = blockFollowing;

    }

    public boolean isBlockFriendRequests() {
        return blockFriendRequests;
    }

    public void setBlockFriendRequests(boolean blockFriendRequests) {
        this.blockFriendRequests = blockFriendRequests;
    }

    public boolean isBlockRoomInvites() {
        return blockRoomInvites;
    }

    public void setBlockRoomInvites(boolean blockRoomInvites) {
        this.blockRoomInvites = blockRoomInvites;
    }

    public boolean isAllowTrade() {
        return allowTrade;
    }

    public void setAllowTrade(boolean allowTrade) {
        this.allowTrade = allowTrade;
    }

    public boolean isBlockAlerts() {
        return blockAlerts;
    }

    public void setBlockAlerts(boolean blockAlerts) {
        this.blockAlerts = blockAlerts;
    }
}
