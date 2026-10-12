package server.websocket.outgoing.common.misc;

import com.eu.habbo.Emulator;
import com.google.gson.JsonPrimitive;
import server.Main;
import server.websocket.WebSocketManager;
import server.websocket.outgoing.OutgoingWebMessage;

public class PongComposer extends OutgoingWebMessage {
    public PongComposer() {
        super("pong");
        this.data.add("status", new JsonPrimitive(Emulator.getGameEnvironment().getHabboManager().getOnlineCount()));
        this.data.add("online", new JsonPrimitive(Emulator.getGameEnvironment().getHabboManager().getOnlineCount()));
    }
}
