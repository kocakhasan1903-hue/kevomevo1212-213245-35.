package server.websocket.incoming.common.community;

import com.google.gson.*;
import java.sql.*;
import java.util.*;

/** Public rare statistics; only completed native trade logs are used. */
public final class CmsPriceList {
 private static JsonArray rows(Connection db,String sql,Object... args)throws SQLException {
  JsonArray list=new JsonArray();
  try(PreparedStatement q=db.prepareStatement(sql)){for(int i=0;i<args.length;i++)q.setObject(i+1,args[i]);
   try(ResultSet r=q.executeQuery()){ResultSetMetaData m=r.getMetaData();while(r.next()){JsonObject o=new JsonObject();for(int i=1;i<=m.getColumnCount();i++)o.addProperty(m.getColumnLabel(i).toLowerCase(Locale.ROOT),r.getString(i));list.add(o);}}
  }return list;
 }
 private static final String ITEM="SELECT r.id,r.name,r.category,r.image,r.price_credits,r.price_diamonds,r.furni_id,COALESCE(stock.copies,0) AS copies,COALESCE(stock.owners,0) AS owners,COALESCE(stock.ltd,0) AS ltd FROM rare_catalog_items r LEFT JOIN (SELECT item_id,COUNT(*) AS copies,COUNT(DISTINCT user_id) AS owners,MAX(CASE WHEN limited_data IS NOT NULL AND limited_data<>'' AND limited_data<>'0:0' THEN 1 ELSE 0 END) AS ltd FROM items GROUP BY item_id) stock ON stock.item_id=r.furni_id";
 private static final String TRADE=" FROM room_trade_log t JOIN room_trade_log_items ti ON ti.id=t.id JOIN items i ON i.id=ti.item_id JOIN rare_catalog_items r ON r.furni_id=i.item_id ";
 public static void fill(Connection db,CmsExploreEvent.Request req,JsonObject result)throws SQLException {
  int days=Arrays.asList(7,30,90).contains(req.days)?req.days:30;
  long now=System.currentTimeMillis()/1000;
  String search=req.search==null?"":req.search.trim(), category=req.category==null?"":req.category.trim();
  if(search.length()>60||category.length()>100)throw new IllegalArgumentException("Suchbegriff zu lang.");
  String like="%"+search.replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%";
  String where=" WHERE r.name LIKE ? AND (?='' OR r.category=?)"+(req.ltd?" AND EXISTS(SELECT 1 FROM items lim WHERE lim.item_id=r.furni_id AND lim.limited_data IS NOT NULL AND lim.limited_data<>'' AND lim.limited_data<>'0:0')":"");
  result.add("categories",rows(db,"SELECT DISTINCT category FROM rare_catalog_items WHERE category<>'' ORDER BY category"));
  result.addProperty("days",days);
  if("detail".equals(req.view)){
   JsonArray item=rows(db,ITEM+" WHERE r.id=?",req.itemId);
   if(item.size()==0)throw new IllegalArgumentException("Dieses Möbel wurde nicht gefunden.");
   result.add("item",item.get(0));
   result.add("history",rows(db,"SELECT FLOOR(t.timestamp/86400) AS day,COUNT(DISTINCT t.id) AS trades"+TRADE+" WHERE r.id=? AND t.timestamp>=? GROUP BY FLOOR(t.timestamp/86400) ORDER BY day",req.itemId,now-86400L*days));
   result.add("owners",rows(db,"SELECT u.id,u.username,u.look,COUNT(*) AS copies FROM items i JOIN users u ON u.id=i.user_id JOIN rare_catalog_items r ON r.furni_id=i.item_id WHERE r.id=? GROUP BY u.id,u.username,u.look ORDER BY copies DESC,u.username LIMIT 100",req.itemId));
   return;
  }
  JsonArray counts=rows(db,"SELECT COUNT(DISTINCT CASE WHEN t.timestamp>=? THEN t.id END) AS day,COUNT(DISTINCT CASE WHEN t.timestamp>=? THEN t.id END) AS week,COUNT(DISTINCT t.id) AS period"+TRADE+where+" AND t.timestamp>=?",now-86400,now-7*86400,like,category,category,now-days*86400L);
  result.add("totals",counts.get(0));
  String activity="SELECT r.id,COUNT(DISTINCT CASE WHEN t.timestamp>=? THEN t.id END) AS day,COUNT(DISTINCT CASE WHEN t.timestamp>=? THEN t.id END) AS week,COUNT(DISTINCT t.id) AS period"+TRADE+where+" AND t.timestamp>=? GROUP BY r.id";
  result.add("activity",rows(db,activity,now-86400,now-7*86400,like,category,category,now-days*86400L));
  if("dashboard".equals(req.view)){
   JsonArray trending=rows(db,ITEM+where+" ORDER BY (SELECT COUNT(DISTINCT t.id) FROM room_trade_log t JOIN room_trade_log_items ti ON ti.id=t.id JOIN items i ON i.id=ti.item_id WHERE i.item_id=r.furni_id AND t.timestamp>=?) DESC,r.id DESC LIMIT 9",like,category,category,now-days*86400L);
   result.add("trending",trending);
   result.add("newest",rows(db,ITEM+where+" ORDER BY r.id DESC LIMIT 12",like,category,category));
   result.add("history",rows(db,"SELECT r.id,FLOOR(t.timestamp/86400) AS day,COUNT(DISTINCT t.id) AS trades"+TRADE+where+" AND t.timestamp>=? GROUP BY r.id,FLOOR(t.timestamp/86400)",like,category,category,now-days*86400L));
   result.add("traders",rows(db,"SELECT u.id,u.username,u.look,MAX(t.timestamp) AS last_trade,COUNT(DISTINCT CASE WHEN t.timestamp>=? THEN t.id END) AS day,COUNT(DISTINCT CASE WHEN t.timestamp>=? THEN t.id END) AS week,COUNT(DISTINCT t.id) AS trades,COUNT(DISTINCT ti.item_id) AS rares FROM room_trade_log t JOIN room_trade_log_items ti ON ti.id=t.id JOIN items i ON i.id=ti.item_id JOIN rare_catalog_items r ON r.furni_id=i.item_id JOIN users u ON (u.id=t.user_one_id OR u.id=t.user_two_id)"+where+" AND t.timestamp>=? GROUP BY u.id,u.username,u.look ORDER BY trades DESC,u.username LIMIT 8",now-86400,now-7*86400,like,category,category,now-days*86400L));
  }else{
   String order="name".equals(req.sort)?"r.name ASC":"price_asc".equals(req.sort)?"r.price_credits ASC,r.id DESC":"price_desc".equals(req.sort)?"r.price_credits DESC,r.id DESC":"r.id DESC";
   int page=Math.max(0,Math.min(req.page,10000));
   result.add("items",rows(db,ITEM+where+" ORDER BY "+order+" LIMIT 24 OFFSET ?",like,category,category,page*24));
   result.add("summary",rows(db,"SELECT COUNT(*) AS total,COALESCE(SUM(r.price_credits),0) AS value,COALESCE(AVG(r.price_credits),0) AS average FROM rare_catalog_items r"+where,like,category,category).get(0));
  }
 }
}


