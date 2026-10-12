package server.websocket.incoming.common.profile;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.items.interactions.InteractionMuteArea;
import com.eu.habbo.habbohotel.permissions.Permission;
import com.eu.habbo.networking.gameserver.decoders.GameMessageHandler;
import com.google.gson.*;
import server.websocket.client.WebSocketClient;
import server.websocket.outgoing.common.misc.DataComposer;
import java.util.Base64;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/** Ephemeral room audio, delivered only to authenticated, present room members. */
public final class ProfileRoomVoice {
 private static final ConcurrentHashMap<Integer,WebSocketClient> listeners=new ConcurrentHashMap<>();
 private static final ConcurrentHashMap<Integer,Stamp> sent=new ConcurrentHashMap<>();
 private static final int MAX_BYTES=384*1024;
 private static final class Stamp { final long time; final String request; Stamp(long t,String r){time=t;request=r;} }

 public static void handle(WebSocketClient client,String action,String text){
  String requestId="";
  try {
   if(client.getAccount()==null)throw new IllegalArgumentException("Bitte erneut einchecken.");
   if(text==null||text.length()>530000)throw new IllegalArgumentException("Die Aufnahme ist zu groß.");
   JsonObject request=new JsonParser().parse(text).getAsJsonObject();
   requestId=request.has("requestId")?request.get("requestId").getAsString():"";
   if(!requestId.matches("[a-zA-Z0-9-]{8,80}"))throw new IllegalArgumentException("Ungültige Anfrage.");
   int author=client.getAccount().getId(),roomId=request.get("roomId").getAsInt();
   Habbo habbo=Emulator.getGameEnvironment().getHabboManager().getHabbo(author);
   if(habbo==null||habbo.getClient()==null||habbo.getClient().getChannel()==null)throw new IllegalArgumentException("Bitte einen Raum betreten.");
   var context=habbo.getClient().getChannel().pipeline().context(GameMessageHandler.class);
   if(context==null)throw new IllegalArgumentException("Die Hotel-Verbindung ist noch nicht bereit.");
   final String key=requestId;
   java.util.concurrent.Callable<Void> task=()->{
    Room room=currentRoom(habbo,roomId);
    if("voiceSubscribe".equals(action)){
     WebSocketClient previous=listeners.put(author,client);
     if(previous!=client)client.getChannel().closeFuture().addListener(future->listeners.remove(author,client));
     reply(client,"subscribed",key,null);return null;
    }
    if(!"voiceSend".equals(action)||listeners.get(author)!=client)throw new IllegalArgumentException("Die Sprachverbindung ist noch nicht bereit.");
    if(!habbo.getHabboStats().allowTalk()||room.isMuted(habbo)||(room.isMuted()&&!room.hasRights(habbo)))throw new IllegalArgumentException("Du kannst momentan keine Sprachnachricht senden.");
    if(habbo.getRoomUnit().isInvisible())throw new IllegalArgumentException("Unsichtbare Benutzer können keine Sprachnachricht senden.");
    if(!habbo.hasPermission(Permission.ACC_NOMUTE))for(var area:room.getRoomSpecialTypes().getItemsOfType(InteractionMuteArea.class)){
     if(((InteractionMuteArea)area).inSquare(habbo.getRoomUnit().getCurrentLocation()))throw new IllegalArgumentException("In diesem Bereich kannst du keine Sprachnachricht senden.");
    }
    long now=System.currentTimeMillis();
    Stamp previous=sent.get(author);
    if(previous!=null&&previous.request.equals(key)){reply(client,"sent",key,null);return null;}
    if(previous!=null&&now-previous.time<8000)throw new IllegalArgumentException("Bitte warte kurz vor der nächsten Sprachnachricht.");
    double duration=request.get("duration").getAsDouble();
    if(!Double.isFinite(duration)||duration<0.3||duration>60.5)throw new IllegalArgumentException("Eine Aufnahme darf höchstens 60 Sekunden dauern.");
    String mime=request.get("mime").getAsString().toLowerCase(java.util.Locale.ROOT);
    if(!mime.equals("audio/webm")&&!mime.equals("audio/webm;codecs=opus")&&!mime.equals("audio/ogg")&&!mime.equals("audio/ogg;codecs=opus")&&!mime.equals("audio/mp4"))throw new IllegalArgumentException("Dieses Audioformat wird nicht unterstützt.");
    String encoded=request.get("audio").getAsString();
    if(encoded.length()>MAX_BYTES*4/3+4)throw new IllegalArgumentException("Die Aufnahme ist zu groß.");
    byte[] bytes=Base64.getDecoder().decode(encoded);
    validateAudio(bytes,mime);
    JsonObject message=new JsonObject();
    message.addProperty("action","message");message.addProperty("id",UUID.randomUUID().toString());message.addProperty("roomId",roomId);
    message.addProperty("userId",author);message.addProperty("roomIndex",habbo.getRoomUnit().getId());
    message.addProperty("username",habbo.getHabboInfo().getUsername());message.addProperty("figure",habbo.getHabboInfo().getLook());
    message.addProperty("mime",mime);message.addProperty("audio",encoded);message.addProperty("duration",Math.min(60,duration));
    sent.put(author,new Stamp(now,key));
    sent.entrySet().removeIf(entry->now-entry.getValue().time>120000);
    DataComposer packet=new DataComposer("roomVoice",message.toString());
    listeners.forEach((id,target)->{
     if(!target.getChannel().isActive()||target.getAccount()==null||target.getAccount().getId()!=id){listeners.remove(id,target);return;}
     Habbo receiver=Emulator.getGameEnvironment().getHabboManager().getHabbo(id);
     if(receiver==null||receiver.getHabboInfo().getCurrentRoom()!=room||!receiver.getRoomUnit().isInRoom()||receiver.getHabboStats().userIgnored(author))return;
     target.sendMessage(packet);
    });
    reply(client,"sent",key,null);return null;
   };
   if(context.executor().inEventLoop())task.call();else context.executor().submit(task).get(15,TimeUnit.SECONDS);
  } catch(Exception e){
   Throwable cause=e instanceof java.util.concurrent.ExecutionException?e.getCause():e;
   String reason=cause instanceof IllegalArgumentException?cause.getMessage():"Die Sprachnachricht konnte nicht gesendet werden. Bitte erneut verbinden.";
   reply(client,"error",requestId,reason);
  }
 }

