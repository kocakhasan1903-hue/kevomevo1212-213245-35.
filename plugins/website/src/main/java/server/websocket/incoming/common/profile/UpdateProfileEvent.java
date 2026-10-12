package server.websocket.incoming.common.profile;

import server.Main;
import server.data.classes.profile.Profile;
import server.data.queries.ProfileDao;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;

public class UpdateProfileEvent extends IncomingWebMessage<UpdateProfileEvent.JSONUpdateProfileEvent> {
    public UpdateProfileEvent(){
        super(JSONUpdateProfileEvent.class);
    }
    @Override
    public void handle(WebSocketClient client, JSONUpdateProfileEvent message) throws InterruptedException {
        if (client.getAccount() != null){
            Profile profile = Main.website.profileManager.getProfile(client.getAccount().getUsername()) == null ? ProfileDao.getOfflineHabboInfo(client.getAccount().getUsername()) : Main.website.profileManager.getProfile(client.getAccount().getUsername());

            if (profile != null){
                profile.setStyle(message.style);
            }
        }
    }

    static class JSONUpdateProfileEvent {
        String style;
    }
}
