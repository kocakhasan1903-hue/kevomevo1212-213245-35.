package server.websocket.incoming.common.community;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.misc.DataComposer;
public class LottoEvent extends IncomingWebMessage<LottoEvent.Request>{
 private static com.google.gson.JsonObject landing() throws Exception{
  com.google.gson.JsonObject data=new com.google.gson.JsonObject();com.google.gson.JsonArray photos=new com.google.gson.JsonArray(),leaders=new com.google.gson.JsonArray();
  try(java.sql.Connection c=com.eu.habbo.Emulator.getDatabase().getDataSource().getConnection()){
   try(java.sql.PreparedStatement p=c.prepareStatement("SELECT cw.id,cw.room_id,cw.timestamp,cw.url,u.id AS owner_id,u.username,u.look,u.motto,r.name AS room_name FROM camera_web cw JOIN users u ON u.id=cw.user_id LEFT JOIN rooms r ON r.id=cw.room_id ORDER BY cw.id DESC LIMIT 3");java.sql.ResultSet rs=p.executeQuery()){
    while(rs.next()){com.google.gson.JsonObject row=new com.google.gson.JsonObject();row.addProperty("id",rs.getInt("id"));row.addProperty("roomId",rs.getInt("room_id"));row.addProperty("date",rs.getLong("timestamp"));row.addProperty("url",rs.getString("url"));row.addProperty("roomName",rs.getString("room_name"));addUser(c,rs,row);photos.add(row);}
   }
   try(java.sql.PreparedStatement p=c.prepareStatement("SELECT u.id AS owner_id,u.username,u.look,u.motto,uc.amount FROM users_currency uc JOIN users u ON u.id=uc.user_id WHERE uc.type=104 AND uc.amount>0 ORDER BY uc.amount DESC,u.id ASC LIMIT 15");java.sql.ResultSet rs=p.executeQuery()){
    while(rs.next()){com.google.gson.JsonObject row=new com.google.gson.JsonObject();row.addProperty("eventstars",rs.getLong("amount"));addUser(c,rs,row);leaders.add(row);}
   }
  }
  data.add("photos",photos);data.add("leaders",leaders);return data;
 }
 private static void addUser(java.sql.Connection c,java.sql.ResultSet rs,com.google.gson.JsonObject row)throws Exception{
  int id=rs.getInt("owner_id");row.addProperty("userId",id);row.addProperty("username",rs.getString("username"));row.addProperty("figure",rs.getString("look"));row.addProperty("motto",rs.getString("motto"));row.add("appearance",server.websocket.incoming.common.profile.ProfileAppearance.read(c,id));
 }
 public LottoEvent(){super(Request.class);}
 @Override public void handle(WebSocketClient client,Request r){
  if(client.getAccount()!=null&&r!=null&&"landing".equals(r.action)){
   try{client.sendMessage(new DataComposer("hotelLandingData",landing().toString()));}catch(Exception e){server.Main.getLogger().error("Hotel landing request failed",e);client.sendMessage(new DataComposer("hotelLandingError","Fotos und Eventsterne konnten nicht geladen werden."));}return;
  }
  if(client.getAccount()==null||r==null||!"get".equals(r.action)){client.sendMessage(new DataComposer("lottoError","Bitte erneut anmelden oder die Seite neu laden."));return;}
  try{client.sendMessage(new DataComposer("lottoData",HourlyLotto.state(client.getAccount().getId()).toString()));}catch(Exception e){server.Main.getLogger().error("Lotto request failed",e);client.sendMessage(new DataComposer("lottoError","Lotto ist gerade nicht erreichbar. Dein Losstatus wird beim nÃ¤chsten Laden geprÃ¼ft."));}
 }
 static class Request{String action;}
}
