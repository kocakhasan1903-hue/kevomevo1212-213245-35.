package server.websocket.incoming.common.community;

import server.Main;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.community.VipsComposer;

public class VipsEvent extends IncomingWebMessage<Object> {
    public VipsEvent(){
        super(Object.class);
    }

    @Override
    public void handle(WebSocketClient client, Object message) throws InterruptedException {
        client.sendMessage(new VipsComposer(Main.website.communityManager.vips));
    }
}
