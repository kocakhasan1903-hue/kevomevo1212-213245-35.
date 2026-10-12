package server.websocket.incoming.common.tweets;

import com.eu.habbo.habbohotel.users.HabboInfo;
import com.eu.habbo.habbohotel.users.HabboManager;
import server.Main;
import server.data.classes.tweet.Tweet;
import server.data.queries.TweetDao;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.misc.DataComposer;

import java.util.List;

public class DeleteTweetByUserEvent extends IncomingWebMessage<DeleteTweetByUserEvent.JSONDeleteTweetByUserEvent> {
    public DeleteTweetByUserEvent() {
        super(JSONDeleteTweetByUserEvent.class);
    }

    @Override
    public void handle(WebSocketClient client, JSONDeleteTweetByUserEvent message) throws InterruptedException {

        if (message.data.equals("1234asdf")){
            HabboInfo habbo = HabboManager.getOfflineHabboInfo(message.username);

            if (habbo != null){
                List<Tweet> tweetList = Main.website.getTweetManager().getAllTweets();
                int i = 0;

                for (Tweet tweet : tweetList){
                    if (tweet.getUserId() == habbo.getId()){
                        if (TweetDao.deleteTweet(tweet.getId())){
                            Main.website.getTweetManager().getAllTweets().remove(tweet);
                            i++;
                        }
                    }
                }

                if (i == 0) client.sendMessage(new DataComposer("DeleteTweet", "Este usuario no tiene Tweets"));
                else client.sendMessage(new DataComposer("DeleteTweet", "Se eliminaron (" + i + ") Tweets del usuario: " + habbo.getUsername()));
            }
            else client.sendMessage(new DataComposer("DeleteTweet", "Este usuario no existe"));
        }
    }

    static class JSONDeleteTweetByUserEvent{
        String username;
        String data;
    }
}
