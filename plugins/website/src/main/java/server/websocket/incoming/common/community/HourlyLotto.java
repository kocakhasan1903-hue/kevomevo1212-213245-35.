package server.websocket.incoming.common.community;
import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.habbohotel.users.LedgerWalletMutation;
import com.eu.habbo.habbohotel.economy.*;
import com.eu.habbo.habbohotel.commands.*;
import com.eu.habbo.habbohotel.gameclients.GameClient;
import com.eu.habbo.messages.outgoing.users.UserCreditsComposer;
import com.eu.habbo.messages.outgoing.generic.alerts.StaffAlertWithLinkComposer;
import com.google.gson.*;
import java.sql.*;
import java.time.*;
import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.*;

/** One ticket per account/hour. Fees, pot and payout ledger are transactional. */
public final class HourlyLotto {
 static final int FEE=2000;
 private static final SecureRandom RANDOM=new SecureRandom();
 private static ScheduledExecutorService timer;
 private static long announced=-1;
 private static long resultAnnounced=-1;
 static long hour(long now){return Math.floorDiv(now,3600)*3600;}
 static void lock(Connection c)throws SQLException{try(Statement s=c.createStatement();ResultSet r=s.executeQuery("SELECT id FROM website_hourly_lotto_pot WHERE id=1 FOR UPDATE")){if(!r.next())throw new SQLException("Hourly lotto migration missing");}}
 static void update(Connection c,String sql,Object...args)throws SQLException{try(PreparedStatement s=c.prepareStatement(sql)){for(int i=0;i<args.length;i++)s.setObject(i+1,args[i]);s.executeUpdate();}}
 static long pot(Connection c)throws SQLException{try(Statement s=c.createStatement();ResultSet r=s.executeQuery("SELECT amount FROM website_hourly_lotto_pot WHERE id=1")){r.next();return r.getLong(1);}}
 static long diamonds(Connection c)throws SQLException{try(Statement s=c.createStatement();ResultSet r=s.executeQuery("SELECT diamonds FROM website_hourly_lotto_bonus WHERE id=1")){r.next();return r.getLong(1);}}
 static void advanceDay(Connection c,long timestamp)throws SQLException{
  long today=Instant.ofEpochSecond(timestamp).atZone(ZoneId.of("Europe/Berlin")).toLocalDate().toEpochDay();
  try(Statement s=c.createStatement();ResultSet r=s.executeQuery("SELECT day_number,won_today FROM website_hourly_lotto_bonus WHERE id=1 FOR UPDATE")){
   r.next();long day=r.getLong(1);boolean missing=r.wasNull();boolean won=r.getBoolean(2);
   if(missing)update(c,"UPDATE website_hourly_lotto_bonus SET day_number=? WHERE id=1",today);
   else if(today>day){long extra=Math.multiplyExact(today-day-(won?1:0),2);update(c,"UPDATE website_hourly_lotto_bonus SET diamonds=diamonds+?,day_number=?,won_today=0 WHERE id=1",extra,today);}
  }
 }
 static int payDiamonds(Connection c,int uid,long now)throws SQLException{
  lock(c);int balance=-1;
  try(PreparedStatement q=c.prepareStatement("SELECT round_id,prize FROM website_hourly_lotto_diamond_winners WHERE user_id=? AND paid_at IS NULL ORDER BY round_id FOR UPDATE")){q.setInt(1,uid);try(ResultSet r=q.executeQuery()){while(r.next())balance=EconomyLedger.apply(c,new EconomyOperation("hourly-lotto-diamonds-"+r.getLong(1)+"-"+uid,uid,null,"currency_grant","lotto.win",5,Math.toIntExact(r.getLong(2)),null,"")).balanceAfter();}}
  update(c,"UPDATE website_hourly_lotto_diamond_winners SET paid_at=? WHERE user_id=? AND paid_at IS NULL",now,uid);return balance;
 }
 static void settle(Connection c,long now,java.util.function.IntSupplier number)throws SQLException{
  List<Long> due=new ArrayList<>();try(PreparedStatement s=c.prepareStatement("SELECT round_id FROM website_hourly_lotto_rounds WHERE settled=0 AND draw_at<=? ORDER BY round_id")){s.setLong(1,now);try(ResultSet r=s.executeQuery()){while(r.next())due.add(r.getLong(1));}}
  for(long id:due){advanceDay(c,id+3600);int drawn=number.getAsInt();if(drawn<0||drawn>100)throw new SQLException("Invalid draw");
   List<Integer> winners=new ArrayList<>();try(PreparedStatement s=c.prepareStatement("SELECT user_id FROM website_hourly_lotto_entries WHERE round_id=? AND chosen_number=? ORDER BY user_id")){s.setLong(1,id);s.setInt(2,drawn);try(ResultSet r=s.executeQuery()){while(r.next())winners.add(r.getInt(1));}}
   long jackpot=pot(c),distributed=0,bonus=diamonds(c);
   if(!winners.isEmpty()&&(jackpot>0||bonus>0)){long share=jackpot/winners.size(),remainder=jackpot%winners.size();
    for(int i=0;i<winners.size();i++){long amount=share+(i<remainder?1:0);Math.toIntExact(amount);update(c,"INSERT INTO website_hourly_lotto_winners(round_id,user_id,prize,created_at) VALUES(?,?,?,?)",id,winners.get(i),amount,now);distributed+=amount;
     long gems=bonus/winners.size()+(i<bonus%winners.size()?1:0);if(gems>0)update(c,"INSERT INTO website_hourly_lotto_diamond_winners(round_id,user_id,prize) VALUES(?,?,?)",id,winners.get(i),gems);}
    update(c,"UPDATE website_hourly_lotto_bonus SET diamonds=0,won_today=1 WHERE id=1");
    update(c,"UPDATE website_hourly_lotto_pot SET amount=amount-? WHERE id=1",distributed);
   }
   update(c,"UPDATE website_hourly_lotto_rounds SET settled=1,winning_number=?,jackpot=?,winners=? WHERE round_id=?",drawn,jackpot,winners.size(),id);
  }
  advanceDay(c,now);
  update(c,"INSERT IGNORE INTO website_hourly_lotto_rounds(round_id,draw_at) VALUES(?,?)",hour(now),hour(now)+3600);
 }
 static int enter(Connection c,int uid,int number,long now)throws SQLException{
  if(number<0||number>100)throw new IllegalArgumentException("Wähle eine ganze Zahl von 0 bis 100: :lotto 42");
  lock(c);settle(c,now,()->RANDOM.nextInt(101));long id=hour(now);
  try(PreparedStatement s=c.prepareStatement("SELECT chosen_number FROM website_hourly_lotto_entries WHERE round_id=? AND user_id=?")){s.setLong(1,id);s.setInt(2,uid);try(ResultSet r=s.executeQuery()){if(r.next())throw new IllegalArgumentException("Du nimmst bereits mit der Zahl "+r.getInt(1)+" teil. Es wird nichts erneut abgezogen.");}}
  EconomyMutationResult result=EconomyLedger.apply(c,new EconomyOperation("hourly-lotto-entry-"+id+"-"+uid,uid,uid,"credit_debit","lotto.entry",-1,-FEE,null,""));
  update(c,"INSERT INTO website_hourly_lotto_entries(round_id,user_id,chosen_number,created_at) VALUES(?,?,?,?)",id,uid,number,now);
  update(c,"UPDATE website_hourly_lotto_pot SET amount=amount+? WHERE id=1",FEE);
  return result.balanceAfter();
 }
 static void enter(Habbo h,int number)throws Exception{
  LedgerWalletMutation.coordinated(h,()->{try(Connection c=Emulator.getDatabase().getDataSource().getConnection()){c.setAutoCommit(false);try{int balance=enter(c,h.getHabboInfo().getId(),number,Instant.now().getEpochSecond());c.commit();LedgerWalletMutation.applyCommitted(h,-1,balance);h.getClient().sendResponse(new UserCreditsComposer(h));return null;}catch(Exception e){c.rollback();throw e;}}});
 }
 public static JsonObject state(int uid)throws SQLException{try(Connection c=Emulator.getDatabase().getDataSource().getConnection()){c.setAutoCommit(false);try{lock(c);long now=Instant.now().getEpochSecond();settle(c,now,()->RANDOM.nextInt(101));JsonObject o=new JsonObject();o.addProperty("prize",pot(c));o.addProperty("diamonds",diamonds(c));o.addProperty("serverTime",now);o.addProperty("drawAt",hour(now)+3600);o.addProperty("ticketPrice",FEE);
  try(PreparedStatement s=c.prepareStatement("SELECT COUNT(*) FROM website_hourly_lotto_entries WHERE round_id=?")){s.setLong(1,hour(now));try(ResultSet r=s.executeQuery()){r.next();o.addProperty("entries",r.getInt(1));}}
  try(PreparedStatement s=c.prepareStatement("SELECT chosen_number FROM website_hourly_lotto_entries WHERE round_id=? AND user_id=?")){s.setLong(1,hour(now));s.setInt(2,uid);try(ResultSet r=s.executeQuery()){if(r.next())o.addProperty("chosenNumber",r.getInt(1));}}
  if(uid>0){JsonObject metrics=new JsonObject();server.websocket.incoming.common.profile.ProfileMetrics.read(c,uid,metrics);if(metrics.has("flames"))o.add("flames",metrics.get("flames"));}
  JsonArray winners=new JsonArray();try(Statement s=c.createStatement();ResultSet r=s.executeQuery("SELECT w.round_id,w.prize,w.created_at,u.username,u.look FROM website_hourly_lotto_winners w JOIN users u ON u.id=w.user_id ORDER BY w.round_id DESC,w.user_id LIMIT 3")){while(r.next()){JsonObject w=new JsonObject();w.addProperty("day",Instant.ofEpochSecond(r.getLong(3)).atZone(ZoneId.of("Europe/Berlin")).format(java.time.format.DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm")));w.addProperty("id",r.getLong(1)+"-"+r.getString(4));w.addProperty("prize",r.getLong(2));w.addProperty("username",r.getString(4));w.addProperty("look",r.getString(5));winners.add(w);}}o.add("winners",winners);c.commit();return o;}catch(Exception e){c.rollback();throw new SQLException(e);}}}
 static int pay(Connection c,int uid,long now)throws SQLException{
  lock(c);int balance=-1;
  try(PreparedStatement q=c.prepareStatement("SELECT round_id,prize FROM website_hourly_lotto_winners WHERE user_id=? AND paid_at IS NULL ORDER BY round_id FOR UPDATE")){q.setInt(1,uid);try(ResultSet r=q.executeQuery()){while(r.next())balance=EconomyLedger.apply(c,new EconomyOperation("hourly-lotto-win-"+r.getLong(1)+"-"+uid,uid,null,"credit_grant","lotto.win",-1,Math.toIntExact(r.getLong(2)),null,"")).balanceAfter();}}
  update(c,"UPDATE website_hourly_lotto_winners SET paid_at=? WHERE user_id=? AND paid_at IS NULL",now,uid);return balance;
 }
 public static void pay(Habbo h)throws Exception{LedgerWalletMutation.coordinated(h,()->{try(Connection c=Emulator.getDatabase().getDataSource().getConnection()){c.setAutoCommit(false);try{int balance=pay(c,h.getHabboInfo().getId(),Instant.now().getEpochSecond());int gems=payDiamonds(c,h.getHabboInfo().getId(),Instant.now().getEpochSecond());c.commit();if(gems>=0){LedgerWalletMutation.applyCommitted(h,5,gems);if(h.getClient()!=null)h.getClient().sendResponse(new com.eu.habbo.messages.outgoing.users.UserCurrencyComposer(h));}if(balance>=0){LedgerWalletMutation.applyCommitted(h,-1,balance);if(h.getClient()!=null)h.getClient().sendResponse(new UserCreditsComposer(h));}return null;}catch(Exception e){c.rollback();throw e;}}});}
 static void broadcast(String text){for(Habbo h:Emulator.getGameEnvironment().getHabboManager().getOnlineHabbos().values())if(h.getClient()!=null)h.whisper(text);}
 static void tick()throws Exception{
  state(0);long now=Instant.now().getEpochSecond(),current=hour(now);
  if(resultAnnounced!=current){
   try(Connection c=Emulator.getDatabase().getDataSource().getConnection();PreparedStatement s=c.prepareStatement("SELECT winning_number,jackpot,winners FROM website_hourly_lotto_rounds WHERE round_id=? AND settled=1")){
    s.setLong(1,current-3600);try(ResultSet r=s.executeQuery()){if(r.next()){
     String result="Lotto-Ziehung: Zahl "+r.getInt(1)+". ";
     if(r.getInt(3)>0){List<String> names=new ArrayList<>();try(PreparedStatement q=c.prepareStatement("SELECT u.username,w.prize,COALESCE(d.prize,0) AS diamonds FROM website_hourly_lotto_winners w JOIN users u ON u.id=w.user_id LEFT JOIN website_hourly_lotto_diamond_winners d ON d.round_id=w.round_id AND d.user_id=w.user_id WHERE w.round_id=? ORDER BY w.user_id")){q.setLong(1,current-3600);try(ResultSet w=q.executeQuery()){while(w.next())names.add(w.getString(1)+" ("+w.getLong(2)+" Taler, "+w.getLong(3)+" Diamanten)");}}
      result+="Gewonnen: "+String.join(", ",names)+". Herzlichen Glückwunsch!";
     }else result+="Kein Gewinner. "+r.getLong(2)+" Taler bleiben im Jackpot.";
     broadcast(result);
    }}
   }
   resultAnnounced=current;
  }
  if(current+3600-now<=300&&announced!=current){
   broadcast("Lotto: In 5 Minuten wird gezogen! Wähle eine Zahl von 0 bis 100 mit :lotto 42. Teilnahme: 2.000 Taler; eine Zahl pro Stunde.");announced=current;
  }
  for(Habbo h:new ArrayList<>(Emulator.getGameEnvironment().getHabboManager().getOnlineHabbos().values()))pay(h);
 }
 public static synchronized void start(){if(timer!=null)return;HabbicoTipp.start();CommandHandler.addCommand(new LottoCommand());timer=Executors.newSingleThreadScheduledExecutor(r->{Thread t=new Thread(r,"cms-hourly-lotto");t.setDaemon(true);return t;});timer.scheduleWithFixedDelay(()->{try{tick();}catch(Exception e){server.Main.getLogger().error("Hourly lotto failed",e);}},5,10,TimeUnit.SECONDS);}
 public static synchronized void stop(){HabbicoTipp.stop();if(timer!=null){timer.shutdownNow();timer=null;}}
 public static final class LottoCommand extends Command{
  public LottoCommand(){super(null,new String[]{"lotto"});}
  @Override public boolean handle(GameClient client,String[] args){Habbo h=client.getHabbo();try{if(args.length!=2||!args[1].matches("[0-9]{1,3}"))throw new IllegalArgumentException("Verwendung: :lotto 0–100, z. B. :lotto 42. Teilnahme: 2.000 Taler.");int n=Integer.parseInt(args[1]);enter(h,n);h.whisper("Lotto: Du nimmst mit der Zahl "+n+" teil. 2.000 Taler wurden in den Jackpot gelegt.");}catch(IllegalArgumentException e){h.whisper(e.getMessage().contains("invalid balance")?"Du brauchst 2.000 Taler. Es wurde nichts abgezogen.":e.getMessage());}catch(Exception e){server.Main.getLogger().error("Lotto entry failed",e);h.whisper("Lotto konnte nicht bestätigt werden. Prüfe deinen Status, bevor du erneut teilnimmst.");}return true;}
 }
}
