package server.websocket.incoming.common.account;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.Habbo;
import server.Main;
import server.data.classes.account.Account;
import server.data.queries.AccountDao;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.misc.DataComposer;

public class ChangeSettingsEvent extends IncomingWebMessage<ChangeSettingsEvent.JSONChangeSettingsEvent> {
    public ChangeSettingsEvent(){
        super(JSONChangeSettingsEvent.class);
    }

    @Override
    public void handle(WebSocketClient client, JSONChangeSettingsEvent message) throws InterruptedException {
        if (client.getAccount() != null){

            Account account = client.getAccount();

            try{
                if (account.getEmail().equalsIgnoreCase(message.email) || !AccountDao.getEmailExists(message.email)){
                    Habbo habboOnline = Emulator.getGameEnvironment().getHabboManager().getHabbo(account.getId());
                    if (habboOnline != null){
                        habboOnline.getHabboInfo().setMail(message.email);
                        habboOnline.getHabboInfo().setMotto(message.motto);

                        habboOnline.getHabboStats().blockFollowing = message.follow.equals("1");
                        habboOnline.getHabboStats().blockFriendRequests = message.friends.equals("1");
                        habboOnline.getHabboStats().blockRoomInvites = message.rooms.equals("1");
                        habboOnline.getHabboStats().setAllowTrade(message.trades.equals("1"));
                        habboOnline.getHabboStats().blockStaffAlerts = message.alerts.equals("1");
                    }


                    account.motto = message.motto;
                    account.email = message.email;
                    account.getSettings().setBlockFollowing(message.follow.equals("1"));
                    account.getSettings().setBlockFriendRequests(message.friends.equals("1"));
                    account.getSettings().setBlockRoomInvites(message.rooms.equals("1"));
                    account.getSettings().setAllowTrade(message.trades.equals("1"));
                    account.getSettings().setBlockAlerts(message.alerts.equals("1"));

                    AccountDao.updateAccountSettings(account);
                    AccountDao.updateEmailandMotto(account);
                    client.sendMessage(new DataComposer("SettingResponse", "Cuenta actualizada con exito"));
                }
                else client.sendMessage(new DataComposer("SettingResponse", "Este correo ya existe"));
            } catch (Exception e) {
                Main.getLogger().error(e.getMessage());
                client.sendMessage(new DataComposer("SettingResponse", "Algo salio mal"));
            }
        }


    }

    static class JSONChangeSettingsEvent{
        public String email;
        public String motto;
        public String follow;
        public String friends;
        public String rooms;
        public String trades;
        public String alerts;
    }
}
