package server.websocket.incoming.common.community;

import server.Main;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.community.TopsCurrencyComposer;

public class TopsEvent  extends IncomingWebMessage<Object> {
    public TopsEvent() {
        super(Object.class);
    }

    @Override
    public void handle(WebSocketClient client, Object message) throws InterruptedException {
        //TOPS
        client.sendMessage(new TopsCurrencyComposer(
                Main.website.communityManager.getTopsCredits(),
                Main.website.communityManager.getTopsDuckets(),
                Main.website.communityManager.getTopsCurrency(),
                Main.website.communityManager.getTopsDiamonds(),
                Main.website.communityManager.getLastUsers()
                )
        );
    }
}
