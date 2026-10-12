package server.websocket.incoming.common.community;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.messages.outgoing.users.UserPermissionsComposer;
import com.eu.habbo.messages.outgoing.users.UserPerksComposer;
import com.eu.habbo.messages.outgoing.catalog.CatalogUpdatedComposer;
import java.sql.*;
import java.util.*;
import org.slf4j.LoggerFactory;

/** Timed member packages. Conditional writes never undo an unrelated staff promotion. */
public final class PremiumMemberships {
 private static Timer timer;
 public static synchronized void start(){if(timer!=null)return;timer=new Timer("CMS premium memberships",true);timer.schedule(new TimerTask(){public void run(){try{refresh();}catch(Exception e){LoggerFactory.getLogger(PremiumMemberships.class).error("Premium membership refresh failed",e);}}},3000,10000);}
 public static synchronized void stop(){if(timer!=null)timer.cancel();timer=null;}
 public static void refresh() throws Exception {
  PluginRuntime.touch("premium", "Premium-Aktivierung und Ablaufprüfung aktiv.");
  List<Integer> ids=new ArrayList<>();long now=System.currentTimeMillis()/1000;
  try(Connection db=Emulator.getDatabase().getDataSource().getConnection();PreparedStatement q=db.prepareStatement("SELECT id FROM habboje_shop.premium_memberships WHERE status IN ('pending','cancel_pending') OR (status='active' AND expires_at<=?) ORDER BY id LIMIT 100")){
   q.setLong(1,now);try(ResultSet r=q.executeQuery()){while(r.next())ids.add(r.getInt(1));}
  }
  for(int id:ids)apply(id,now);
 }
 private static void apply(int id,long now)throws Exception{
  int user=0;
  try(Connection db=Emulator.getDatabase().getDataSource().getConnection()){
   db.setAutoCommit(false);
   try(PreparedStatement q=db.prepareStatement("SELECT * FROM habboje_shop.premium_memberships WHERE id=? FOR UPDATE")){
    q.setInt(1,id);try(ResultSet r=q.executeQuery()){
     if(!r.next()){db.rollback();return;}
     user=r.getInt("user_id");String status=r.getString("status");boolean activate=status.equals("pending");
     if(!activate&&!status.equals("cancel_pending")&&!(status.equals("active")&&r.getLong("expires_at")<=now)){db.rollback();return;}
     int target=activate?r.getInt("assigned_rank"):r.getInt("previous_rank");int expected=activate?r.getInt("expected_rank"):r.getInt("assigned_rank");
     String failure="";
     if(target<1||target>4||!Emulator.getGameEnvironment().getPermissionsManager().rankExists(target))failure="Paket-Rang fehlt oder ist kein Mitgliederrang (1–4).";
     if(activate||status.equals("cancel_pending")){
      try(PreparedStatement staff=db.prepareStatement("SELECT rank FROM users WHERE id=?")){staff.setInt(1,r.getInt("staff_id"));try(ResultSet actor=staff.executeQuery()){if(!actor.next()||actor.getInt(1)<6)failure="Mitarbeiter hat keine Premium-Berechtigung mehr.";}}
     }
     if(activate&&r.getLong("expires_at")<=now)failure="Enddatum liegt bereits in der Vergangenheit.";
     if(failure.isEmpty()){
      try(PreparedStatement change=db.prepareStatement("UPDATE users SET rank=? WHERE id=? AND rank=? AND rank<5")){change.setInt(1,target);change.setInt(2,user);change.setInt(3,expected);int changed=change.executeUpdate();
       if(changed==0){try(PreparedStatement current=db.prepareStatement("SELECT rank FROM users WHERE id=? FOR UPDATE")){current.setInt(1,user);try(ResultSet value=current.executeQuery()){if(!value.next()||value.getInt(1)!=target)failure="Rang wurde anderweitig geändert; Premium überschreibt ihn nicht.";}}}
      }
     }
     String next=failure.isEmpty()?(activate?"active":status.equals("cancel_pending")?"cancelled":"expired"):"failed";
     try(PreparedStatement done=db.prepareStatement("UPDATE habboje_shop.premium_memberships SET status=?,error=? WHERE id=?")){done.setString(1,next);done.setString(2,failure);done.setInt(3,id);done.executeUpdate();}
     db.commit();
    }
   }catch(Exception e){db.rollback();throw e;}
  }
  // Reload the committed rank rather than replaying a write through HabboManager.setRank.
  Habbo online=Emulator.getGameEnvironment().getHabboManager().getHabbo(user);
  if(online!=null&&online.getClient()!=null){
   try(Connection db=Emulator.getDatabase().getDataSource().getConnection();PreparedStatement q=db.prepareStatement("SELECT rank FROM users WHERE id=?")){
    q.setInt(1,user);try(ResultSet r=q.executeQuery()){if(r.next()){
     int rank=r.getInt(1);if(Emulator.getGameEnvironment().getPermissionsManager().rankExists(rank)){
      com.eu.habbo.habbohotel.permissions.Rank nextRank=Emulator.getGameEnvironment().getPermissionsManager().getRank(rank);
      com.eu.habbo.habbohotel.permissions.Rank oldRank=online.getHabboInfo().getRank();
      if(oldRank!=null&&oldRank.getId()!=nextRank.getId()){
       if(!oldRank.getBadge().isEmpty()&&online.getInventory().getBadgesComponent().getBadge(oldRank.getBadge())!=null)online.deleteBadge(online.getInventory().getBadgesComponent().getBadge(oldRank.getBadge()));
       if(oldRank.getRoomEffect()>0)online.getInventory().getEffectsComponent().effects.remove(oldRank.getRoomEffect());
      }
      online.getHabboInfo().setRank(nextRank);
      if(!nextRank.getBadge().isEmpty())online.addBadge(nextRank.getBadge());
      if(nextRank.getRoomEffect()>0)online.getInventory().getEffectsComponent().createRankEffect(nextRank.getRoomEffect());
      online.getClient().sendResponse(new UserPermissionsComposer(online));online.getClient().sendResponse(new UserPerksComposer(online));online.getClient().sendResponse(new CatalogUpdatedComposer());
     }
    }}
   }
  }
 }
}
