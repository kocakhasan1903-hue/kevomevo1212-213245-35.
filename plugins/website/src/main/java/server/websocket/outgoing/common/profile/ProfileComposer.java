package server.websocket.outgoing.common.profile;

import com.google.gson.JsonPrimitive;
import server.Main;
import server.data.classes.profile.Profile;
import server.utils.JsonFactory;
import server.websocket.outgoing.OutgoingWebMessage;

public class ProfileComposer extends OutgoingWebMessage {
    public ProfileComposer(Profile profile) {
        super("profileData");
        this.data.add("account", new JsonPrimitive(JsonFactory.getInstance().toJson(profile.getAccount())));
        this.data.add("lastOnline", new JsonPrimitive(profile.getLastOnline()));
        this.data.add("lastRegister", new JsonPrimitive(profile.getLastRegister()));
        this.data.add("rooms", new JsonPrimitive(JsonFactory.getInstance().toJson(profile.getRooms())));
        this.data.add("groups", new JsonPrimitive(JsonFactory.getInstance().toJson(profile.getGroups())));
        this.data.add("friends", new JsonPrimitive(JsonFactory.getInstance().toJson(profile.getFriends())));
        this.data.add("badges", new JsonPrimitive(JsonFactory.getInstance().toJson(profile.getBadges())));
        this.data.add("tweets", new JsonPrimitive(JsonFactory.getInstance().toJson(Main.website.getTweetManager().getTweetsByAccount(profile.getId()))));
        this.data.add("style", new JsonPrimitive(profile.getStyle()));
    }
}
