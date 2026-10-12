package server.websocket.outgoing.common.account;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.HabboInfo;
import com.eu.habbo.habbohotel.users.HabboStats;
import com.eu.habbo.habbohotel.users.subscriptions.Subscription;
import com.google.gson.JsonPrimitive;
import server.data.classes.account.Account;
import server.websocket.outgoing.OutgoingWebMessage;

public class GetAccountComposer extends OutgoingWebMessage {
    public GetAccountComposer(Account account) {
        super("getAccount");

        HabboInfo habbo = Emulator.getGameEnvironment().getHabboManager().getHabboInfo(account.getId()) ;

        this.data.add("id", new JsonPrimitive(habbo != null ? habbo.getId() :  account.getId()));
        this.data.add("username", new JsonPrimitive(habbo != null ? habbo.getUsername() : account.getUsername()));
        this.data.add("motto", new JsonPrimitive(habbo != null ? habbo.getMotto() : account.getMotto()));
        this.data.add("look", new JsonPrimitive(habbo != null ? habbo.getLook() : account.getLook()));
        this.data.add("credits", new JsonPrimitive(habbo != null ? habbo.getCredits() : account.getCredits()));
        this.data.add("duckets", new JsonPrimitive(habbo != null ? habbo.getCurrencyAmount(0) : account.getCurrencyAmount(0)));
        this.data.add("diamonds", new JsonPrimitive(habbo != null ? habbo.getCurrencyAmount(5) : account.getCurrencyAmount(5)));
        this.data.add("currency", new JsonPrimitive(habbo != null ? habbo.getCurrencyAmount(104) : account.getCurrencyAmount(104)));
        this.data.add("flames", new JsonPrimitive(habbo != null ? habbo.getCurrencyAmount(105) : account.getCurrencyAmount(105)));
        this.data.add("rankId", new JsonPrimitive(String.valueOf(habbo != null ? habbo.getRank().getId() : account.getRank().getId())));
        this.data.add("rankName", new JsonPrimitive(String.valueOf(habbo != null ? habbo.getRank().getName() : account.getRank().getName())));
        this.data.add("editPrice", new JsonPrimitive(account.getEditCatalogPrice()));

        HabboStats habboStats = Emulator.getGameEnvironment().getHabboManager().getHabboInfo(account.getId()).getHabboStats();
        int date = 0;
        boolean active = false;

        for (Subscription sub : habboStats.subscriptions){
            if (sub.getSubscriptionType() == null) continue;

            if (sub.getSubscriptionType().equalsIgnoreCase("HABBO_VIP")){
                       date = sub.getTimestampEnd();
            }          active = sub.isActive();
        }

        this.data.add("vipDuration", new JsonPrimitive(date));
        this.data.add("vipStatus", new JsonPrimitive(active));
    }
}
