package com.eu.habbo.habbohotel.commands;
import com.eu.habbo.habbohotel.events.HabbixEventManager;
import com.eu.habbo.habbohotel.gameclients.GameClient;
import com.eu.habbo.habbohotel.rooms.RoomChatMessageBubbles;

/** Participation has no staff permission; the engine verifies scope, identity and current event. */
public final class GiveawayCommand extends Command {
    public GiveawayCommand(){super(null,new String[]{"giveaway"});}
    @Override public boolean handle(GameClient client,String[] params){
        try{HabbixEventManager.getInstance().joinCurrent(client.getHabbo().getHabboInfo().getId());client.getHabbo().whisper("Du nimmst am Giveaway teil. Der Emulator lost die Gewinner automatisch aus.",RoomChatMessageBubbles.ALERT);}
        catch(Exception e){client.getHabbo().whisper(e instanceof IllegalArgumentException?e.getMessage():"Teilnahme konnte nicht gespeichert werden. Bitte später erneut versuchen.",RoomChatMessageBubbles.ALERT);}
        return true;
    }
}
