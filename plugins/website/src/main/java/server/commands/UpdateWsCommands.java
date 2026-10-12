package server.commands;

import com.eu.habbo.habbohotel.commands.Command;
import com.eu.habbo.habbohotel.gameclients.GameClient;
import server.Main;

import java.util.ArrayList;

public class UpdateWsCommands extends Command {
    public UpdateWsCommands(String permission, String[] keys) {
        super(permission, keys);
    }

    @Override
    public boolean handle(GameClient gameClient, String[] params) throws Exception {
        if (params.length < 2) {
            gameClient.getHabbo().whisper("Debes colocar el Type");
            return true;
        }

        String type = params[1];

        switch (type.toUpperCase()){
            case "COMMUNITY":
                Main.website.getCommunityManager().loadCommunity();
                return true;
            case "ROOMTOPS":
                Main.website.getCommunityManager().loadTopsRooms();
                return true;
            case "PHOTOS":
                Main.website.getCommunityManager().loadPhotos();
                return true;
            case "CURRENCYTOPS":
                Main.website.getCommunityManager().loadTopsCurrency();
                return true;
            case "STAFF":
                Main.website.getCommunityManager().loadStaffs();
                return true;
            case "TWEETS":
                Main.website.getTweetManager().load();
                return true;
            case "ARTICLE":
                Main.website.getArticleManager().reload();
                return true;
            case "IP":
                Main.bannedIps = new ArrayList<>();
                return true;
            default:
                gameClient.getHabbo().whisper("Type invalido!");
                return true;
        }
    }
}
