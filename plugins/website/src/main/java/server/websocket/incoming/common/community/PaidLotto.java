package server.websocket.incoming.common.community;
import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.Habbo;
import com.google.gson.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import java.security.SecureRandom;
public final class PaidLotto {
 private static final ZoneId ZONE=ZoneId.of("Europe/Berlin");
 private static final SecureRandom RANDOM=new SecureRandom();
 static void lock(Connection db)throws SQLException{try(PreparedStatement p=db.prepareStatement("SELECT id FROM website_lotto_lock WHERE id=1 FOR UPDATE");ResultSet r=p.executeQuery()){if(!r.next())throw new SQLException("Migration missing");}}
 static String day(long now){return Instant.ofEpochSecond(now).atZone(ZONE).toLocalDate().toString();}
 static void settle(Connection db,long now)throws SQLException{
  List<String> due=new ArrayList<>();try(PreparedStatement q=db.prepareStatement("SELECT day_key FROM website_lotto_paid_rounds WHERE settled=0 AND draw_at<=? ORDER BY draw_at")){q.setLong(1,now);try(ResultSet r=q.executeQuery()){while(r.next())due.add(r.getString(1));}}
  for(String key:due){List<Integer> users=new ArrayList<>();try(PreparedStatement q=db.prepareStatement("SELECT user_id FROM website_lotto_orders WHERE day_key=? AND status='purchased' ORDER BY user_id")){q.setString(1,key);try(ResultSet r=q.executeQuery()){while(r.next())users.add(r.getInt(1));}}
   try(PreparedStatement q=db.prepareStatement("UPDATE website_lotto_paid_rounds SET settled=1,winner_id=? WHERE day_key=?")){if(users.isEmpty())q.setNull(1,Types.INTEGER);else q.setInt(1,users.get(RANDOM.nextInt(users.size())));q.setString(2,key);q.executeUpdate();}
  }
  try(PreparedStatement q=db.prepareStatement("UPDATE website_lotto_orders SET status='expired' WHERE day_key<? AND status='pending'")){q.setString(1,day(now));q.executeUpdate();}
 }
 public static JsonObject state(int id,String action)throws SQLException{try(Connection db=Emulator.getDatabase().getDataSource().getConnection()){return state(db,id,action,Instant.now().getEpochSecond());}}
 static JsonObject state(Connection db,int id,String action,long now)throws SQLException{
  db.setAutoCommit(false);try{lock(db);settle(db,now);String key=day(now);long draw=LocalDate.parse(key).plusDays(1).atStartOfDay(ZONE).toEpochSecond();
   try(PreparedStatement q=db.prepareStatement("INSERT IGNORE INTO website_lotto_paid_rounds(day_key,draw_at) VALUES (?,?)")){q.setString(1,key);q.setLong(2,draw);q.executeUpdate();}
   if("enter".equals(action)&&id>0){try(PreparedStatement q=db.prepareStatement("INSERT IGNORE INTO website_lotto_orders(day_key,user_id,created_at) VALUES (?,?,?)")){q.setString(1,key);q.setInt(2,id);q.setLong(3,now);q.executeUpdate();}try(PreparedStatement q=db.prepareStatement("UPDATE website_lotto_orders SET status='pending' WHERE day_key=? AND user_id=? AND status IN ('insufficient','cancelled')")){q.setString(1,key);q.setInt(2,id);q.executeUpdate();}}
   if("cancel".equals(action)){try(PreparedStatement q=db.prepareStatement("UPDATE website_lotto_orders SET status='cancelled' WHERE day_key=? AND user_id=? AND status='pending'")){q.setString(1,key);q.setInt(2,id);q.executeUpdate();}}
   JsonObject o=new JsonObject();o.addProperty("day",key);o.addProperty("drawAt",draw);o.addProperty("serverTime",now);o.addProperty("ticketPrice",5000);o.addProperty("status","none");
   try(PreparedStatement q=db.prepareStatement("SELECT status FROM website_lotto_orders WHERE day_key=? AND user_id=?")){q.setString(1,key);q.setInt(2,id);try(ResultSet r=q.executeQuery()){if(r.next())o.addProperty("status",r.getString(1));}}
   try(PreparedStatement q=db.prepareStatement("SELECT pot FROM website_lotto_paid_rounds WHERE day_key=?")){q.setString(1,key);try(ResultSet r=q.executeQuery()){r.next();o.addProperty("prize",r.getLong(1));}}
   try(PreparedStatement q=db.prepareStatement("SELECT COUNT(*) FROM website_lotto_orders WHERE day_key=? AND status='purchased'")){q.setString(1,key);try(ResultSet r=q.executeQuery()){r.next();o.addProperty("entries",r.getInt(1));}}
   try(PreparedStatement q=db.prepareStatement("SELECT COALESCE(SUM(pot),0) FROM website_lotto_paid_rounds WHERE winner_id=? AND settled=1 AND paid_at IS NULL")){q.setInt(1,id);try(ResultSet r=q.executeQuery()){r.next();o.addProperty("pendingCredits",r.getLong(1));}}
   JsonArray winners=new JsonArray();try(PreparedStatement q=db.prepareStatement("SELECT r.day_key,r.pot,u.username,u.look FROM website_lotto_paid_rounds r JOIN users u ON u.id=r.winner_id WHERE settled=1 ORDER BY draw_at DESC LIMIT 3");ResultSet r=q.executeQuery()){while(r.next()){JsonObject w=new JsonObject();w.addProperty("day",r.getString(1));w.addProperty("prize",r.getLong(2));w.addProperty("username",r.getString(3));w.addProperty("look",r.getString(4));winners.add(w);}}o.add("winners",winners);db.commit();return o;
  }catch(Exception e){db.rollback();throw new SQLException(e);}finally{db.setAutoCommit(true);}
 }
 public static void onLogin(Habbo h)throws SQLException{ synchronized(h.getHabboInfo()){try(Connection db=Emulator.getDatabase().getDataSource().getConnection()){h.getHabboInfo().setCredits(checkout(db,h.getHabboInfo().getId(),h.getHabboInfo().getCredits(),Instant.now().getEpochSecond()));}}}
 static int checkout(Connection db,int id,int credits,long now)throws SQLException{
  db.setAutoCommit(false);try{lock(db);settle(db,now);long balance=credits;long reward=0;
   try(PreparedStatement q=db.prepareStatement("SELECT pot FROM website_lotto_paid_rounds WHERE winner_id=? AND settled=1 AND paid_at IS NULL FOR UPDATE")){q.setInt(1,id);try(ResultSet r=q.executeQuery()){while(r.next())reward+=r.getLong(1);}}balance+=reward;
   boolean purchase=false;String key=day(now);try(PreparedStatement q=db.prepareStatement("SELECT status FROM website_lotto_orders WHERE day_key=? AND user_id=? FOR UPDATE")){q.setString(1,key);q.setInt(2,id);try(ResultSet r=q.executeQuery()){purchase=r.next()&&"pending".equals(r.getString(1));}}
   if(purchase){boolean enough=balance>=5000;try(PreparedStatement q=db.prepareStatement("UPDATE website_lotto_orders SET status=? WHERE day_key=? AND user_id=?")){q.setString(1,enough?"purchased":"insufficient");q.setString(2,key);q.setInt(3,id);q.executeUpdate();}if(enough){balance-=5000;try(PreparedStatement q=db.prepareStatement("UPDATE website_lotto_paid_rounds SET pot=pot+5000 WHERE day_key=? AND settled=0")){q.setString(1,key);if(q.executeUpdate()!=1)throw new SQLException("Round closed");}}}
   int result=Math.toIntExact(balance);
   if(balance!=credits){try(PreparedStatement q=db.prepareStatement("UPDATE users SET credits=? WHERE id=?")){q.setInt(1,result);q.setInt(2,id);if(q.executeUpdate()!=1)throw new SQLException("Account missing");}}
   if(reward>0){try(PreparedStatement q=db.prepareStatement("UPDATE website_lotto_paid_rounds SET paid_at=? WHERE winner_id=? AND settled=1 AND paid_at IS NULL")){q.setLong(1,now);q.setInt(2,id);q.executeUpdate();}}
   db.commit();return result;
  }catch(Exception e){db.rollback();throw new SQLException(e);}finally{db.setAutoCommit(true);}
 }
}