 private static Room currentRoom(Habbo habbo,int id){
  Room room=habbo.getHabboInfo().getCurrentRoom();
  if(!habbo.isOnline()||room==null||room.getId()!=id||!habbo.getRoomUnit().isInRoom())throw new IllegalArgumentException("Bitte einen Raum betreten. Beim Raumwechsel wird die Aufnahme verworfen.");
  return room;
 }
 static void validateAudio(byte[] bytes,String mime){
  if(bytes.length<128||bytes.length>MAX_BYTES)throw new IllegalArgumentException("Die Aufnahme ist leer oder zu groß.");
  boolean valid=mime.startsWith("audio/webm")?(bytes[0]&255)==0x1a&&(bytes[1]&255)==0x45&&(bytes[2]&255)==0xdf&&(bytes[3]&255)==0xa3:
   mime.startsWith("audio/ogg")?bytes[0]=='O'&&bytes[1]=='g'&&bytes[2]=='g'&&bytes[3]=='S':bytes[4]=='f'&&bytes[5]=='t'&&bytes[6]=='y'&&bytes[7]=='p';
  if(!valid)throw new IllegalArgumentException("Ungültige Audiodatei.");
 }
 private static void reply(WebSocketClient client,String action,String key,String error){
  JsonObject data=new JsonObject();data.addProperty("action",action);data.addProperty("requestId",key);if(error!=null)data.addProperty("error",error);
  client.sendMessage(new DataComposer("roomVoice",data.toString()));
 }
}
