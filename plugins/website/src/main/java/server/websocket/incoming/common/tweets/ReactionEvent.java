package server.websocket.incoming.common.tweets;

import server.Main;
import server.data.classes.tweet.ReactionType;
import server.data.classes.tweet.Tweet;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.misc.DataComposer;

public class ReactionEvent extends IncomingWebMessage<ReactionEvent.JSONReactionEvent> {
    public ReactionEvent(){
        super(JSONReactionEvent.class);
    }

    @Override
    public void handle(WebSocketClient client, JSONReactionEvent message) throws InterruptedException {
        if (client.getAccount() != null){
            Tweet tweet = Main.website.tweetManager.getTweet(message.tweetId, client.getAccount().getId());

            ReactionType reaction = ReactionType.valueOf(message.reaction.toUpperCase());

            if (tweet != null){
                if (tweet.addReaction(client.getAccount(), reaction)){
                    client.sendMessage(new DataComposer("reactionResponse", "Success"));
                }
                else client.sendMessage(new DataComposer("reactionResponse", "Error al reaccionar"));
            }
            else client.sendMessage(new DataComposer("reactionResponse", "Este tweet no existe"));
        }
    }

    static class JSONReactionEvent{
        int tweetId;
        String reaction;
    }
}
