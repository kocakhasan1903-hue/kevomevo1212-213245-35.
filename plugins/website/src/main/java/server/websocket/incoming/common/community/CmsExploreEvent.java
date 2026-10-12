package server.websocket.incoming.common.community;
import com.eu.habbo.Emulator;
import com.google.gson.*;
import server.Main;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.misc.DataComposer;
import java.sql.*;
public class CmsExploreEvent extends IncomingWebMessage<CmsExploreEvent.Request>{
 public CmsExploreEvent(){super(Request.class);}
 @Override public void handle(WebSocketClient client,Request r){
  if(r==null)return;
  JsonObject result=new JsonObject();result.addProperty("requestId",r.requestId);
  try(Connection db=Emulator.getDatabase().getDataSource().getConnection()){
   if("photos".equals(r.kind)||"rares".equals(r.kind)||"faq".equals(r.kind)||"changelog".equals(r.kind)){
    String feature="photos".equals(r.kind)?"photos_enabled":"rares".equals(r.kind)?"pricelist_enabled":"faq".equals(r.kind)?"faq_enabled":"changelog_enabled";
    try(Statement q=db.createStatement();ResultSet enabled=q.executeQuery("SELECT "+feature+" FROM habboje_shop.feature_settings WHERE id=1")){if(!enabled.next()||!enabled.getBoolean(1))throw new IllegalArgumentException("Dieser Bereich ist deaktiviert.");}
   }
   if("rares".equals(r.kind) && r.view!=null){CmsPriceList.fill(db,r,result);client.sendMessage(new DataComposer("cmsExplore",result.toString()));return;}
   if("roomOwners".equals(r.kind)){
    if(r.ownerIds==null||r.ownerIds.length==0||r.ownerIds.length>100)throw new IllegalArgumentException("Ungültige Besitzerliste.");
    JsonArray owners=new JsonArray();String slots=String.join(",",java.util.Collections.nCopies(r.ownerIds.length,"?"));
    try(PreparedStatement q=db.prepareStatement("SELECT id,look FROM users WHERE id IN ("+slots+")")){
     for(int i=0;i<r.ownerIds.length;i++)q.setInt(i+1,r.ownerIds[i]);
     try(ResultSet rows=q.executeQuery()){while(rows.next()){JsonObject owner=new JsonObject();owner.addProperty("id",rows.getInt("id"));owner.addProperty("look",rows.getString("look"));owners.add(owner);}}
    }
    result.add("items",owners);client.sendMessage(new DataComposer("cmsExplore",result.toString()));return;
   }
   String select,from,filter,order;
   if("members".equals(r.kind)){select="u.id,u.username,u.look,u.motto";from="users u";filter="u.username LIKE ?";order="u.id DESC";}
   else if("rooms".equals(r.kind)){select="r.id,r.name,r.description,r.users,r.users_max,r.score,u.username";from="rooms r LEFT JOIN users u ON u.id=r.owner_id";filter="(r.name LIKE ? OR u.username LIKE ?)";order="score".equals(r.sort)?"r.score DESC,r.id DESC":"r.users DESC,r.id DESC";}
   else if("photos".equals(r.kind)){select="p.id,p.url,p.room_id,p.timestamp,u.username";from="camera_web p LEFT JOIN users u ON u.id=p.user_id";filter="u.username LIKE ?";order="p.id DESC";}
   else if("rares".equals(r.kind)){select="id,name,category,image,price_credits,price_diamonds,furni_id,(SELECT COUNT(*) FROM items WHERE item_id=rare_catalog_items.furni_id) AS copies,(SELECT COUNT(DISTINCT user_id) FROM items WHERE item_id=rare_catalog_items.furni_id) AS owners";from="rare_catalog_items";filter="name LIKE ?";order="id DESC";}
   else if("faq".equals(r.kind)){select="id,question,answer,category";from="habboje_shop.faq";filter="active=1 AND CONCAT_WS(' ',question,answer,category) LIKE ?";order="sort_order ASC,id ASC";}
   else if("changelog".equals(r.kind)){select="id,title,version,category,body,created_at";from="habboje_shop.changelog";filter="active=1 AND CONCAT_WS(' ',title,version,category,body) LIKE ?";order="created_at DESC,id DESC";}
   else throw new IllegalArgumentException("Unbekannter Bereich.");
   String search=r.search==null?"":r.search.trim();if(search.length()>60)throw new IllegalArgumentException("Suchbegriff zu lang.");
   String like="%"+search.replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%";
   int page=Math.max(0,Math.min(r.page,10000)),count=0;
   try(PreparedStatement q=db.prepareStatement("SELECT COUNT(*) FROM "+from+" WHERE "+filter)){q.setString(1,like);if("rooms".equals(r.kind))q.setString(2,like);try(ResultSet rs=q.executeQuery()){rs.next();count=rs.getInt(1);}}
   JsonArray rows=new JsonArray();
   try(PreparedStatement q=db.prepareStatement("SELECT "+select+" FROM "+from+" WHERE "+filter+" ORDER BY "+order+" LIMIT 24 OFFSET ?")){
    q.setString(1,like);int next=2;if("rooms".equals(r.kind)){q.setString(2,like);next=3;}q.setInt(next,page*24);
    try(ResultSet rs=q.executeQuery()){ResultSetMetaData meta=rs.getMetaData();while(rs.next()){JsonObject row=new JsonObject();for(int i=1;i<=meta.getColumnCount();i++)row.addProperty(meta.getColumnLabel(i),rs.getString(i));rows.add(row);}}
   }
   result.add("items",rows);result.addProperty("total",count);result.addProperty("page",page);
  }catch(Exception e){Main.getLogger().error("CMS directory failed",e);result.addProperty("error",e instanceof IllegalArgumentException?e.getMessage():"Dieser Bereich konnte nicht geladen werden. Bitte erneut versuchen.");}
  client.sendMessage(new DataComposer("cmsExplore",result.toString()));
 }
 public static class Request{public String requestId,kind,search,sort,view,category;public int page,days,itemId;public int[] ownerIds;public boolean ltd;}
}
