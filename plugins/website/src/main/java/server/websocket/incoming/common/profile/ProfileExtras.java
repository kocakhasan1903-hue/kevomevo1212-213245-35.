package server.websocket.incoming.common.profile;
import com.eu.habbo.Emulator;
import com.google.gson.*;
import java.sql.*;
import server.websocket.client.WebSocketClient;
import server.websocket.outgoing.common.misc.DataComposer;
public final class ProfileExtras {
 public static void handle(WebSocketClient client,int owner,String action,String text,int postId)throws Exception{
  int author=client.getAccount().getId();
  if(action!=null&&action.startsWith("tipp")){client.sendMessage(new DataComposer("tippState",server.websocket.incoming.common.community.HabbicoTipp.handle(author,action,text).toString()));return;}
  if(action!=null&&action.startsWith("voiceChannel")){ProfileVoiceChannels.handle(client,action,text);return;}
  if(action!=null&&action.startsWith("voice")){ProfileRoomVoice.handle(client,action,text);return;}
  if(action!=null&&action.startsWith("event")){client.sendMessage(new DataComposer("eventState",ProfileEvents.handle(author,action,text).toString()));return;}
  if(action!=null&&action.startsWith("moderation")){client.sendMessage(new DataComposer("moderationState",ProfileModeration.handle(author,action,text).toString()));return;}
  if(action!=null&&action.startsWith("support")){client.sendMessage(new DataComposer("supportState",ProfileSupport.handle(author,action,text).toString()));return;}
  if(action!=null&&action.startsWith("market")){client.sendMessage(new DataComposer("marketState",ProfileMarketplace.handle(author,action,text).toString()));return;}
  try(Connection c=Emulator.getDatabase().getDataSource().getConnection()){
   if("nametagList".equals(action)){client.sendMessage(new DataComposer("nametagState",ProfileNametag.list(c,text).toString()));return;}
   if("nametagSave".equals(action)){
    JsonObject state=ProfileNametag.save(c,author,owner,text);
    client.sendMessage(new DataComposer("nametagState",state.toString()));
    state.addProperty("action","nametagUpdated");
    server.websocket.WebSocketManager.getInstance().getClientManager().sendWSForAll(new DataComposer("nametagState",state.toString()));return;
   }
   if(action!=null&&action.startsWith("media")){client.sendMessage(new DataComposer("profileAsset",ProfileMedia.handle(c,author,owner,action,text).toString()));return;}
   if("appearance".equals(action)){
    if(text==null||text.length()>4000)throw new IllegalArgumentException("Invalid appearance");
    JsonObject a=new JsonParser().parse(text).getAsJsonObject();
    ProfileAppearance.save(c,author,owner,a.get("banner").getAsString(),a.get("avatar").getAsString(),a.has("textColor")?a.get("textColor").getAsString():"#ffffff",a.has("borderColor")?a.get("borderColor").getAsString():"#666666",a.has("borderWidth")?a.get("borderWidth").getAsInt():1);
   }else if("clientAppearance".equals(action)){
    if(text==null||text.length()>6000)throw new IllegalArgumentException("Profilgestaltung zu gross.");
    JsonObject style=new JsonParser().parse(text).getAsJsonObject();
    c.setAutoCommit(false);try{
     if(style.has("appearance")){JsonObject a=style.getAsJsonObject("appearance");ProfileAppearance.save(c,author,owner,a.get("banner").getAsString(),a.get("avatar").getAsString(),a.get("textColor").getAsString(),a.get("borderColor").getAsString(),a.get("borderWidth").getAsInt());}
     ProfileAppearance.saveClientStyle(c,author,owner,style);c.commit();
    }catch(Exception e){c.rollback();throw e;}finally{c.setAutoCommit(true);}
   }else if("post".equals(action)){
    if(text==null||text.trim().isEmpty()||text.trim().length()>500)throw new IllegalArgumentException("Bitte eine Nachricht mit höchstens 500 Zeichen eingeben.");
    c.setAutoCommit(false);
    try{
     try(PreparedStatement p=c.prepareStatement("SELECT id FROM users WHERE id=? FOR UPDATE")){p.setInt(1,author);try(ResultSet rs=p.executeQuery()){if(!rs.next())throw new SQLException("Missing author");}}
     try(PreparedStatement p=c.prepareStatement("SELECT created_at FROM website_profile_wall WHERE author_id=? ORDER BY id DESC LIMIT 1")){p.setInt(1,author);try(ResultSet rs=p.executeQuery()){if(rs.next()&&System.currentTimeMillis()/1000-rs.getLong(1)<20)throw new IllegalArgumentException("Bitte warte kurz, bevor du erneut postest.");}}
     try(PreparedStatement p=c.prepareStatement("INSERT INTO website_profile_wall(owner_id,author_id,message,created_at) VALUES(?,?,?,?)")){p.setInt(1,owner);p.setInt(2,author);p.setString(3,text.trim());p.setLong(4,System.currentTimeMillis()/1000);p.executeUpdate();}c.commit();
    }catch(Exception e){c.rollback();throw e;}finally{c.setAutoCommit(true);}
   }else if("like".equals(action)){
    c.setAutoCommit(false);
    try{
     try(PreparedStatement p=c.prepareStatement("SELECT id FROM website_profile_wall WHERE id=? AND owner_id=? FOR UPDATE")){p.setInt(1,postId);p.setInt(2,owner);try(ResultSet rs=p.executeQuery()){if(!rs.next())throw new IllegalArgumentException("Dieser Pinnwand-Eintrag existiert nicht mehr.");}}
     int removed;try(PreparedStatement p=c.prepareStatement("DELETE FROM website_profile_wall_likes WHERE post_id=? AND user_id=?")){p.setInt(1,postId);p.setInt(2,author);removed=p.executeUpdate();}
     if(removed==0)try(PreparedStatement p=c.prepareStatement("INSERT INTO website_profile_wall_likes(post_id,user_id) VALUES(?,?)")){p.setInt(1,postId);p.setInt(2,author);p.executeUpdate();}
     c.commit();
    }catch(Exception e){c.rollback();throw e;}finally{c.setAutoCommit(true);}
   }else if("delete".equals(action)){
    try(PreparedStatement p=c.prepareStatement("DELETE FROM website_profile_wall WHERE id=? AND owner_id=? AND (author_id=? OR owner_id=?)")){p.setInt(1,postId);p.setInt(2,owner);p.setInt(3,author);p.setInt(4,author);p.executeUpdate();}
   }else if(action!=null&&!"get".equals(action))throw new IllegalArgumentException("Unknown action");
   JsonObject result=new JsonObject();result.addProperty("ownerId",owner);result.addProperty("action",action==null?"get":action);JsonArray wall=new JsonArray();
   try(PreparedStatement p=c.prepareStatement("SELECT w.*,u.username,u.look,(SELECT COUNT(*) FROM website_profile_wall_likes l WHERE l.post_id=w.id) likes,EXISTS(SELECT 1 FROM website_profile_wall_likes l WHERE l.post_id=w.id AND l.user_id="+author+") liked FROM website_profile_wall w JOIN users u ON u.id=w.author_id WHERE owner_id=? ORDER BY w.id DESC LIMIT 50")){p.setInt(1,owner);try(ResultSet rs=p.executeQuery()){while(rs.next()){JsonObject o=new JsonObject();o.addProperty("id",rs.getInt("id"));o.addProperty("authorId",rs.getInt("author_id"));o.addProperty("username",rs.getString("username"));o.addProperty("look",rs.getString("look"));o.addProperty("message",rs.getString("message"));o.addProperty("date",rs.getLong("created_at"));o.addProperty("likes",rs.getInt("likes"));o.addProperty("liked",rs.getBoolean("liked"));wall.add(o);}}}result.add("wall",wall);
   result.add("appearance",ProfileAppearance.read(c,owner));
   try(PreparedStatement p=c.prepareStatement("SELECT EXISTS(SELECT 1 FROM users_subscriptions WHERE user_id=? AND subscription_type='HABBO_CLUB' AND active=1 AND timestamp_start<=? AND timestamp_start+duration>?)")){p.setInt(1,owner);long now=System.currentTimeMillis()/1000;p.setLong(2,now);p.setLong(3,now);try(ResultSet r=p.executeQuery()){r.next();result.addProperty("premium",r.getBoolean(1));}}
   JsonObject stats=new JsonObject();
   try(PreparedStatement p=c.prepareStatement("SELECT credits,online,look,gender FROM users WHERE id=?")){p.setInt(1,owner);try(ResultSet rs=p.executeQuery()){if(rs.next()){stats.addProperty("credits",rs.getInt(1));stats.addProperty("online",rs.getInt(2)==1);result.addProperty("look",rs.getString(3));result.addProperty("gender",rs.getString(4));}}}
   stats.addProperty("diamonds",0);stats.addProperty("eventpoints",0);stats.addProperty("duckets",0);
   try(PreparedStatement p=c.prepareStatement("SELECT type,amount FROM users_currency WHERE user_id=?")){p.setInt(1,owner);try(ResultSet rs=p.executeQuery()){while(rs.next()){int type=rs.getInt(1);if(type==5)stats.addProperty("diamonds",rs.getInt(2));if(type==104)stats.addProperty("eventpoints",rs.getInt(2));if(type==0)stats.addProperty("duckets",rs.getInt(2));}}}ProfileMetrics.read(c,owner,stats);result.add("stats",stats);
   JsonArray comments=new JsonArray();try(PreparedStatement p=c.prepareStatement("SELECT c.id,c.news_id,c.message,c.timestamp,a.title,a.image FROM website_news_reactions c JOIN website_articles a ON a.id=c.news_id WHERE c.player_id=? ORDER BY c.id DESC LIMIT 30")){p.setInt(1,owner);try(ResultSet rs=p.executeQuery()){while(rs.next()){JsonObject o=new JsonObject();o.addProperty("id",rs.getInt("id"));o.addProperty("articleId",rs.getInt("news_id"));o.addProperty("message",rs.getString("message"));o.addProperty("date",rs.getLong("timestamp"));o.addProperty("title",rs.getString("title"));o.addProperty("header",rs.getString("image"));comments.add(o);}}}result.add("comments",comments);
   JsonArray rooms=new JsonArray();try(PreparedStatement p=c.prepareStatement("SELECT id,name,description,users,users_max FROM rooms WHERE owner_id=? ORDER BY id DESC LIMIT 25")){p.setInt(1,owner);try(ResultSet rs=p.executeQuery()){while(rs.next()){JsonObject o=new JsonObject();o.addProperty("id",rs.getInt("id"));o.addProperty("roomName",rs.getString("name"));o.addProperty("description",rs.getString("description"));o.addProperty("userCount",rs.getInt("users"));o.addProperty("userMax",rs.getInt("users_max"));o.addProperty("thumbnail","/nitro-assets/camera/thumbnails/"+rs.getInt("id")+".png");rooms.add(o);}}}result.add("rooms",rooms);
   JsonArray photos=new JsonArray();try(PreparedStatement p=c.prepareStatement("SELECT id,room_id,timestamp,url FROM camera_web WHERE user_id=? ORDER BY id DESC LIMIT 50")){p.setInt(1,owner);try(ResultSet rs=p.executeQuery()){while(rs.next()){JsonObject o=new JsonObject();o.addProperty("id",rs.getInt(1));o.addProperty("roomId",rs.getInt(2));o.addProperty("date",rs.getLong(3));o.addProperty("url",rs.getString(4));photos.add(o);}}}catch(SQLException e){org.slf4j.LoggerFactory.getLogger(ProfileExtras.class).warn("Published profile photos unavailable",e);}result.add("photos",photos);
   client.sendMessage(new DataComposer("profileExtras",result.toString()));
  }
 }
}
