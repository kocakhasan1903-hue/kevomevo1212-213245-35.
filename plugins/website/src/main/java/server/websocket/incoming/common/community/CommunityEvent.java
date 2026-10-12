package server.websocket.incoming.common.community;

import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.community.CommunityComposer;

public class CommunityEvent extends IncomingWebMessage<Object> {
    public CommunityEvent(){
        super(Object.class);
    }

    @Override
    public void handle(WebSocketClient client, Object message) throws InterruptedException {
        client.sendMessage(new CommunityComposer());
    }
}
