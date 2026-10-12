package server.websocket.incoming.common.community;
import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.*;
import com.eu.habbo.habbohotel.economy.*;
import com.eu.habbo.messages.outgoing.users.*;
import server.websocket.incoming.common.profile.ProfileEvents;
import com.google.gson.*;
import java.sql.*;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static server.websocket.incoming.common.community.TippEngine.*;

/** Optional emulator plugin adapter; no public wallet or result-setting endpoint. */
public final class HabbicoTipp {
 static ScheduledExecutorService timer;static long feedStamp=-1,lastSettlement=0;static volatile String feedMessage="Noch kein Quotenanbieter verbunden.";
 static Connection db()throws SQLException{return Emulator.getDatabase().getDataSource().getConnection();}
 static final Wallet WALLET=(c,u,currency,delta,key)->EconomyLedger.apply(c,new EconomyOperation(key,u,null,delta<0?"tipp_stake":"tipp_reward","habbico.tipp",currency,delta,null,"free-play")).balanceAfter();
 interface Tx<T>{T run(Connection c)throws Exception;}
 static <T>T transaction(Tx<T> action)throws Exception{try(Connection c=db()){c.setAutoCommit(false);try{T result=action.run(c);c.commit();return result;}catch(Exception e){c.rollback();throw e;}}}
 static Habbo online(int user){return Emulator.getGameEnvironment().getHabboManager().getHabbo(user);}
 static void sync(Habbo h,Map<Integer,Integer> balances){balances.forEach((currency,balance)->LedgerWalletMutation.applyCommitted(h,currency,balance));if(!balances.isEmpty()&&h.getClient()!=null){h.getClient().sendResponse(new UserCreditsComposer(h));h.getClient().sendResponse(new UserCurrencyComposer(h));}}
 static void payUser(Habbo h)throws Exception{LedgerWalletMutation.coordinated(h,()->{sync(h,transaction(c->pay(c,h.getHabboInfo().getId(),Instant.now().getEpochSecond(),WALLET)));return null;});}
 public static JsonObject handle(int user,String action,String text)throws Exception{
  if(text==null||text.length()>16000)throw new IllegalArgumentException("Ungültige Tipp-Anfrage.");JsonObject q=new JsonParser().parse(text).getAsJsonObject();long now=Instant.now().getEpochSecond();String notice="";
  boolean manage;try(Connection c=db()){manage=ProfileEvents.policy(c,user,"read",false);}
  if(action.equals("tippPlace")){
   Habbo h=online(user);if(h==null||h.getClient()==null)throw new IllegalArgumentException("Bitte im Hotel einchecken.");
   JsonObject entry=transaction(c->{lock(c);JsonArray prior=rows(c,"SELECT request_json FROM habbico_tipp_pending WHERE id=? AND user_id=?",str(q,"ticketId"),user);return prior.size()>0?new JsonParser().parse(str(prior.get(0).getAsJsonObject(),"request_json")).getAsJsonObject():q;});
   int balance;try{balance=LedgerWalletMutation.coordinated(h,()->{int b=transaction(c->place(c,user,entry,now,WALLET));if(b>=0)sync(h,Map.of((int)number(entry,"currency"),b));return b;});}catch(IllegalArgumentException rejected){transaction(c->{lock(c);update(c,"DELETE FROM habbico_tipp_pending WHERE id=? AND user_id=?",str(q,"ticketId"),user);return null;});throw rejected;}notice=balance<0?"Dieser Schein wurde bereits angenommen.":"Dein Tippschein wurde angenommen.";
  }else if(action.equals("tippPrepare")){
   transaction(c->{lock(c);update(c,"DELETE FROM habbico_tipp_pending WHERE created<?",now-120);if(rows(c,"SELECT id FROM habbico_tipp_pending WHERE user_id=?",user).size()>=5)throw new IllegalArgumentException("Bitte offene Live-Prüfung abwarten.");String id=str(q,"ticketId");if(!id.matches("[0-9a-fA-F-]{36}"))throw new IllegalArgumentException("Ungültige Schein-ID.");
    if(rows(c,"SELECT id FROM habbico_tipp_pending WHERE id=?",id).size()==0)update(c,"INSERT INTO habbico_tipp_pending(id,user_id,request_json,created) VALUES(?,?,?,?)",id,user,q.toString(),now);return null;});notice="Live-Tipp wird geprüft. Noch wurde nichts abgebucht.";
  }else if(action.equals("tippResult")){
   try(Connection c=db()){if(!manage||!ProfileEvents.policy(c,user,"save",true))throw new IllegalArgumentException("Keine Berechtigung für die Ergebnisverwaltung.");}
   String game=str(q,"gameId"),reason=str(q,"reason").trim();if(reason.length()<8||reason.length()>500)throw new IllegalArgumentException("Bitte Ergebnisquelle und Begründung angeben.");
   int home=(int)number(q,"homeScore"),away=(int)number(q,"awayScore");boolean cancel=q.has("void")&&q.get("void").getAsBoolean();if(home<0||away<0||home>99||away>99)throw new IllegalArgumentException("Ungültiges Ergebnis.");
   transaction(c->{lock(c);JsonArray found=rows(c,"SELECT * FROM habbico_tipp_games WHERE id=?",game);if(found.size()!=1)throw new IllegalArgumentException("Spiel fehlt.");String old=str(found.get(0).getAsJsonObject(),"status");if(old.equals("finished")||old.equals("void"))throw new IllegalArgumentException("Bereits abgerechnet; Ergebnisänderung ist gesperrt.");if(now<number(found.get(0).getAsJsonObject(),"starts")&&!cancel)throw new IllegalArgumentException("Spiel hat noch nicht begonnen.");update(c,"UPDATE habbico_tipp_games SET status=?,home_score=?,away_score=?,live_home=?,live_away=?,score_updated=? WHERE id=?",cancel?"void":"finished",home,away,home,away,now,game);audit(c,user,"result",game,home+":"+away+";void="+cancel+";"+reason,now);return null;});notice="Ergebnis gespeichert. Offene Scheine werden ausgewertet.";
  }else if(!action.equals("tippState"))throw new IllegalArgumentException("Unbekannte Tipp-Aktion.");
  Habbo h=online(user);if(h!=null)payUser(h);
  try(Connection c=db()){
   JsonObject state=new JsonObject();state.addProperty("requestId",str(q,"requestId"));state.addProperty("notice",notice);state.addProperty("canManage",manage);state.addProperty("serverTime",now);state.addProperty("weekUsed",used(c,user,now));state.addProperty("weekLimit",WEEK_LIMIT);state.addProperty("weekReset",Instant.ofEpochSecond(week(now)).atZone(ZoneId.of("Europe/Berlin")).plusWeeks(1).toEpochSecond());JsonArray latest=rows(c,"SELECT MAX(updated) AS stamp FROM habbico_tipp_games");long last=latest.size()>0&&!latest.get(0).getAsJsonObject().get("stamp").isJsonNull()?number(latest.get(0).getAsJsonObject(),"stamp"):0;state.addProperty("feedMessage",last>0&&now-last>120?"Quotenfeed veraltet – Tipps bleiben gesperrt.":feedMessage);
   JsonArray games=rows(c,"SELECT * FROM habbico_tipp_games WHERE starts>? ORDER BY starts LIMIT 2000",now-172800);for(JsonElement el:games){JsonObject g=el.getAsJsonObject();g.add("markets",new JsonParser().parse(str(g,"markets")));}state.add("games",games);
   state.add("mine",tickets(c,"WHERE t.user_id=? ORDER BY t.created DESC LIMIT 100",user));state.add("recent",tickets(c,"WHERE t.status IN ('won','lost') ORDER BY t.settled DESC LIMIT 60"));
   String base="SELECT u.id,u.username,u.look,SUM(CASE WHEN t.status='won' THEN 1 ELSE 0 END) AS wins,SUM(CASE WHEN t.status='lost' THEN 1 ELSE 0 END) AS losses,SUM(CASE WHEN t.currency=-1 THEN t.payout-t.stake ELSE 0 END) AS credits,SUM(CASE WHEN t.currency=5 THEN t.payout-t.stake ELSE 0 END) AS diamonds FROM habbico_tipp_tickets t JOIN users u ON u.id=t.user_id WHERE t.status IN ('won','lost') GROUP BY u.id,u.username,u.look ";
   state.add("winners",rows(c,base+"ORDER BY wins DESC,u.id LIMIT 20"));state.add("losers",rows(c,base+"ORDER BY losses DESC,u.id LIMIT 20"));
   state.add("balance",rows(c,"SELECT credits,(SELECT COALESCE(SUM(amount),0) FROM users_currency WHERE user_id=users.id AND type=5) AS diamonds FROM users WHERE id=?",user).get(0));
   if(manage){state.add("audit",rows(c,"SELECT a.*,u.username FROM habbico_tipp_audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 200"));state.add("allTickets",tickets(c,"ORDER BY t.created DESC LIMIT 200"));}return state;
  }
 }
 static void importFeed()throws Exception{
  Path file=Path.of("/opt/habboje/tipp/feed.json");if(!Files.exists(file))return;if(Files.size(file)>8000000)throw new IllegalArgumentException("Quotenfeed zu groß");long stamp=Files.getLastModifiedTime(file).toMillis();if(stamp==feedStamp)return;
  JsonObject feed=new JsonParser().parse(Files.readString(file)).getAsJsonObject();long now=Instant.now().getEpochSecond(),updated=number(feed,"updated");if(updated>now+5||now-updated>120)throw new IllegalArgumentException("Quotenfeed veraltet");JsonArray games=feed.getAsJsonArray("games");if(games.size()>5000)throw new IllegalArgumentException("Zu viele Spiele");
  transaction(c->{lock(c);for(JsonElement el:games){JsonObject g=el.getAsJsonObject();String id=str(g,"id"),league=str(g,"league"),home=str(g,"home"),away=str(g,"away"),source=str(g,"source");long starts=number(g,"starts"),fresh=number(g,"updated");if(!id.matches("[A-Za-z0-9_-]{1,96}")||league.length()>120||home.isBlank()||away.isBlank()||home.length()>120||away.length()>120||source.length()>80||fresh>now+5||fresh>updated)throw new IllegalArgumentException("Ungültige Feed-Daten");
   JsonArray markets=g.getAsJsonArray("markets");if(markets.size()>300)throw new IllegalArgumentException("Zu viele Märkte");Set<String> keys=new HashSet<>();for(JsonElement me:markets){JsonObject m=me.getAsJsonObject();String kind=str(m,"kind"),side=str(m,"side");if(!Set.of("h2h","totals","spreads").contains(kind)||!keys.add(str(m,"key"))||str(m,"key").length()>100)throw new IllegalArgumentException("Ungültiger Markt");if(!(kind.equals("totals")?Set.of("over","under"):kind.equals("h2h")?Set.of("home","away","draw"):Set.of("home","away")).contains(side))throw new IllegalArgumentException("Ungültige Auswahl");if(!kind.equals("h2h")&&m.get("line").getAsBigDecimal().multiply(java.math.BigDecimal.valueOf(2)).remainder(java.math.BigDecimal.ONE).signum()!=0)throw new IllegalArgumentException("Viertellinien werden nicht unterstützt");
    // A provider adapter must explicitly support authoritative suspend/resume sequences.
    boolean safe=feed.has("authoritativeLiveStops")&&feed.get("authoritativeLiveStops").getAsBoolean()&&m.has("version")&&!str(m,"version").isBlank();m.addProperty("liveSafe",safe);
   }
   update(c,"INSERT INTO habbico_tipp_games(id,league,home,away,starts,updated,source,markets) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE league=VALUES(league),home=VALUES(home),away=VALUES(away),starts=VALUES(starts),updated=VALUES(updated),source=VALUES(source),markets=VALUES(markets)",id,league,home,away,starts,fresh,source,markets.toString());
   if(g.has("live_home")&&!g.get("live_home").isJsonNull()&&g.has("live_away")&&!g.get("live_away").isJsonNull()){
    long lh=number(g,"live_home"),la=number(g,"live_away"),scoreTime=number(g,"score_updated");String clock=str(g,"clock");if(lh<0||la<0||lh>99||la>99||clock.length()>50||scoreTime>now+5)throw new IllegalArgumentException("Ungültiger Spielstand");
    update(c,"UPDATE habbico_tipp_games SET live_home=?,live_away=?,score_updated=?,clock=? WHERE id=? AND status='open' AND (score_updated IS NULL OR score_updated<=?)",lh,la,scoreTime,clock,id,scoreTime);
   }
  }return null;});feedStamp=stamp;feedMessage="Quoten verbunden · "+str(feed,"source");
 }
 static void tick(){
  try{importFeed();}catch(Exception e){feedMessage="Datenprüfung fehlgeschlagen. Veraltete Märkte bleiben gesperrt.";}
  long tickNow=Instant.now().getEpochSecond();if(tickNow-lastSettlement<10)return;lastSettlement=tickNow;
  try{transaction(c->{settle(c,Instant.now().getEpochSecond());return null;});List<Integer> users=new ArrayList<>();try(Connection c=db()){for(JsonElement el:rows(c,"SELECT DISTINCT user_id FROM habbico_tipp_tickets WHERE paid IS NULL AND status<>'open'"))users.add(el.getAsJsonObject().get("user_id").getAsInt());}for(int id:users){Habbo h=online(id);if(h!=null)payUser(h);}}
  catch(Exception e){server.Main.getLogger().warn("Habbico Tipp settlement: "+e.getClass().getSimpleName());}
 }
 public static synchronized void start(){if(timer!=null)return;timer=Executors.newSingleThreadScheduledExecutor(r->{Thread t=new Thread(r,"habbico-tipp");t.setDaemon(true);return t;});timer.scheduleWithFixedDelay(HabbicoTipp::tick,5,1,TimeUnit.SECONDS);}
 public static synchronized void stop(){if(timer!=null){timer.shutdownNow();timer=null;}}
}
