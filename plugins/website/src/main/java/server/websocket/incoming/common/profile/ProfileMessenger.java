package server.websocket.incoming.common.profile;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.plugin.events.users.friends.UserFriendChatEvent;
import com.google.gson.*;
import server.websocket.client.WebSocketClient;
import server.websocket.outgoing.common.misc.DataComposer;
import java.sql.*;
import java.util.*;
import java.io.*;
import javax.imageio.*;
import javax.imageio.stream.ImageInputStream;

/** Authenticated direct messages. Media never receives a public URL. */
public final class ProfileMessenger {
 private static final Map<Integer,WebSocketClient> clients=new HashMap<>();
 private static final Map<Integer,Upload> uploads=new HashMap<>();
 private static boolean schema;
 private static final int CHUNK=192*1024, MAX_GIF=2*1024*1024;
 private static final String COLS="id,sender_id,recipient_id,body,mime,duration,created_at,delivered_at,read_at,byte_size";
 private static class Upload {
  final String id,mime; final int peer,size; final double duration; final long started=System.currentTimeMillis();
  final ByteArrayOutputStream data=new ByteArrayOutputStream();
  Upload(String id,String mime,int peer,int size,double duration){this.id=id;this.mime=mime;this.peer=peer;this.size=size;this.duration=duration;}
 }
 private static void ensure(Connection c)throws SQLException{
  if(schema)return;
  try(Statement s=c.createStatement()){s.executeUpdate("CREATE TABLE IF NOT EXISTS habbix_direct_messages (id CHAR(36) PRIMARY KEY,sender_id INT NOT NULL,recipient_id INT NOT NULL,body VARCHAR(255) NOT NULL DEFAULT '',mime VARCHAR(40) NOT NULL DEFAULT '',duration DOUBLE NOT NULL DEFAULT 0,payload MEDIUMBLOB,byte_size INT NOT NULL DEFAULT 0,created_at BIGINT NOT NULL,delivered_at BIGINT NOT NULL DEFAULT 0,read_at BIGINT NOT NULL DEFAULT 0,INDEX dm_sender(sender_id,created_at),INDEX dm_recipient(recipient_id,created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");}
  schema=true;
 }
 private static PreparedStatement stmt(Connection c,String sql,Object...args)throws SQLException{
  PreparedStatement p=c.prepareStatement(sql);for(int i=0;i<args.length;i++)p.setObject(i+1,args[i]);return p;
 }
 private static JsonObject row(ResultSet r)throws SQLException{
  JsonObject o=new JsonObject();o.addProperty("id",r.getString("id"));o.addProperty("sender",r.getInt("sender_id"));o.addProperty("recipient",r.getInt("recipient_id"));o.addProperty("body",r.getString("body"));o.addProperty("mime",r.getString("mime"));o.addProperty("duration",r.getDouble("duration"));o.addProperty("created",r.getLong("created_at"));o.addProperty("delivered",r.getLong("delivered_at"));o.addProperty("read",r.getLong("read_at"));o.addProperty("size",r.getInt("byte_size"));return o;
 }
 private static void push(int user,JsonObject data){WebSocketClient c=clients.get(user);if(c!=null&&c.getAccount()!=null&&c.getAccount().getId()==user&&c.getChannel().isActive())c.sendMessage(new DataComposer("directChat",data.toString()));}
 private static void publish(JsonObject message){JsonObject event=new JsonObject();event.addProperty("action","message");event.add("message",message);push(message.get("sender").getAsInt(),event);push(message.get("recipient").getAsInt(),event);}
 private static Habbo validatePeer(Connection c,int user,int peer)throws Exception{
  Habbo actor=Emulator.getGameEnvironment().getHabboManager().getHabbo(user);
  if(actor==null||!actor.isOnline()||peer<=0||peer==user||actor.getMessenger().getFriend(peer)==null)throw new IllegalArgumentException("Du kannst nur deinen Freunden schreiben.");
  try(PreparedStatement p=stmt(c,"SELECT 1 FROM users_ignored WHERE (user_id=? AND target_id=?) OR (user_id=? AND target_id=?) LIMIT 1",user,peer,peer,user);ResultSet r=p.executeQuery()){if(r.next())throw new IllegalArgumentException("Diese Unterhaltung ist nicht verfügbar.");}
  return actor;
 }
 private static JsonObject existing(Connection c,int user,String id)throws Exception{
  try(PreparedStatement p=stmt(c,"SELECT "+COLS+" FROM habbix_direct_messages WHERE id=? AND sender_id=?",id,user);ResultSet r=p.executeQuery()){return r.next()?row(r):null;}
 }
 private static JsonObject save(Connection c,int user,int peer,String id,String body,String mime,double duration,byte[] bytes)throws Exception{
  if(!id.matches("[a-f0-9-]{36}"))throw new IllegalArgumentException("Ungültige Nachrichten-ID.");
  JsonObject old=existing(c,user,id);if(old!=null)return old;
  Habbo actor=validatePeer(c,user,peer);
  if(!actor.getHabboStats().allowTalk())throw new IllegalArgumentException("Du kannst momentan keine Nachrichten senden.");
  try(PreparedStatement p=stmt(c,"SELECT COUNT(*),COALESCE(SUM(byte_size),0),MAX(created_at) FROM habbix_direct_messages WHERE sender_id=? AND created_at>?",user,System.currentTimeMillis()-3600000);ResultSet r=p.executeQuery()){
   r.next();if(r.getInt(1)>=500||r.getLong(2)+(bytes==null?0:bytes.length)>20*1024*1024||System.currentTimeMillis()-r.getLong(3)<750)throw new IllegalArgumentException("Bitte warte vor der nächsten Nachricht.");
  }
  if(mime.isEmpty()){
   body=body.trim();if(body.isEmpty()||body.length()>255)throw new IllegalArgumentException("Bitte 1 bis 255 Zeichen eingeben.");
   if(Emulator.getPluginManager().fireEvent(new UserFriendChatEvent(actor,actor.getMessenger().getFriend(peer),body)).isCancelled())throw new IllegalArgumentException("Die Nachricht wurde nicht gesendet.");
  }
  try(PreparedStatement p=stmt(c,"INSERT INTO habbix_direct_messages(id,sender_id,recipient_id,body,mime,duration,payload,byte_size,created_at) VALUES(?,?,?,?,?,?,?,?,?)",id,user,peer,body,mime,duration,bytes,bytes==null?0:bytes.length,System.currentTimeMillis())){p.executeUpdate();}
  JsonObject message=existing(c,user,id);publish(message);return message;
 }
 static void validateMedia(byte[] bytes,String mime,double duration)throws Exception{
  if("image/gif".equals(mime)){
   if(bytes.length<14||bytes.length>MAX_GIF||bytes[0]!='G'||bytes[1]!='I'||bytes[2]!='F')throw new IllegalArgumentException("Bitte eine gültige GIF-Datei bis 2 MB auswählen.");
   try(ImageInputStream stream=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))){
    Iterator<ImageReader> readers=ImageIO.getImageReaders(stream);if(!readers.hasNext())throw new IllegalArgumentException("Ungültiges GIF.");
    ImageReader reader=readers.next();try{reader.setInput(stream);if(!"gif".equalsIgnoreCase(reader.getFormatName())||reader.getWidth(0)>1024||reader.getHeight(0)>1024||reader.getNumImages(true)>300)throw new IllegalArgumentException("GIF: maximal 1024 × 1024 Pixel und 300 Bilder.");}finally{reader.dispose();}
   }
  }else{
   if(!Arrays.asList("audio/webm","audio/webm;codecs=opus","audio/ogg","audio/ogg;codecs=opus","audio/mp4").contains(mime)||!Double.isFinite(duration)||duration<.3||duration>60.5)throw new IllegalArgumentException("Ungültige Sprachnachricht; maximal 60 Sekunden.");
   ProfileRoomVoice.validateAudio(bytes,mime);
  }
 }
 public static synchronized void handle(WebSocketClient client,String action,String text){
  String requestId="";JsonObject out=new JsonObject();
  try{
   if(client.getAccount()==null)throw new IllegalArgumentException("Bitte neu anmelden.");
   int user=client.getAccount().getId();
   if(text==null||text.length()>270000)throw new IllegalArgumentException("Anfrage zu groß.");
   JsonObject in=new JsonParser().parse(text).getAsJsonObject();requestId=in.get("requestId").getAsString();
   if(!requestId.matches("[a-zA-Z0-9-]{8,80}"))throw new IllegalArgumentException("Ungültige Anfrage.");
   uploads.entrySet().removeIf(e->System.currentTimeMillis()-e.getValue().started>180000);
   try(Connection c=Emulator.getDatabase().getDataSource().getConnection()){
    ensure(c);
    if("dmSubscribe".equals(action)){
     clients.put(user,client);client.getChannel().closeFuture().addListener(f->{synchronized(ProfileMessenger.class){if(clients.remove(user,client))uploads.remove(user);}});
     out.addProperty("action","ready");
    }else{
     if(clients.get(user)!=client)throw new IllegalArgumentException("Chatverbindung bitte erneut aufbauen.");
     out.addProperty("action",action);
     if("dmHistory".equals(action)){
      int peer=in.has("peer")?in.get("peer").getAsInt():0;
      if(peer>0)validatePeer(c,user,peer);
      long before=in.has("before")?in.get("before").getAsLong():Long.MAX_VALUE;
      String where=peer>0?"((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?))":"(sender_id=? OR recipient_id=?)";
      Object[] args=peer>0?new Object[]{user,peer,peer,user,before}:new Object[]{user,user,before};
      JsonArray list=new JsonArray();try(PreparedStatement p=stmt(c,"SELECT "+COLS+" FROM habbix_direct_messages WHERE "+where+" AND created_at<? ORDER BY created_at DESC,id DESC LIMIT 100",args);ResultSet r=p.executeQuery()){while(r.next())list.add(row(r));}out.add("messages",list);
     }else if("dmSend".equals(action))out.add("message",save(c,user,in.get("peer").getAsInt(),in.get("id").getAsString(),in.get("body").getAsString(),"",0,null));
     else if("dmDelivered".equals(action)||"dmRead".equals(action)){
      JsonArray ids=in.getAsJsonArray("ids");if(ids.size()>100)throw new IllegalArgumentException("Zu viele Bestätigungen.");
      for(JsonElement item:ids){String id=item.getAsString();boolean read="dmRead".equals(action);
       try(PreparedStatement p=stmt(c,"UPDATE habbix_direct_messages SET delivered_at=CASE WHEN delivered_at=0 THEN ? ELSE delivered_at END"+(read?",read_at=CASE WHEN read_at=0 THEN ? ELSE read_at END":"")+" WHERE id=? AND recipient_id=?",read?new Object[]{System.currentTimeMillis(),System.currentTimeMillis(),id,user}:new Object[]{System.currentTimeMillis(),id,user})){p.executeUpdate();}
       try(PreparedStatement p=stmt(c,"SELECT "+COLS+" FROM habbix_direct_messages WHERE id=? AND recipient_id=?",id,user);ResultSet r=p.executeQuery()){if(r.next())publish(row(r));}
      }
     }else if("dmUploadStart".equals(action)){
      String id=in.get("id").getAsString(),mime=in.get("mime").getAsString();int peer=in.get("peer").getAsInt(),size=in.get("size").getAsInt();double duration=in.get("duration").getAsDouble();validatePeer(c,user,peer);
      if(!id.matches("[a-f0-9-]{36}")||size<(mime.equals("image/gif")?14:128)||size>(mime.equals("image/gif")?MAX_GIF:384*1024)||(!mime.equals("image/gif")&&!mime.startsWith("audio/")))throw new IllegalArgumentException("Datei zu groß oder ungültig.");
      if(uploads.size()>=20&&!uploads.containsKey(user))throw new IllegalArgumentException("Upload ausgelastet.");
      uploads.put(user,new Upload(id,mime,peer,size,duration));
     }else if("dmUploadChunk".equals(action)||"dmUploadFinish".equals(action)){
      Upload u=uploads.get(user);if(u==null||!u.id.equals(in.get("id").getAsString()))throw new IllegalArgumentException("Upload abgelaufen.");
      if("dmUploadChunk".equals(action)){
       byte[] bytes=Base64.getDecoder().decode(in.get("data").getAsString());if(bytes.length>CHUNK||in.get("offset").getAsInt()!=u.data.size()||u.data.size()+bytes.length>u.size)throw new IllegalArgumentException("Ungültiger Upload-Teil.");u.data.write(bytes);
      }else{
       if(u.data.size()!=u.size)throw new IllegalArgumentException("Upload unvollständig.");byte[] bytes=u.data.toByteArray();validateMedia(bytes,u.mime,u.duration);out.add("message",save(c,user,u.peer,u.id,"",u.mime,u.duration,bytes));uploads.remove(user);
      }
     }else if("dmMedia".equals(action)){
      int offset=in.get("offset").getAsInt();if(offset<0)throw new IllegalArgumentException("Ungültiger Dateiabschnitt.");
      try(PreparedStatement p=stmt(c,"SELECT mime,byte_size,SUBSTRING(payload,?,?) FROM habbix_direct_messages WHERE id=? AND (sender_id=? OR recipient_id=?)",offset+1,CHUNK,in.get("id").getAsString(),user,user);ResultSet r=p.executeQuery()){
       if(!r.next()||offset>=r.getInt(2))throw new IllegalArgumentException("Datei nicht verfügbar.");out.addProperty("mime",r.getString(1));out.addProperty("size",r.getInt(2));out.addProperty("data",Base64.getEncoder().encodeToString(r.getBytes(3)));
      }
     }else throw new IllegalArgumentException("Unbekannte Chataktion.");
    }
   }
  }catch(Exception e){out.addProperty("error",e instanceof IllegalArgumentException?e.getMessage():"Chataktion fehlgeschlagen. Bitte erneut versuchen.");if(!(e instanceof IllegalArgumentException))server.Main.getLogger().error("Direct chat request failed",e);}
  out.addProperty("requestId",requestId);client.sendMessage(new DataComposer("directChat",out.toString()));
 }
}
