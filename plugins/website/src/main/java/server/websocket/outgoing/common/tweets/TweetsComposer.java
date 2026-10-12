package server.websocket.outgoing.common.tweets;

import com.google.gson.JsonPrimitive;
import server.data.classes.tweet.Tweet;
import server.utils.JsonFactory;
import server.websocket.outgoing.OutgoingWebMessage;

import java.util.List;

public class TweetsComposer extends OutgoingWebMessage {
    public TweetsComposer(List<Tweet> tweets) {
        super("tweets");
        this.data.add("", new JsonPrimitive(JsonFactory.getInstance().toJson(tweets)));
    }
}
