package com.eu.habbo.habbohotel.commands;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.gameclients.GameClient;
import com.eu.habbo.habbohotel.rooms.RoomChatMessageBubbles;
import com.eu.habbo.habbohotel.users.Habbo;

/** Uses the existing staff points permission and audited wallet mutation. */
public final class PublicCurrencyCommand extends Command {
    public PublicCurrencyCommand() {
        super("cmd_points", new String[]{"eventsterne", "eventstars", "flammen", "feuer", "flames"});
    }
    @Override public boolean handle(GameClient client, String[] params) {
        String key = params[0].replaceFirst("^:", "").toLowerCase(java.util.Locale.ROOT);
        int type = key.equals("eventsterne") || key.equals("eventstars") ? 104 : 105;
        String name = type == 104 ? "Eventsterne" : "Flammen";
        if (params.length != 3) { client.getHabbo().whisper("Verwendung: :" + key + " Benutzer Anzahl", RoomChatMessageBubbles.ALERT); return true; }
        int amount;
        try { amount = Integer.parseInt(params[2]); } catch (NumberFormatException error) { amount = 0; }
        if (amount < 1 || amount > 1000000) { client.getHabbo().whisper("Anzahl: 1 bis 1.000.000.", RoomChatMessageBubbles.ALERT); return true; }
        Habbo target = Emulator.getGameServer().getGameClientManager().getHabbo(params[1]);
        if (target == null) { client.getHabbo().whisper("Dieser Benutzer ist nicht online.", RoomChatMessageBubbles.ALERT); return true; }
        int before = target.getHabboInfo().getCurrencyAmount(type);
        if ((long) before + amount > Integer.MAX_VALUE) { client.getHabbo().whisper("Dieses Guthaben würde das Maximum überschreiten.", RoomChatMessageBubbles.ALERT); return true; }
        target.givePoints(type, amount, "staff.public_currency", "staff-currency:" + java.util.UUID.randomUUID(), client.getHabbo().getHabboInfo().getId());
        if (target.getHabboInfo().getCurrencyAmount(type) != before + amount) { client.getHabbo().whisper("Die Vergabe wurde nicht bestätigt. Bitte das Guthaben prüfen.", RoomChatMessageBubbles.ALERT); return true; }
        target.whisper("Du hast " + amount + " " + name + " erhalten.", RoomChatMessageBubbles.ALERT);
        client.getHabbo().whisper(amount + " " + name + " an " + target.getHabboInfo().getUsername() + " vergeben.", RoomChatMessageBubbles.ALERT);
        return true;
    }
}
