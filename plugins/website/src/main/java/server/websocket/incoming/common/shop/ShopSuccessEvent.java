package server.websocket.incoming.common.shop;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.Habbo;
import server.Main;
import server.data.classes.account.Account;
import server.data.queries.AccountDao;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;

public class ShopSuccessEvent extends IncomingWebMessage<ShopSuccessEvent.JSONShopSuccessEvent> {
    public ShopSuccessEvent() {
        super(JSONShopSuccessEvent.class);
    }

    @Override
    public void handle(WebSocketClient client, JSONShopSuccessEvent message) throws InterruptedException {
        if (client.getAccount() != null){
            try{
                Account account = client.getAccount();
                Habbo habboOnline = Emulator.getGameEnvironment().getHabboManager().getHabbo(account.getId());

                switch (message.type.toUpperCase()){
                    case "VIP":
                        if (habboOnline != null) habboOnline.getHabboStats().createSubscription("HABBO_VIP", 2678400);
                        AccountDao.createSubscription("HABBO_VIP", 2678400, account);
                        break;
                    case "KUBBITOS":
                        if (habboOnline != null) habboOnline.getHabboInfo().addCurrencyAmount(104, message.amount);
                        account.addCurrencyAmount(104, message.amount);
                        break;
                    case "DIAMONDS":
                        if (habboOnline != null) habboOnline.getHabboInfo().addCurrencyAmount(5, message.amount);
                        account.addCurrencyAmount(5, message.amount);
                        break;
                }
            } catch (Exception e) {
                Main.getLogger().error(e.getMessage());
            }
        }
    }

    static class JSONShopSuccessEvent{
        String type;
        int amount;
    }
}
