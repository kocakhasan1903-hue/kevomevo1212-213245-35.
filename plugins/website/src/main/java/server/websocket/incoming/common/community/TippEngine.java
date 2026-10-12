package server.websocket.incoming.common.community;

import com.google.gson.*;
import java.math.*;
import java.sql.*;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

/** Database-owned, free-play tickets. All entry/settlement calls use one transaction. */
public final class TippEngine {
 public interface Wallet { int change(Connection db,int user,int currency,int delta,String key)throws Exception; }
 public static final int WEEK_LIMIT=10,MAX_STAKE=1000000,MAX_PAYOUT=50000000;
 public static long week(long now){return Instant.ofEpochSecond(now).atZone(ZoneId.of("Europe/Berlin")).toLocalDate().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).atStartOfDay(ZoneId.of("Europe/Berlin")).toEpochSecond();}
 public static String str(JsonObject q,String k){return q.has(k)&&!q.get(k).isJsonNull()?q.get(k).getAsString():"";}
 public static long number(JsonObject q,String k){return q.get(k).getAsBigDecimal().longValueExact();}
 public static void update(Connection c,String sql,Object... values)throws SQLException{try(PreparedStatement s=c.prepareStatement(sql)){for(int i=0;i<values.length;i++)s.setObject(i+1,values[i]);s.executeUpdate();}}
 public static JsonArray rows(Connection c,String sql,Object... values)throws SQLException{JsonArray out=new JsonArray();try(PreparedStatement s=c.prepareStatement(sql)){for(int i=0;i<values.length;i++)s.setObject(i+1,values[i]);try(ResultSet r=s.executeQuery()){while(r.next()){JsonObject o=new JsonObject();for(int j=1;j<=r.getMetaData().getColumnCount();j++){String name=r.getMetaData().getColumnLabel(j).toLowerCase(Locale.ROOT);Object v=r.getObject(j);if(v==null)o.add(name,JsonNull.INSTANCE);else if(v instanceof Number)o.addProperty(name,(Number)v);else o.addProperty(name,v.toString());}out.add(o);}}}return out;}
 public static void lock(Connection c)throws SQLException{try(Statement s=c.createStatement();ResultSet r=s.executeQuery("SELECT id FROM habbico_tipp_lock WHERE id=1 FOR UPDATE")){if(!r.next())throw new SQLException("Tipp migration missing");}}
 public static void audit(Connection c,int actor,String action,String target,String details,long now)throws SQLException{update(c,"INSERT INTO habbico_tipp_audit(actor_id,action,target,details,created) VALUES(?,?,?,?,?)",actor,action,target,details,now);}
 public static int used(Connection c,int user,long now)throws SQLException{return rows(c,"SELECT COUNT(*) AS n FROM habbico_tipp_tickets WHERE user_id=? AND week_start=?",user,week(now)).get(0).getAsJsonObject().get("n").getAsInt();}
 public static int payout(int stake,BigDecimal odds){BigDecimal n=odds.multiply(BigDecimal.valueOf(stake)).setScale(0,RoundingMode.FLOOR);if(n.compareTo(BigDecimal.valueOf(MAX_PAYOUT))>0)throw new IllegalArgumentException("Die mögliche Auszahlung ist zu hoch.");return n.intValueExact();}
 public static int tax(int stake,int gross){return BigDecimal.valueOf(Math.max(0,gross-stake)).multiply(new BigDecimal("0.03")).setScale(0,RoundingMode.FLOOR).intValueExact();}
 public static int place(Connection c,int user,JsonObject q,long now,Wallet wallet)throws Exception{
  lock(c);String id=str(q,"ticketId");if(!id.matches("[0-9a-fA-F-]{36}"))throw new IllegalArgumentException("Ungültige Schein-ID.");
  JsonArray existing=rows(c,"SELECT user_id FROM habbico_tipp_tickets WHERE id=?",id);if(existing.size()>0){if(existing.get(0).getAsJsonObject().get("user_id").getAsInt()!=user)throw new IllegalArgumentException("Schein-ID bereits vergeben.");return -1;}
  int currency=Math.toIntExact(number(q,"currency")),stake=Math.toIntExact(number(q,"stake"));if((currency!=-1&&currency!=5)||stake<1||stake>MAX_STAKE)throw new IllegalArgumentException("Bitte einen gültigen Einsatz in Credits oder Diamanten wählen.");
  if(used(c,user,now)>=WEEK_LIMIT)throw new IllegalArgumentException("Du hast diese Woche bereits zehn Scheine abgegeben.");
  JsonArray choices=q.getAsJsonArray("selections");if(choices==null||choices.size()<1||choices.size()>10)throw new IllegalArgumentException("Wähle 1 bis 10 verschiedene Spiele.");
  Set<String> games=new HashSet<>();List<JsonObject> frozen=new ArrayList<>();BigDecimal total=BigDecimal.ONE;
  for(JsonElement e:choices){JsonObject pick=e.getAsJsonObject();String game=str(pick,"gameId"),key=str(pick,"key");if(!games.add(game))throw new IllegalArgumentException("Pro Spiel ist nur eine Auswahl pro Schein möglich.");
   JsonArray found=rows(c,"SELECT * FROM habbico_tipp_games WHERE id=?",game);if(found.size()!=1)throw new IllegalArgumentException("Spiel nicht gefunden.");JsonObject g=found.get(0).getAsJsonObject();
   long age=now-number(g,"updated");boolean live=now>=number(g,"starts");if(!str(g,"status").equals("open")||age<0||age>(live?30:120))throw new IllegalArgumentException("Die Quote ist gesperrt oder veraltet. Bitte aktualisieren.");
   JsonObject selection=null;for(JsonElement m:new JsonParser().parse(str(g,"markets")).getAsJsonArray())if(str(m.getAsJsonObject(),"key").equals(key))selection=m.getAsJsonObject();
   if(selection==null||!selection.get("available").getAsBoolean())throw new IllegalArgumentException("Dieser Markt ist aktuell gesperrt.");
   if(live){
    if(!selection.has("liveSafe")||!selection.get("liveSafe").getAsBoolean()||age>3)throw new IllegalArgumentException("Live-Tipps sind ohne aktuellen Sperrstatus gesperrt.");
    JsonArray pending=rows(c,"SELECT created,request_json FROM habbico_tipp_pending WHERE id=? AND user_id=?",id,user);
    if(pending.size()!=1)throw new IllegalArgumentException("Live-Tipp muss zunächst bestätigt werden.");
    long requested=number(pending.get(0).getAsJsonObject(),"created");
    if(now-requested<5||now-requested>20||number(g,"updated")<=requested)throw new IllegalArgumentException("Live-Tipp wartet auf eine neue Quotenbestätigung. Bitte erneut prüfen.");
    if(!str(selection,"version").equals(str(pick,"version"))||str(selection,"version").isEmpty())throw new IllegalArgumentException("Spielstand oder Marktstatus hat sich geändert. Live-Tipp abgelehnt.");
   }
   BigDecimal odds=selection.get("odds").getAsBigDecimal();if(odds.compareTo(new BigDecimal("1.01"))<0||odds.compareTo(new BigDecimal("1000"))>0)throw new IllegalArgumentException("Ungültige Quote.");
   if(odds.compareTo(pick.get("odds").getAsBigDecimal())!=0)throw new IllegalArgumentException("Eine Quote hat sich geändert. Bitte Auswahl prüfen und erneut bestätigen.");
   total=total.multiply(odds);payout(stake,total);JsonObject leg=new JsonParser().parse(selection.toString()).getAsJsonObject();leg.addProperty("gameId",game);leg.addProperty("home",str(g,"home"));leg.addProperty("away",str(g,"away"));leg.addProperty("league",str(g,"league"));frozen.add(leg);
  }
  int balance=wallet.change(c,user,currency,-stake,"tipp-stake-"+id);
  update(c,"INSERT INTO habbico_tipp_tickets(id,user_id,currency,stake,odds,created,week_start) VALUES(?,?,?,?,?,?,?)",id,user,currency,stake,total.setScale(6,RoundingMode.DOWN),now,week(now));
  for(JsonObject leg:frozen)update(c,"INSERT INTO habbico_tipp_legs(ticket_id,game_id,selection_json) VALUES(?,?,?)",id,str(leg,"gameId"),leg.toString());
  update(c,"DELETE FROM habbico_tipp_pending WHERE id=?",id);
  audit(c,user,"place",id,"stake="+stake+";currency="+currency+";odds="+total,now);return balance;
 }
 /** -1 loss, 0 push, 1 win. Only standard full-time markets are supported. */
 public static int outcome(JsonObject pick,int home,int away){String kind=str(pick,"kind"),side=str(pick,"side");
  if(kind.equals("h2h"))return ((side.equals("home")&&home>away)||(side.equals("away")&&away>home)||(side.equals("draw")&&home==away))?1:-1;
  BigDecimal line=pick.get("line").getAsBigDecimal();int cmp;
  if(kind.equals("totals")){cmp=BigDecimal.valueOf(home+away).compareTo(line);return side.equals("over")?cmp:-cmp;}
  if(kind.equals("spreads")){cmp=BigDecimal.valueOf(side.equals("home")?home-away:away-home).add(line).compareTo(BigDecimal.ZERO);return cmp;}
  throw new IllegalArgumentException("Markt kann nicht ausgewertet werden.");
 }
 public static void settle(Connection c,long now)throws Exception{
  // Same ordering as Lotto: pot before bonus, then the Tipp lock.
  try(Statement s=c.createStatement();ResultSet r=s.executeQuery("SELECT id FROM website_hourly_lotto_pot WHERE id=1 FOR UPDATE")){if(!r.next())throw new SQLException("Lotto fehlt");}lock(c);
  for(JsonElement element:rows(c,"SELECT * FROM habbico_tipp_tickets WHERE status='open' ORDER BY created LIMIT 500")){
   JsonObject ticket=element.getAsJsonObject();String id=str(ticket,"id");boolean pending=false,lost=false,win=false;BigDecimal odds=BigDecimal.ONE;
   for(JsonElement le:rows(c,"SELECT l.selection_json,g.status,g.home_score,g.away_score FROM habbico_tipp_legs l JOIN habbico_tipp_games g ON g.id=l.game_id WHERE l.ticket_id=?",id)){
    JsonObject row=le.getAsJsonObject(),pick=new JsonParser().parse(str(row,"selection_json")).getAsJsonObject();String status=str(row,"status");if(status.equals("void"))continue;if(!status.equals("finished")){pending=true;continue;}
    int result=outcome(pick,row.get("home_score").getAsInt(),row.get("away_score").getAsInt());if(result<0)lost=true;else if(result>0){win=true;odds=odds.multiply(pick.get("odds").getAsBigDecimal());}
   }
   if(pending)continue;int stake=ticket.get("stake").getAsInt(),gross=lost?0:payout(stake,odds),fee=lost?0:tax(stake,gross),star=!lost&&win?1:0;String status=lost?"lost":star==1?"won":"void";
   if(fee>0)update(c,ticket.get("currency").getAsInt()==-1?"UPDATE website_hourly_lotto_pot SET amount=amount+? WHERE id=1":"UPDATE website_hourly_lotto_bonus SET diamonds=diamonds+? WHERE id=1",fee);
   update(c,"UPDATE habbico_tipp_tickets SET status=?,payout=?,tax=?,star=?,settled=? WHERE id=?",status,gross-fee,fee,star,now,id);audit(c,0,"settle",id,status+";payout="+(gross-fee)+";tax="+fee+";star="+star,now);
  }
 }
 public static Map<Integer,Integer> pay(Connection c,int user,long now,Wallet wallet)throws Exception{
  lock(c);Map<Integer,Integer> balances=new HashMap<>();for(JsonElement el:rows(c,"SELECT * FROM habbico_tipp_tickets WHERE user_id=? AND status<>'open' AND paid IS NULL ORDER BY created",user)){
   JsonObject t=el.getAsJsonObject();String id=str(t,"id");int amount=t.get("payout").getAsInt(),currency=t.get("currency").getAsInt();if(amount>0)balances.put(currency,wallet.change(c,user,currency,amount,"tipp-payout-"+id));if(t.get("star").getAsInt()==1)balances.put(104,wallet.change(c,user,104,1,"tipp-star-"+id));update(c,"UPDATE habbico_tipp_tickets SET paid=? WHERE id=?",now,id);audit(c,user,"pay",id,"payout="+amount,now);
  }return balances;
 }
 public static JsonArray tickets(Connection c,String where,Object... args)throws SQLException{JsonArray result=rows(c,"SELECT t.*,u.username,u.look FROM habbico_tipp_tickets t JOIN users u ON u.id=t.user_id "+where,args);for(JsonElement e:result){JsonObject t=e.getAsJsonObject();JsonArray legs=new JsonArray();for(JsonElement l:rows(c,"SELECT selection_json FROM habbico_tipp_legs WHERE ticket_id=?",str(t,"id")))legs.add(new JsonParser().parse(str(l.getAsJsonObject(),"selection_json")));t.add("legs",legs);}return result;}
}
