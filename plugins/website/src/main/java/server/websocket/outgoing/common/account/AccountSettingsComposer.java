package server.websocket.outgoing.common.account;

import com.google.gson.JsonPrimitive;
import server.data.classes.account.Account;
import server.data.classes.account.AccountSetting;
import server.websocket.outgoing.OutgoingWebMessage;

public class AccountSettingsComposer extends OutgoingWebMessage {
    public AccountSettingsComposer(Account account) {
        super("settingsInfo");
        this.data.add("email", new JsonPrimitive(account.getEmail()));
        this.data.add("motto", new JsonPrimitive(account.getMotto()));

        //Extra Settings
        AccountSetting setting = account.getSettings();
        this.data.add("follow", new JsonPrimitive(setting.isBlockFollowing() ? 1 : 0));
        this.data.add("friends", new JsonPrimitive(setting.isBlockFriendRequests() ? 1 : 0));
        this.data.add("rooms", new JsonPrimitive(setting.isBlockRoomInvites() ? 1 : 0));
        this.data.add("alerts", new JsonPrimitive(setting.isBlockAlerts() ? 1 : 0));
        this.data.add("trades", new JsonPrimitive(setting.isAllowTrade() ? 1 : 0));
    }
}
