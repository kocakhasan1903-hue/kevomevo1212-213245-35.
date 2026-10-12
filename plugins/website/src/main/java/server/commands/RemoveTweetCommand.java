package server.commands;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.commands.Command;
import com.eu.habbo.habbohotel.gameclients.GameClient;
import com.eu.habbo.habbohotel.rooms.RoomChatMessageBubbles;
import com.eu.habbo.habbohotel.users.HabboInfo;
import server.Main;
import server.data.classes.tweet.Tweet;
import server.data.queries.TweetDao;

import java.util.List;

public class RemoveTweetCommand extends Command {
    public RemoveTweetCommand(String permission, String[] keys) {
        super(permission, keys);
    }

    @Override
    public boolean handle(GameClient gameClient, String[] params) throws Exception {
        if (params.length < 2) {
            gameClient.getHabbo().whisper("Debes asignar el nombre de usuario para eliminar sus Tweets");
            return true;
        }

        HabboInfo habbo = Emulator.getGameEnvironment().getHabboManager().getHabbo(params[1]).getHabboInfo() != null ? Emulator.getGameEnvironment().getHabboManager().getHabbo(params[1]).getHabboInfo() : Emulator.getGameEnvironment().getHabboManager().getOfflineHabboInfo(params[1]);

        if (habbo == null){
            gameClient.getHabbo().whisper("Este usuario no existe!", RoomChatMessageBubbles.ALERT);
            return true;
        }

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

        if (i == 0) gameClient.getHabbo().whisper("Este usuario no tiene Tweets");
        else gameClient.getHabbo().whisper("Se eliminaron (" + i + ") Tweets del usuario: " + habbo.getUsername());

        return true;
    }
}
