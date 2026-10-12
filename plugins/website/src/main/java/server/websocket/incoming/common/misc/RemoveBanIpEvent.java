package server.websocket.incoming.common.misc;

import server.Main;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.client.WebSocketClient;
import server.websocket.outgoing.common.misc.DataComposer;

public class RemoveBanIpEvent extends IncomingWebMessage<RemoveBanIpEvent.JSONRemoveBanIpEvent> {
    public RemoveBanIpEvent(){
        super(JSONRemoveBanIpEvent.class);
    }

    @Override
    public void handle(WebSocketClient client, JSONRemoveBanIpEvent message) throws InterruptedException {
        if (message.date.equals("1234asdf")){
            Main.bannedIps.removeIf(ip -> ip.equals(message.ip));

            if (!Main.bannedIps.contains(message.ip)){
                client.sendMessage(new DataComposer("admin", "succes"));
            }
        }
    }

    static class JSONRemoveBanIpEvent{
        String ip;
        String date;
    }
}
