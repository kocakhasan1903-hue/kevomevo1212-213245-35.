package server.core;

import com.eu.habbo.habbohotel.commands.CommandHandler;
import server.Main;
import server.commands.RemoveCommentCommand;
import server.commands.RemoveTweetCommand;
import server.commands.UpdateWsCommands;

public class ReadCommands {

    public static void readCommand() {
        try {

            CommandHandler.addCommand(new RemoveTweetCommand("cmd_ws_admin", "rtweets".split(",")));
            CommandHandler.addCommand(new RemoveCommentCommand("cmd_ws_admin", "rcomment".split(",")));
            CommandHandler.addCommand(new UpdateWsCommands("cmd_ws_update", "updatews".split(",")));

        } catch (Exception ex) {
            Main.getLogger().error("Error while loading habbo commands", ex);
        }
    }
}
