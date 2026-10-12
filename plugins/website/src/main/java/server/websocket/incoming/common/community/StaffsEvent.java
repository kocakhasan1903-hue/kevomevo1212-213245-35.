package server.websocket.incoming.common.community;
import com.eu.habbo.Emulator;
import com.google.gson.*;
import java.sql.*;
import server.Main;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.OutgoingWebMessage;
public class StaffsEvent extends IncomingWebMessage<Object> {
 public StaffsEvent(){super(Object.class);}
 @Override public void handle(WebSocketClient client,Object message){
  OutgoingWebMessage result=new OutgoingWebMessage("staff");
  JsonArray staffs=new JsonArray(),ranks=new JsonArray();
  try(Connection db=Emulator.getDatabase().getDataSource().getConnection()){
   try(Statement q=db.createStatement();ResultSet rs=q.executeQuery("SELECT u.id,u.username,u.look,u.motto,u.rank,u.online,p.rank_name,a.avatar_url,a.banner_url,a.text_color,a.border_color,a.border_width FROM users u LEFT JOIN permissions p ON p.id=u.rank LEFT JOIN website_profile_appearance a ON a.user_id=u.id WHERE u.rank>=3 ORDER BY u.rank DESC,u.username ASC")){
    while(rs.next()){
     JsonObject a=new JsonObject();a.addProperty("id",rs.getInt("id"));a.addProperty("username",rs.getString("username"));a.addProperty("look",rs.getString("look"));a.addProperty("motto",rs.getString("motto"));
     JsonObject appearance=new JsonObject();appearance.addProperty("avatar",rs.getString("avatar_url"));appearance.addProperty("banner",rs.getString("banner_url"));appearance.addProperty("textColor",rs.getString("text_color"));appearance.addProperty("borderColor",rs.getString("border_color"));appearance.addProperty("borderWidth",rs.getInt("border_width"));a.add("appearance",appearance);JsonObject s=new JsonObject();s.add("account",a);s.addProperty("rankId",rs.getInt("rank"));s.addProperty("rankName",rs.getString("rank_name"));s.addProperty("online","1".equals(rs.getString("online")));staffs.add(s);
    }
   }
   try(Statement q=db.createStatement();ResultSet rs=q.executeQuery("SELECT id,rank_name FROM permissions WHERE id>=3 ORDER BY id DESC")){
    while(rs.next()){JsonObject r=new JsonObject();r.addProperty("id",rs.getInt(1));r.addProperty("name",rs.getString(2));ranks.add(r);}
   }
   JsonArray volunteers=new JsonArray();
   String[][] roles={{"Pixler","PIX"},{"Builder","BUILDER1"},{"Casinopersonal","CASIL01","LZNT"},{"Preisscouts","SCOUT01"},{"Content Creator","WTM","CC01TEAM"}};
   for(String[] role:roles){JsonObject group=new JsonObject();group.addProperty("name",role[0]);JsonArray badges=new JsonArray(),members=new JsonArray();String marks="";for(int i=1;i<role.length;i++){badges.add(new JsonPrimitive(role[i]));marks+=(i>1?",":"")+"?";}
    try(PreparedStatement q=db.prepareStatement("SELECT u.id,u.username,u.look,u.motto,u.online FROM users u WHERE EXISTS(SELECT 1 FROM users_badges b WHERE b.user_id=u.id AND b.badge_code IN ("+marks+")) ORDER BY u.username")){for(int i=1;i<role.length;i++)q.setString(i,role[i]);try(ResultSet rs=q.executeQuery()){while(rs.next()){JsonObject member=new JsonObject();member.addProperty("id",rs.getInt("id"));member.addProperty("username",rs.getString("username"));member.addProperty("look",rs.getString("look"));member.addProperty("motto",rs.getString("motto"));member.addProperty("online",rs.getBoolean("online"));member.add("appearance",server.websocket.incoming.common.profile.ProfileAppearance.read(db,rs.getInt("id")));members.add(member);}}}
    group.add("badges",badges);group.add("members",members);group.addProperty("count",members.size());volunteers.add(group);
   }
   result.data.addProperty("volunteers",volunteers.toString());
   result.data.addProperty("staffs",staffs.toString());result.data.addProperty("ranks",ranks.toString());
  }catch(SQLException e){Main.getLogger().error("Staff directory failed",e);result.data.addProperty("error","Die Mitarbeiter konnten nicht geladen werden.");}
  client.sendMessage(result);
 }
}
