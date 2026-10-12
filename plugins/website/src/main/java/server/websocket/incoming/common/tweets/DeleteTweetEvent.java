package server.websocket.incoming.common.tweets;

import server.Main;
import server.data.classes.tweet.Tweet;
import server.data.queries.TweetDao;
import server.utils.JsonFactory;
import server.websocket.WebSocketManager;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.misc.DataComposer;

public class DeleteTweetEvent extends IncomingWebMessage<DeleteTweetEvent.JONDeleteTweetEvent> {
    public DeleteTweetEvent(){
        super(JONDeleteTweetEvent.class);
    }
    @Override
    public void handle(WebSocketClient client, JONDeleteTweetEvent message) throws InterruptedException {
        if (client.getAccount() != null){
            Tweet tweet = Main.website.tweetManager.getTweet(message.tweetId, client.getAccount().getId());

            if (tweet != null) {
                if (TweetDao.deleteTweet(tweet.getId())){
                    if(Main.website.tweetManager.deleteMyTweet(message.tweetId, client.getAccount().getId())){
                        client.sendMessage(new DataComposer("tweetResponse", "Tweet borrado con exito"));

                        //Send all client
                        WebSocketManager.getInstance().getClientManager().sendWSForAll(new DataComposer("tweets", JsonFactory.getInstance().toJson(Main.website.tweetManager.getTweets())));
                    }
                    else client.sendMessage(new DataComposer("tweetResponse", "Algo salio mal"));
                }
            }
        }
    }

    static  class JONDeleteTweetEvent{
        int tweetId;
    }
}
