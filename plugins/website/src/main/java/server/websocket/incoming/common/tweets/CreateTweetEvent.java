package server.websocket.incoming.common.tweets;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.modtool.WordFilter;
import server.Main;
import server.data.classes.cooldown.CooldownManager;
import server.data.classes.cooldown.CooldownType;
import server.utils.JsonFactory;
import server.websocket.WebSocketManager;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.misc.DataComposer;

public class CreateTweetEvent extends IncomingWebMessage<CreateTweetEvent.JSONCreateTweetEvent> {
    public CreateTweetEvent(){
        super(JSONCreateTweetEvent.class);
    }
    @Override
    public void handle(WebSocketClient client, JSONCreateTweetEvent message) throws InterruptedException {
        if (client.getAccount() != null){
            CooldownManager cm = Main.website.getCooldownManager();
            if (cm.isOnCooldown(client, CooldownType.ANTISPAM)) {
                client.sendMessage(new DataComposer("createTweetResponse", "cooldown"));
            } else {
                String tweetText = message.tweetText.replace("\n", "");

                if (tweetText.length() > 5){
                    WordFilter word = Emulator.getGameEnvironment().getWordFilter();
                    String messageFilter = word.filter(tweetText, null);

                    if (tweetText.equals(messageFilter)){
                        Main.website.tweetManager.createTweet(client.getAccount(), tweetText);
                        cm.setCooldown(client, CooldownType.ANTISPAM, 15);
                        client.sendMessage(new DataComposer("createTweetResponse", "Success"));

                        //Send all client
                        WebSocketManager.getInstance().getClientManager().sendWSForAll(new DataComposer("tweets", JsonFactory.getInstance().toJson(Main.website.tweetManager.getTweets())));
                    }
                    else client.sendMessage(new DataComposer("createTweetResponse", "No intentes hacer publicidad!"));
                }
                else client.sendMessage(new DataComposer("createTweetResponse", "Tweet no valido"));
            }
        }
    }

    static class JSONCreateTweetEvent{
        String tweetText;
    }
}
