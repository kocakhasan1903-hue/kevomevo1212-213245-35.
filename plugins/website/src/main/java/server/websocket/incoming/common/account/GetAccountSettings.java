package server.websocket.incoming.common.account;

import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.account.AccountSettingsComposer;

public class GetAccountSettings extends IncomingWebMessage<Object> {
    public GetAccountSettings(){
        super(Object.class);
    }
    @Override
    public void handle(WebSocketClient client, Object message) throws InterruptedException {
        if (client.getAccount() != null){
            client.sendMessage(new AccountSettingsComposer(client.getAccount()));
        }
    }
}
