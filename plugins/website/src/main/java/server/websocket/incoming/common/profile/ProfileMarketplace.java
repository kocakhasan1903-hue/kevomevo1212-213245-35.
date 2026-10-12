package server.websocket.incoming.common.profile;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.catalog.marketplace.MarketPlace;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.habbohotel.users.HabboItem;
import com.eu.habbo.networking.gameserver.decoders.GameMessageHandler;
import com.google.gson.*;
import java.sql.*;
import java.util.concurrent.TimeUnit;

/** CMS and hotel use the same offers and the emulator's existing trading engine. */
public final class ProfileMarketplace {
 private static int number(JsonObject o,String key,int fallback){try{return o.has(key)?o.get(key).getAsBigDecimal().intValueExact():fallback;}catch(ArithmeticException|NumberFormatException e){throw new IllegalArgumentException("Ungültiger Zahlenwert.");}}
 public static JsonObject handle(int user,String action,String text)throws Exception{
  if(text==null||text.length()>2000)throw new IllegalArgumentException("Ungültige Marktplatz-Anfrage.");
  JsonObject q=new JsonParser().parse(text).getAsJsonObject();
  JsonObject result=new JsonObject();result.addProperty("requestId",q.has("requestId")?q.get("requestId").getAsString():"");
  String notice="";
  if(!"marketList".equals(action)){
   if(!MarketPlace.MARKETPLACE_ENABLED)throw new IllegalArgumentException("Der Marktplatz ist derzeit geschlossen.");
   Habbo h=Emulator.getGameEnvironment().getHabboManager().getHabbo(user);
   if(h==null||h.getClient()==null||h.getClient().getChannel()==null)throw new IllegalArgumentException("Bitte zum Handeln im Hotel einchecken. Die Webseite kann dabei geöffnet bleiben.");
   var context=h.getClient().getChannel().pipeline().context(GameMessageHandler.class);
   if(context==null)throw new IllegalArgumentException("Hotel-Verbindung nicht bereit.");
   // Run on the SAME serialized executor as native inventory/trade packets.
   java.util.concurrent.Callable<String> trade=()->{
    if(!h.getClient().getChannel().isActive()||h.getClient().getHabbo()!=h)throw new IllegalArgumentException("Bitte erneut einchecken.");
    try(Connection db=Emulator.getDatabase().getDataSource().getConnection()){
     int id=number(q,"id",0);
     if("marketSell".equals(action)){
      int price=number(q,"price",0);
      if(price<1||price>1000000000)throw new IllegalArgumentException("Preis: 1 bis 1.000.000.000.");
      HabboItem item=h.getInventory().getItemsComponent().getHabboItem(id);
      if(item==null||item.getUserId()!=user||item.getRoomId()!=0||!item.getBaseItem().allowMarketplace())throw new IllegalArgumentException("Dieses Item ist nicht mehr verkaufbar im Inventar.");
      if(!MarketPlace.sellItem(h.getClient(),item,price))throw new IllegalArgumentException("Das Angebot konnte nicht erstellt werden.");
      return "Angebot erstellt. Der Käuferpreis enthält die Marktplatzgebühr.";
     }
     if("marketClaim".equals(action)){
      if(number(q,"currency",MarketPlace.MARKETPLACE_CURRENCY)!=MarketPlace.MARKETPLACE_CURRENCY)throw new IllegalArgumentException("Für diese Währung ist der Handel nicht aktiviert.");
      MarketPlace.getCredits(h.getClient());
      try(PreparedStatement p=db.prepareStatement("SELECT COUNT(*) FROM marketplace_items WHERE user_id=? AND state=2")){p.setInt(1,user);try(ResultSet r=p.executeQuery()){r.next();if(r.getInt(1)>0)throw new IllegalArgumentException("Erlöse konnten nicht vollständig abgeholt werden. Bitte Guthaben und Angebote aktualisieren.");}}
      return "Verkaufserlöse wurden abgeholt.";
     }
     int seller,price,state,stamp,itemId;
     try(PreparedStatement p=db.prepareStatement("SELECT user_id,price,state,timestamp,item_id FROM marketplace_items WHERE id=?")){
      p.setInt(1,id);try(ResultSet r=p.executeQuery()){if(!r.next())throw new IllegalArgumentException("Dieses Angebot ist nicht mehr verfügbar.");seller=r.getInt(1);price=r.getInt(2);state=r.getInt(3);stamp=r.getInt(4);itemId=r.getInt(5);}
     }
     if("marketBuy".equals(action)){
      if(seller==user||state!=1||stamp+172800L<=System.currentTimeMillis()/1000)throw new IllegalArgumentException("Dieses Angebot kann nicht gekauft werden.");
      if(number(q,"price",-1)!=MarketPlace.calculateCommision(price))throw new IllegalArgumentException("Der Preis hat sich geändert. Bitte neu auswählen.");
      MarketPlace.buyItem(id,h.getClient());
      try(PreparedStatement p=db.prepareStatement("SELECT user_id FROM items WHERE id=?")){p.setInt(1,itemId);try(ResultSet r=p.executeQuery()){if(!r.next()||r.getInt(1)!=user)throw new IllegalArgumentException("Kauf nicht abgeschlossen. Bitte Guthaben und Verfügbarkeit prüfen.");}}
      return "Gekauft! Das Item liegt in deinem Inventar.";
     }
     if("marketCancel".equals(action)){
      if(seller!=user||state==2)throw new IllegalArgumentException("Dieses Angebot kann nicht zurückgenommen werden.");
      MarketPlace.takeBackItem(h,id);
      try(PreparedStatement p=db.prepareStatement("SELECT id FROM marketplace_items WHERE id=?")){p.setInt(1,id);try(ResultSet r=p.executeQuery()){if(r.next())throw new IllegalArgumentException("Rücknahme nicht abgeschlossen. Bitte Angebote aktualisieren.");}}
      return "Angebot zurückgenommen.";
     }
     throw new IllegalArgumentException("Unbekannte Marktplatz-Aktion.");
    }
   };
   try{notice=context.executor().inEventLoop()?trade.call():context.executor().submit(trade).get(20,TimeUnit.SECONDS);}
   catch(java.util.concurrent.ExecutionException e){if(e.getCause() instanceof IllegalArgumentException)throw (IllegalArgumentException)e.getCause();throw e;}
   catch(java.util.concurrent.TimeoutException e){throw new IllegalArgumentException("Die Verarbeitung dauert länger. Bitte vor einer erneuten Aktion die Angebote und dein Inventar aktualisieren.");}
  }
  try(Connection c=Emulator.getDatabase().getDataSource().getConnection()){
  String tab=q.has("tab")?q.get("tab").getAsString():"browse";
  String search=q.has("search")?q.get("search").getAsString().trim():"";
  if(search.length()>100)throw new IllegalArgumentException("Suchbegriff zu lang.");
  int page=Math.max(0,Math.min(10000,number(q,"page",0))),sort=number(q,"sort",0),category=number(q,"category",0);
  String where="inventory".equals(tab)?"i.user_id=? AND i.room_id=0 AND b.allow_marketplace_sell=1":("own".equals(tab)?"m.user_id=?":"m.state=1 AND m.timestamp>? ");
  String from="inventory".equals(tab)?"items i JOIN items_base b ON b.id=i.item_id":"marketplace_items m JOIN items i ON i.id=m.item_id JOIN items_base b ON b.id=i.item_id JOIN users u ON u.id=m.user_id";
  int ownSection=number(q,"ownSection",1);
  if("own".equals(tab)){long cutoff=System.currentTimeMillis()/1000-172800;where+=ownSection==2?" AND m.state=2":ownSection==3?" AND (m.state=3 OR (m.state=1 AND m.timestamp<="+cutoff+"))":" AND m.state=1 AND m.timestamp>"+cutoff;}
  result.addProperty("ownSection",ownSection);
  where+=" AND (b.public_name LIKE ? OR b.item_name LIKE ?)";
  if(category==1)where+=" AND b.type='s'";if(category==2)where+=" AND b.type='i'";
  int filter="inventory".equals(tab)||"own".equals(tab)?user:(int)(System.currentTimeMillis()/1000-172800);
  String columns="inventory".equals(tab)?"i.id,b.public_name,b.item_name,b.type,0 price,0 state,0 timestamp,'' username,0 seller":"m.id,b.public_name,b.item_name,b.type,m.price,m.state,m.timestamp,u.username,m.user_id seller";
  String order="inventory".equals(tab)?"i.id DESC":sort==1?"m.timestamp ASC":sort==2?"m.price ASC,m.id DESC":sort==3?"m.price DESC,m.id DESC":"m.id DESC";
  JsonArray entries=new JsonArray();
  try(PreparedStatement p=c.prepareStatement("SELECT "+columns+" FROM "+from+" WHERE "+where+" ORDER BY "+order+" LIMIT 24 OFFSET ?")){
   p.setInt(1,filter);p.setString(2,"%"+search+"%");p.setString(3,"%"+search+"%");p.setInt(4,page*24);
   try(ResultSet r=p.executeQuery()){while(r.next()){
    JsonObject o=new JsonObject();o.addProperty("id",r.getInt("id"));o.addProperty("name",r.getString("public_name"));o.addProperty("asset",r.getString("item_name"));o.addProperty("seller",r.getString("username"));o.addProperty("own",r.getInt("seller")==user);o.addProperty("price",MarketPlace.calculateCommision(r.getInt("price")));o.addProperty("proceeds",r.getInt("price"));
    int state=r.getInt("state");if(state==1&&r.getLong("timestamp")+172800<=System.currentTimeMillis()/1000)state=3;o.addProperty("state",state);entries.add(o);
   }}
  }
  try(PreparedStatement p=c.prepareStatement("SELECT COUNT(*) FROM "+from+" WHERE "+where)){p.setInt(1,filter);p.setString(2,"%"+search+"%");p.setString(3,"%"+search+"%");try(ResultSet r=p.executeQuery()){r.next();result.addProperty("total",r.getInt(1));}}
  long claimable=0;
  try(PreparedStatement p=c.prepareStatement("SELECT COALESCE(SUM(price),0) FROM marketplace_items WHERE user_id=? AND state=2")){p.setInt(1,user);try(ResultSet r=p.executeQuery()){if(r.next())claimable=r.getLong(1);}}
  JsonArray vaults=new JsonArray();
  // Flammen are the login streak counter, not a transferable emulator currency.
  for(int type:new int[]{0,104,5,-2}){JsonObject vault=new JsonObject();vault.addProperty("type",type);vault.addProperty("amount",type==MarketPlace.MARKETPLACE_CURRENCY?claimable:0);vault.addProperty("enabled",type==MarketPlace.MARKETPLACE_CURRENCY&&MarketPlace.MARKETPLACE_ENABLED);vaults.add(vault);}
  result.add("vaults",vaults);
  result.add("items",entries);result.addProperty("notice",notice);result.addProperty("enabled",MarketPlace.MARKETPLACE_ENABLED);result.addProperty("currency",MarketPlace.MARKETPLACE_CURRENCY);result.addProperty("page",page);result.addProperty("tab",tab);
  return result;
  }
 }
}
