package server.websocket.incoming.common.profile;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.Habbo;
import com.google.gson.*;
import server.websocket.client.WebSocketClient;
import server.websocket.outgoing.common.misc.DataComposer;
import java.util.*;
import java.sql.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** Authenticated live voice signaling. Media uses encrypted WebRTC with direct ICE and our authenticated TURN relay. */
public final class ProfileVoiceChannels {
 private static final Map<Integer,Member> members=new HashMap<>();
 private static final Map<Integer,Channel> channels=new LinkedHashMap<>();
 private static boolean loaded=false;
 private static final class Channel { int id,owner,limit; long emptyAfter=System.currentTimeMillis()+75000; String name; Channel(int i,int o,String n,int l){id=i;owner=o;name=n;limit=l;} }
 private static final class Member {
  final int id; final WebSocketClient client; String session=UUID.randomUUID().toString();
  int channel=0,rank=0,budget=0; long seen=System.currentTimeMillis(),window=seen,lastEdit=0; boolean muted=false,deaf=false;
  Member(int i,WebSocketClient c){id=i;client=c;}
 }
 public static synchronized void handle(WebSocketClient client,String action,String text){
  try {
   if(client.getAccount()==null)throw new IllegalArgumentException("Bitte erneut anmelden.");
   int id=client.getAccount().getId();
   Habbo habbo=live(id);
   if(habbo==null){Member old=members.get(id);if(old!=null&&old.client==client){send(old,event("left"));remove(old);broadcast();}throw new IllegalArgumentException("Bitte zuerst ins Hotel einchecken.");}
   if(text==null||text.length()>24000)throw new IllegalArgumentException("Ungültige Sprachanfrage.");
   JsonObject req=new JsonParser().parse(text).getAsJsonObject();
   load(); prune();
   EventAdministration.Settings settings=EventAdministration.settings();
   Member m=members.get(id);
   if("voiceChannelList".equals(action)&& (m==null||m.client!=client)){
    if(m!=null){send(m,event("replaced"));remove(m);}
    m=new Member(id,client);members.put(id,m);
    final Member registered=m;
    client.getChannel().closeFuture().addListener(f->{synchronized(ProfileVoiceChannels.class){if(members.get(id)==registered){remove(registered);broadcast();}}});
   }
   if(m==null||m.client!=client)throw new IllegalArgumentException("Bitte die Sprachkanäle neu verbinden.");
   long now=System.currentTimeMillis();m.seen=now;
   if(now-m.window>10000){m.window=now;m.budget=0;}
   if(++m.budget>1200)throw new IllegalArgumentException("Zu viele Sprachanfragen. Bitte kurz warten.");
   if("voiceChannelList".equals(action)){m.rank=rank(id);sendState(m);return;}
   if("voiceChannelLeave".equals(action)){leave(m);JsonObject left=event("left");left.addProperty("requested",true);send(m,left);broadcast();return;}
   if("voiceChannelJoin".equals(action)){
    if(!settings.voiceEnabled)throw new IllegalArgumentException("Sprachchat ist momentan deaktiviert.");
    if(EventAdministration.excluded(id))throw new IllegalArgumentException("Dein Sprachchat-Zugang ist gesperrt.");
    if(habbo.getHabboStats().getOnlineMinutes(Emulator.getIntUnixTimestamp())*60L<settings.minOnlineSeconds)throw new IllegalArgumentException("Du brauchst mehr Hotel-Onlinezeit für den Sprachchat.");
    Channel channel=channels.get(req.get("channelId").getAsInt());
    if(channel==null)throw new IllegalArgumentException("Dieser Kanal existiert nicht mehr.");
    if(!habbo.getHabboStats().allowTalk())throw new IllegalArgumentException("Du bist momentan stummgeschaltet.");
    if(members.values().stream().filter(p->p.id!=id&&p.channel==channel.id).count()>=Math.min(channel.limit,settings.maxParticipants))throw new IllegalArgumentException("Dieser Kanal ist voll.");
    JsonArray ice=iceServers(id); // Fail before changing membership if relay is not configured.
    leave(m,m.channel!=channel.id);m.session=UUID.randomUUID().toString();m.channel=channel.id;m.deaf=req.has("deaf")&&req.get("deaf").getAsBoolean();m.muted=m.deaf||(req.has("muted")&&req.get("muted").getAsBoolean());
    JsonObject joined=event("joined");joined.addProperty("channelId",channel.id);joined.addProperty("selfId",id);joined.addProperty("session",m.session);joined.add("iceServers",ice);
    JsonArray peers=new JsonArray();for(Member peer:members.values())if(peer.channel==m.channel&&peer!=m)peers.add(person(peer));joined.add("peers",peers);send(m,joined);
    broadcast();return;
   }
   if("voiceChannelSignal".equals(action)){
    if(!settings.voiceEnabled||EventAdministration.excluded(id))throw new IllegalArgumentException("Sprachchat-Zugang gesperrt.");
    Member target=members.get(req.get("target").getAsInt());
    if(m.channel==0||target==null||target==m||target.channel!=m.channel||!target.session.equals(req.get("targetSession").getAsString()))throw new IllegalArgumentException("Der Gesprächspartner hat den Kanal verlassen.");
    JsonObject signal=req.getAsJsonObject("signal");
    String type=signal.get("type").getAsString();
    if(!Arrays.asList("offer","answer","candidate").contains(type))throw new IllegalArgumentException("Ungültige Verbindung.");
    if((type.equals("offer")||type.equals("answer"))&&(!signal.has("sdp")||signal.get("sdp").getAsString().length()>20000))throw new IllegalArgumentException("Ungültige Verbindung.");
    JsonObject packet=event("signal");packet.addProperty("from",id);packet.addProperty("session",m.session);packet.addProperty("channelId",m.channel);packet.add("signal",signal);send(target,packet);return;
   }
   if("voiceChannelStatus".equals(action)){m.muted=req.get("muted").getAsBoolean();m.deaf=req.get("deaf").getAsBoolean();broadcast();return;}
   if("voiceChannelCreate".equals(action)||"voiceChannelEdit".equals(action)||"voiceChannelDelete".equals(action)){
    if(!settings.voiceEnabled||EventAdministration.excluded(id))throw new IllegalArgumentException("Sprachchat-Zugang gesperrt.");
    if(now-m.lastEdit<1500)throw new IllegalArgumentException("Bitte kurz warten.");m.lastEdit=now;
    m.rank=rank(id);
    Channel channel=action.equals("voiceChannelCreate")?null:channels.get(req.get("channelId").getAsInt());
    if(channel!=null&&channel.id==1)throw new IllegalArgumentException("Die Lobby kann nicht bearbeitet werden.");
    if(channel!=null&&!canManage(channel,id,m.rank))throw new IllegalArgumentException("Du kannst nur deinen eigenen Kanal bearbeiten.");
    if(channel==null&&!action.equals("voiceChannelCreate"))throw new IllegalArgumentException("Kanal nicht gefunden.");
    if(action.equals("voiceChannelDelete")){
     if(channel.id==1)throw new IllegalArgumentException("Die Lobby bleibt bestehen.");
     try(Connection c=db();PreparedStatement p=c.prepareStatement("DELETE FROM website_voice_channels WHERE id=?")){p.setInt(1,channel.id);p.executeUpdate();}
     for(Member peer:new ArrayList<>(members.values()))if(peer.channel==channel.id){leave(peer);send(peer,event("left"));}
     channels.remove(channel.id);broadcast();return;
    }
    String name=req.get("name").getAsString().trim();int limit=req.get("limit").getAsInt();
    if(name.length()<2||name.length()>settings.maxNameLength||name.chars().anyMatch(Character::isISOControl)||limit<2||limit>settings.maxParticipants)throw new IllegalArgumentException("Kanalname: 2–"+settings.maxNameLength+" Zeichen. Teilnehmer: 2–"+settings.maxParticipants+".");
    if(channels.values().stream().anyMatch(ch->ch.name.equalsIgnoreCase(name)&&ch!=channel))throw new IllegalArgumentException("Dieser Kanalname ist schon vergeben.");
    if(channel==null){
     if(channels.size()>=settings.maxChannels||channels.values().stream().anyMatch(ch->ch.owner==id)&&m.rank<7)throw new IllegalArgumentException("Du kannst einen eigenen Kanal erstellen. Insgesamt sind "+settings.maxChannels+" Kanäle möglich.");
     try(Connection c=db();PreparedStatement p=c.prepareStatement("INSERT INTO website_voice_channels(owner_id,name,member_limit) VALUES(?,?,?)",Statement.RETURN_GENERATED_KEYS)){p.setInt(1,id);p.setString(2,name);p.setInt(3,limit);p.executeUpdate();try(ResultSet r=p.getGeneratedKeys()){r.next();int cid=r.getInt(1);channels.put(cid,new Channel(cid,id,name,limit));JsonObject created=event("created");created.addProperty("channelId",cid);send(m,created);}}
    }else{
     if(members.values().stream().filter(p->p.channel==channel.id).count()>limit)throw new IllegalArgumentException("Es sind bereits mehr Teilnehmer im Kanal.");
     try(Connection c=db();PreparedStatement p=c.prepareStatement("UPDATE website_voice_channels SET name=?,member_limit=? WHERE id=?")){p.setString(1,name);p.setInt(2,limit);p.setInt(3,channel.id);p.executeUpdate();}channel.name=name;channel.limit=limit;
    }
    broadcast();return;
   }
   if("voiceChannelModerate".equals(action)){Member target=members.get(req.get("target").getAsInt());if(target==null||m.channel==0||target.channel!=m.channel)throw new IllegalArgumentException("Teilnehmer nicht in deinem Kanal.");EventAdministration.moderate(id,target.id);sendState(m);return;}
   if("voiceChannelKick".equals(action)){
    m.rank=rank(id);Member target=members.get(req.get("target").getAsInt());Channel ch=channels.get(m.channel);
    if(target==null||target.id==id||rank(target.id)>=Math.max(7,m.rank)||ch==null||target.channel!=m.channel||(ch.owner!=id&&m.rank<settings.moderationRank))throw new IllegalArgumentException("Du kannst diesen Teilnehmer nicht entfernen.");
    leave(target);JsonObject kick=event("kicked");send(target,kick);broadcast();return;
   }
   throw new IllegalArgumentException("Unbekannte Sprachfunktion.");
  }catch(Exception e){JsonObject error=event("error");error.addProperty("operation",action);error.addProperty("error",e instanceof IllegalArgumentException?e.getMessage():"Sprachkanäle sind gerade nicht verfügbar. Bitte die Server-Einbindung prüfen.");client.sendMessage(new DataComposer("voiceChannels",error.toString()));}
 }
 public static synchronized void applyAdministration()throws SQLException{var settings=EventAdministration.settings();for(Member m:new ArrayList<>(members.values()))if(m.channel>0&&(!settings.voiceEnabled||EventAdministration.excluded(m.id))){leave(m);JsonObject packet=event("kicked");packet.addProperty("error","Sprachchat-Zugang gesperrt.");send(m,packet);}broadcast();}
 private static boolean canManage(Channel ch,int userId,int rank)throws SQLException{return ch.id!=1&&(ch.owner==userId||rank>=EventAdministration.settings().moderationRank);}
 private static Connection db()throws SQLException{return Emulator.getDatabase().getDataSource().getConnection();}
 private static int rank(int id)throws SQLException{try(Connection c=db();PreparedStatement p=c.prepareStatement("SELECT rank FROM users WHERE id=?")){p.setInt(1,id);try(ResultSet r=p.executeQuery()){return r.next()?r.getInt(1):0;}}}
 private static void load()throws SQLException{if(loaded)return;try(Connection c=db();PreparedStatement p=c.prepareStatement("DELETE FROM website_voice_channels WHERE id<>1")){p.executeUpdate();}try(Connection c=db();PreparedStatement p=c.prepareStatement("SELECT id,owner_id,name,member_limit FROM website_voice_channels ORDER BY id");ResultSet r=p.executeQuery()){while(r.next())channels.put(r.getInt(1),new Channel(r.getInt(1),r.getInt(2),r.getString(3),r.getInt(4)));}loaded=true;}
 private static Habbo live(int id){Habbo h=Emulator.getGameEnvironment().getHabboManager().getHabbo(id);return h!=null&&h.isOnline()&&h.getClient()!=null&&h.getClient().getChannel()!=null&&h.getClient().getChannel().isActive()?h:null;}
 private static void prune(){boolean changed=false;for(Member m:new ArrayList<>(members.values()))if(!m.client.getChannel().isActive()||live(m.id)==null||System.currentTimeMillis()-m.seen>75000){send(m,event("left"));remove(m);changed=true;}for(Channel ch:new ArrayList<>(channels.values()))if(deleteIfEmpty(ch))changed=true;if(changed)broadcast();}
 private static void remove(Member m){leave(m);members.remove(m.id,m);}
 private static void leave(Member m){leave(m,true);}
 private static void leave(Member m,boolean removeEmpty){if(m.channel==0)return;int old=m.channel;m.channel=0;JsonObject left=event("peerLeft");left.addProperty("id",m.id);left.addProperty("session",m.session);for(Member peer:members.values())if(peer.channel==old)send(peer,left);Channel ch=channels.get(old);if(removeEmpty&&ch!=null){ch.emptyAfter=0;deleteIfEmpty(ch);}}
 /** Pending creations get time for microphone permission; occupied channels disappear on the last leave. */
 private static boolean deleteIfEmpty(Channel ch){
  if(ch.id==1||System.currentTimeMillis()<ch.emptyAfter||members.values().stream().anyMatch(m->m.channel==ch.id))return false;
  try(Connection c=db();PreparedStatement p=c.prepareStatement("DELETE FROM website_voice_channels WHERE id=?")){
   p.setInt(1,ch.id);p.executeUpdate();channels.remove(ch.id);return true;
  }catch(SQLException error){return false;} // Keep it visible and retry on the next list/heartbeat if storage is unavailable.
 }
 private static JsonObject person(Member m){JsonObject p=new JsonObject();Habbo h=live(m.id);p.addProperty("id",m.id);p.addProperty("session",m.session);p.addProperty("name",h==null?"Offline":h.getHabboInfo().getUsername());p.addProperty("figure",h==null?"":h.getHabboInfo().getLook());p.addProperty("muted",m.muted);p.addProperty("deaf",m.deaf);return p;}
 private static void sendState(Member m){JsonObject state=event("state");state.addProperty("selfId",m.id);state.addProperty("rank",m.rank);int maximum=8;try{var config=EventAdministration.settings();maximum=config.maxParticipants;state.add("settings",EventAdministration.JSON.toJsonTree(config));}catch(SQLException ignored){}state.addProperty("channelId",m.channel);JsonArray list=new JsonArray();for(Channel ch:channels.values()){JsonObject c=new JsonObject();c.addProperty("id",ch.id);c.addProperty("name",ch.name);c.addProperty("owner",ch.owner);c.addProperty("limit",Math.min(ch.limit,maximum));JsonArray users=new JsonArray();for(Member p:members.values())if(p.channel==ch.id)users.add(person(p));c.add("members",users);list.add(c);}state.add("channels",list);send(m,state);}
 private static void broadcast(){for(Member m:members.values())sendState(m);}
 private static JsonObject event(String action){JsonObject o=new JsonObject();o.addProperty("action",action);return o;}
 private static void send(Member m,JsonObject packet){if(m.client.getChannel().isActive())m.client.sendMessage(new DataComposer("voiceChannels",packet.toString()));}
 static JsonArray iceServers(int id)throws Exception{
  Properties config=new Properties();try(var reader=Files.newBufferedReader(Path.of("/etc/habbix/voice.properties"))){config.load(reader);}
  String host=config.getProperty("host","");String secret=config.getProperty("secret","");
  if(!host.matches("[a-zA-Z0-9.-]+")||secret.length()<32)throw new IllegalArgumentException("Der Sprachserver ist noch nicht eingerichtet.");
  String user=(System.currentTimeMillis()/1000+86400)+":"+id;Mac mac=Mac.getInstance("HmacSHA1");mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8),"HmacSHA1"));
  JsonObject turn=new JsonObject();JsonArray urls=new JsonArray();urls.add("turn:"+host+":3479?transport=udp");urls.add("turn:"+host+":3479?transport=tcp");turn.add("urls",urls);turn.addProperty("username",user);turn.addProperty("credential",Base64.getEncoder().encodeToString(mac.doFinal(user.getBytes(StandardCharsets.UTF_8))));JsonArray result=new JsonArray();JsonObject stun=new JsonObject();stun.addProperty("urls","stun:"+host+":3479");result.add(stun);result.add(turn);return result;
 }
}
