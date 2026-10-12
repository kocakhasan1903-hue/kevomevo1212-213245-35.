package server.websocket.incoming.common.tweets;

import server.Main;
import server.utils.JsonFactory;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.misc.DataComposer;

public class TweetsEvent extends IncomingWebMessage<Object> {
    public TweetsEvent(){
        super(Object.class);
    }
    @Override
    public void handle(WebSocketClient client, Object message) throws InterruptedException {
        if (client.getAccount() != null){
            client.sendMessage(new DataComposer("tweets", JsonFactory.getInstance().toJson(Main.website.tweetManager.getTweets())));
        }
    }
}
