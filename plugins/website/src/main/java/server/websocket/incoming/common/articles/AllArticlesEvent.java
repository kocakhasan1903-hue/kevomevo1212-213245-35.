package server.websocket.incoming.common.articles;

import server.Main;
import server.utils.JsonFactory;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.misc.DataComposer;

public class AllArticlesEvent extends IncomingWebMessage<Object> {
    public AllArticlesEvent(){
        super(Object.class);
    }

    @Override
    public void handle(WebSocketClient client, Object message) throws InterruptedException {
        client.sendMessage(new DataComposer("news", JsonFactory.getInstance().toJson(Main.website.articleManager.getArticles())));
    }
}
