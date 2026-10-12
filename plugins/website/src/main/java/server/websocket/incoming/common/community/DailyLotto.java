package server.websocket.incoming.common.community;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.Habbo;
import com.google.gson.*;
import java.sql.*;
import java.time.*;
import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.*;

/** Free daily draw. Database mutex serializes entries, settlements and prize claims. */
public final class DailyLotto {
 private static final ZoneId ZONE=ZoneId.of("Europe/Berlin");
 private static final SecureRandom RANDOM=new SecureRandom();
 private static ScheduledExecutorService timer;
 public static synchronized void start(){HourlyLotto.start();}
 public static synchronized void stop(){HourlyLotto.stop();}
 private static void lock(Connection db)throws SQLException{try(PreparedStatement q=db.prepareStatement("SELECT id FROM website_lotto_lock WHERE id=1 FOR UPDATE");ResultSet r=q.executeQuery()){if(!r.next())throw new SQLException("Missing lottery migration");}}
 public static JsonObject state(int user,boolean enter)throws SQLException{
  try(Connection db=Emulator.getDatabase().getDataSource().getConnection()){return state(db,user,enter,Instant.now().getEpochSecond());}
 }
 static JsonObject state(Connection db,int user,boolean enter,long now)throws SQLException{
   db.setAutoCommit(false);
   try{
    lock(db);LocalDate day=Instant.ofEpochSecond(now).atZone(ZONE).toLocalDate();String key=day.toString();long closes=day.plusDays(1).atStartOfDay(ZONE).toEpochSecond();
    try(PreparedStatement q=db.prepareStatement("INSERT IGNORE INTO website_lotto_rounds(day_key,draw_at) VALUES (?,?)")){q.setString(1,key);q.setLong(2,closes);q.executeUpdate();}
    List<String> due=new ArrayList<>();try(PreparedStatement q=db.prepareStatement("SELECT day_key FROM website_lotto_rounds WHERE settled=0 AND draw_at<=? ORDER BY draw_at")){q.setLong(1,now);try(ResultSet r=q.executeQuery()){while(r.next())due.add(r.getString(1));}}
    for(String old:due){List<Integer> ids=new ArrayList<>();try(PreparedStatement q=db.prepareStatement("SELECT user_id FROM website_lotto_entries WHERE day_key=? ORDER BY user_id")){q.setString(1,old);try(ResultSet r=q.executeQuery()){while(r.next())ids.add(r.getInt(1));}}try(PreparedStatement q=db.prepareStatement("UPDATE website_lotto_rounds SET settled=1,winner_id=? WHERE day_key=? AND settled=0")){if(ids.isEmpty())q.setNull(1,Types.INTEGER);else q.setInt(1,ids.get(RANDOM.nextInt(ids.size())));q.setString(2,old);q.executeUpdate();}}
    if(enter){if(user<=0)throw new SQLException("Authentication required");try(PreparedStatement q=db.prepareStatement("INSERT IGNORE INTO website_lotto_entries(day_key,user_id,created_at) VALUES (?,?,?)")){q.setString(1,key);q.setInt(2,user);q.setLong(3,now);q.executeUpdate();}}
    JsonObject out=new JsonObject();out.addProperty("day",key);out.addProperty("drawAt",closes);out.addProperty("serverTime",now);out.addProperty("prize",1000);out.addProperty("entered",false);
    try(PreparedStatement q=db.prepareStatement("SELECT COUNT(*) total,COALESCE(SUM(user_id=?),0) own FROM website_lotto_entries WHERE day_key=?")){q.setInt(1,user);q.setString(2,key);try(ResultSet r=q.executeQuery()){r.next();out.addProperty("entries",r.getInt(1));out.addProperty("entered",r.getInt(2)>0);}}
    try(PreparedStatement q=db.prepareStatement("SELECT COALESCE(SUM(prize),0) FROM website_lotto_rounds WHERE winner_id=? AND paid_at IS NULL AND settled=1")){q.setInt(1,user);try(ResultSet r=q.executeQuery()){r.next();out.addProperty("pendingCredits",r.getInt(1));}}
    JsonArray winners=new JsonArray();try(PreparedStatement q=db.prepareStatement("SELECT r.day_key,r.prize,u.username,u.look FROM website_lotto_rounds r JOIN users u ON u.id=r.winner_id WHERE r.settled=1 ORDER BY r.draw_at DESC LIMIT 3");ResultSet r=q.executeQuery()){while(r.next()){JsonObject w=new JsonObject();w.addProperty("day",r.getString(1));w.addProperty("prize",r.getInt(2));w.addProperty("username",r.getString(3));w.addProperty("look",r.getString(4));winners.add(w);}}out.add("winners",winners);db.commit();return out;
   }catch(Exception e){db.rollback();if(e instanceof SQLException)throw (SQLException)e;throw new SQLException(e);}finally{db.setAutoCommit(true);}
 }
 /** Login hook runs before gameplay. Prize ledger and persistent balance commit together. */
 public static void payAtLogin(Habbo habbo)throws SQLException{
  synchronized(habbo.getHabboInfo()){
   try(Connection db=Emulator.getDatabase().getDataSource().getConnection()){
    int balance=pay(db,habbo.getHabboInfo().getId(),habbo.getHabboInfo().getCredits());
    habbo.getHabboInfo().setCredits(balance);
   }
  }
 }
 static int pay(Connection db,int id,int credits)throws SQLException{
  db.setAutoCommit(false);try{lock(db);long amount=0;
   try(PreparedStatement q=db.prepareStatement("SELECT prize FROM website_lotto_rounds WHERE winner_id=? AND paid_at IS NULL AND settled=1 FOR UPDATE")){q.setInt(1,id);try(ResultSet r=q.executeQuery()){while(r.next())amount+=r.getInt(1);}}
   if(amount==0){db.commit();return credits;}
   int balance=Math.toIntExact((long)credits+amount);
   try(PreparedStatement q=db.prepareStatement("UPDATE users SET credits=? WHERE id=?")){q.setInt(1,balance);q.setInt(2,id);if(q.executeUpdate()!=1)throw new SQLException("Missing winner account");}
   try(PreparedStatement q=db.prepareStatement("UPDATE website_lotto_rounds SET paid_at=? WHERE winner_id=? AND paid_at IS NULL AND settled=1")){q.setLong(1,Instant.now().getEpochSecond());q.setInt(2,id);q.executeUpdate();}
   db.commit();return balance;
  }catch(Exception e){db.rollback();if(e instanceof SQLException)throw (SQLException)e;throw new SQLException(e);}finally{db.setAutoCommit(true);}
 }
}
