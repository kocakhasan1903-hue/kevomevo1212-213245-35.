package com.eu.habbo.habbohotel.events;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.economy.EconomyLedger;
import com.eu.habbo.habbohotel.items.interactions.wired.extra.WiredWebApiOwnership;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.habbohotel.users.HabboItem;
import com.eu.habbo.habbohotel.users.LedgerWalletMutation;
import com.eu.habbo.habbohotel.rooms.RoomChatMessageBubbles;
import com.eu.habbo.messages.outgoing.inventory.AddHabboItemComposer;
import com.eu.habbo.messages.outgoing.inventory.InventoryRefreshComposer;
import com.eu.habbo.messages.outgoing.users.UserCreditsComposer;
import com.eu.habbo.messages.outgoing.users.UserCurrencyComposer;
import java.sql.*;
import java.util.*;

/** Uses the same wallet locks, item factory and native alert composers as ordinary Polaris features. */
public final class PolarisEventRuntime implements HabbixEventManager.Runtime {
    private Habbo online(int id) { return Emulator.getGameEnvironment().getHabboManager().getHabbo(id); }
    @Override public int room(int user) { Habbo h=online(user);return h==null||h.getHabboInfo().getCurrentRoom()==null?0:h.getHabboInfo().getCurrentRoom().getId(); }
    @Override public boolean canTalk(int user) { Habbo h=online(user);return h!=null&&h.getClient()!=null&&h.getClient().getChannel()!=null&&h.getClient().getChannel().isActive()&&h.getHabboStats().allowTalk(); }
    @Override public int minimumRank() { return Emulator.getConfig().getInt("event.manager.min.rank",6); }
    @Override public boolean rewardAllowed(int base) {
        var item=Emulator.getGameEnvironment().getItemManager().getItem(base);
        return item!=null&&!WiredWebApiOwnership.isWebApiItem(item);
    }
    @Override public int createItem(Connection db,int user,int base) throws Exception {
        String extra="";
        try(PreparedStatement p=db.prepareStatement("SELECT extradata FROM catalog_items WHERE item_ids=? AND limited_stack=0 ORDER BY id LIMIT 1")){p.setString(1,String.valueOf(base));try(ResultSet r=p.executeQuery()){if(r.next())extra=r.getString(1);}}
        HabboItem item=Emulator.getGameEnvironment().getItemManager().createItem(db,user,Emulator.getGameEnvironment().getItemManager().getItem(base),0,0,extra==null?"":extra);
        return item==null?0:item.getId();
    }
    @Override public <T> T coordinated(List<Integer> users,HabbixEventManager.Work<T> work)throws Exception{return locks(users,0,work);}
    private <T> T locks(List<Integer> users,int offset,HabbixEventManager.Work<T> work)throws Exception{
        if(offset>=users.size())return work.run();Habbo h=online(users.get(offset));
        if(h==null)return locks(users,offset+1,work);
        return LedgerWalletMutation.coordinated(h,()->locks(users,offset+1,work));
    }
    @Override public void refresh(List<Integer> users,Map<Integer,List<Integer>> rewards)throws Exception{
        try(Connection db=Emulator.getDatabase().getDataSource().getConnection()){
            for(int user:users){Habbo h=online(user);if(h==null||h.getClient()==null)continue;
                try(PreparedStatement p=db.prepareStatement("SELECT credits FROM users WHERE id=?")){p.setInt(1,user);try(ResultSet r=p.executeQuery()){if(r.next())LedgerWalletMutation.applyCommitted(h,EconomyLedger.CREDITS,r.getInt(1));}}
                for(int type:new int[]{5,104,105})try(PreparedStatement p=db.prepareStatement("SELECT amount FROM users_currency WHERE user_id=? AND type=?")){p.setInt(1,user);p.setInt(2,type);try(ResultSet r=p.executeQuery()){LedgerWalletMutation.applyCommitted(h,type,r.next()?r.getInt(1):0);}}
                h.getClient().sendResponse(new UserCreditsComposer(h));h.getClient().sendResponse(new UserCurrencyComposer(h));
                for(int id:rewards.getOrDefault(user,List.of())){
                    HabboItem item=Emulator.getGameEnvironment().getItemManager().loadHabboItem(id);
                    if(item!=null){h.getInventory().getItemsComponent().addItem(item);h.getClient().sendResponse(new AddHabboItemComposer(item));}
                }
                if(!rewards.getOrDefault(user,List.of()).isEmpty())h.getClient().sendResponse(new InventoryRefreshComposer());
            }
        }
    }
    @Override public boolean announceEvent(int user,int room,String text,String kind){return announce(user,room,text);}
    @Override public boolean announce(int user,int room,String text){
        if(!Emulator.isReady)return false;
        if(user>0){
            Habbo winner=online(user);
            if(winner==null||winner.getClient()==null||winner.getClient().getChannel()==null||!winner.getClient().getChannel().isActive()||winner.getHabboInfo().getCurrentRoom()==null)return false;
            winner.whisper(text,RoomChatMessageBubbles.ALERT);return true;
        }
        for(Habbo h:Emulator.getGameEnvironment().getHabboManager().getOnlineHabbos().values()){
            if(h.getClient()==null||h.getClient().getChannel()==null||!h.getClient().getChannel().isActive()||h.getHabboInfo().getCurrentRoom()==null)continue;
            if(room>0&&h.getHabboInfo().getCurrentRoom().getId()!=room)continue;
            h.whisper(text,RoomChatMessageBubbles.ALERT);
        }return true;
    }
}
