package com.eu.habbo.habbohotel.rooms;
import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.habbohotel.users.ChatStyleRepository;
import com.eu.habbo.habbohotel.users.LedgerWalletMutation;
import com.eu.habbo.habbohotel.economy.*;
import com.eu.habbo.messages.outgoing.users.*;
import java.sql.*;
import java.util.*;
/** CMS bubble policies are enforced by the server, even for a modified client. */
public final class CmsBubblePolicy {
 private record Policy(int rank,boolean hc,boolean ambassador,boolean system,boolean enabled,int price){}
 private static volatile Map<Integer,Policy> policies=Map.of();private static volatile long refreshed=0;
 private static synchronized void refresh(){if(System.currentTimeMillis()-refreshed<5000)return;Map<Integer,Policy> next=new HashMap<>();
  try(Connection db=Emulator.getDatabase().getDataSource().getConnection();Statement q=db.createStatement();ResultSet r=q.executeQuery("SELECT * FROM habboje_shop.bubble_settings")){
   while(r.next())next.put(r.getInt("bubble_id"),new Policy(r.getInt("min_rank"),r.getBoolean("hc_only"),r.getBoolean("ambassador_only"),r.getBoolean("system_style"),r.getBoolean("enabled"),r.getInt("price")));
   policies=Collections.unmodifiableMap(next);refreshed=System.currentTimeMillis();
  }catch(SQLException e){refreshed=System.currentTimeMillis();Emulator.getLogging().logErrorLine("CMS bubble policy reload failed: "+e.getClass().getSimpleName());}
 }
 private static boolean eligible(Habbo h,Policy p){return p.enabled&&h.getHabboInfo().getRank().getId()>=p.rank&&(!p.hc||h.getHabboStats().hasActiveClub())&&(!p.ambassador||h.hasPermission("acc_ambassador"))&&(!p.system||h.hasPermission("acc_anychatcolor"));}
 public static boolean canUse(Habbo h,int id){if(h==null)return true;refresh();Policy p=policies.get(id);return p==null||(eligible(h,p)&&(p.price==0||ChatStyleRepository.owns(h.getHabboInfo().getId(),id)));}
 public static void buy(Habbo h,int id)throws Exception{
  LedgerWalletMutation.coordinated(h,()->{int uid=h.getHabboInfo().getId();try(Connection db=Emulator.getDatabase().getDataSource().getConnection()){
   db.setAutoCommit(false);try{
    // One wallet lock serializes purchases of this and other paid styles.
    try(PreparedStatement lock=db.prepareStatement("SELECT id FROM users WHERE id=? FOR UPDATE")){lock.setInt(1,uid);lock.executeQuery().close();}
    Policy policy;try(PreparedStatement q=db.prepareStatement("SELECT * FROM habboje_shop.bubble_settings WHERE bubble_id=? FOR UPDATE")){q.setInt(1,id);try(ResultSet r=q.executeQuery()){if(!r.next())throw new IllegalArgumentException("Diese Bubble wird nicht verkauft.");policy=new Policy(r.getInt("min_rank"),r.getBoolean("hc_only"),r.getBoolean("ambassador_only"),r.getBoolean("system_style"),r.getBoolean("enabled"),r.getInt("price"));}}
    if(!eligible(h,policy)||policy.price<=0)throw new IllegalArgumentException("Diese Bubble ist für dein Konto nicht zum Kauf verfügbar.");
    try(PreparedStatement q=db.prepareStatement("SELECT style_id FROM users_chat_styles WHERE user_id=? AND style_id=?")){q.setInt(1,uid);q.setInt(2,id);try(ResultSet r=q.executeQuery()){if(r.next())throw new IllegalArgumentException("Du besitzt diese Bubble bereits.");}}
    EconomyMutationResult result=EconomyLedger.apply(db,new EconomyOperation("cms-bubble-buy-"+UUID.randomUUID(),uid,uid,"credit_debit","chatbubble.buy",-1,-policy.price,null,""));
    try(PreparedStatement q=db.prepareStatement("INSERT INTO users_chat_styles(user_id,style_id,timestamp) VALUES(?,?,?)")){q.setInt(1,uid);q.setInt(2,id);q.setInt(3,Emulator.getIntUnixTimestamp());q.executeUpdate();}
    db.commit();LedgerWalletMutation.applyCommitted(h,-1,result.balanceAfter());h.getClient().sendResponse(new UserCreditsComposer(h));h.getClient().sendResponse(new ChatStyleNotificationComposer(true,id));h.whisper("Bubble "+id+" gekauft: "+policy.price+" Taler.");
   }catch(Exception e){db.rollback();throw e;}
  }return null;});
 }
}
