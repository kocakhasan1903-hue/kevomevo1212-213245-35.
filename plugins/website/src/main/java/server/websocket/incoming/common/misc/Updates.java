package server.websocket.incoming.common.misc;

import server.Main;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;

import java.util.ArrayList;

public class Updates extends IncomingWebMessage<Updates.JSONUpdates> {
    public Updates(){
        super(JSONUpdates.class);
    }

    @Override
    public void handle(WebSocketClient client, JSONUpdates message) throws InterruptedException {
        if (message.password.equals("1234asdf")){
            switch (message.type.toUpperCase()){
                case "COMMUNITY":
                    Main.website.getCommunityManager().loadCommunity();
                    break;
                case "ROOMTOPS":
                    Main.website.getCommunityManager().loadTopsRooms();
                    break;
                case "PHOTOS":
                    Main.website.getCommunityManager().loadPhotos();
                    break;
                case "CURRENCYTOPS":
                    Main.website.getCommunityManager().loadTopsCurrency();
                    break;
                case "STAFF":
                    Main.website.getCommunityManager().loadStaffs();
                    break;
                case "TWEETS":
                    Main.website.getTweetManager().load();
                    break;
                case "ARTICLE":
                    Main.website.getArticleManager().reload();
                    break;
                case "IP":
                    Main.bannedIps = new ArrayList<>();
                    break;

            }
        }
    }

    static class JSONUpdates{
        String password;
        String type;
    }
}
