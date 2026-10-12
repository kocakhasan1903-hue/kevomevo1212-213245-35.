package server.websocket.incoming.common.profile;

import com.eu.habbo.Emulator;
import com.google.gson.*;
import java.sql.*;
import java.util.*;

/** Persistent administration shared by the event manager and live voice channels. */
public final class EventAdministration {
    static final Gson JSON=new Gson();
    public static class Settings {
        public int minimumRank=7,angelRank=7,voiceRank=7,settingsRank=7;
        public boolean voiceEnabled=true;
        public int muteSeconds=300,moderationRank=7,minOnlineSeconds=0,maxChannels=30,maxNameLength=32,maxParticipants=8;
        void validate(){for(int r:new int[]{minimumRank,angelRank,voiceRank,settingsRank,moderationRank})if(r<7||r>99)throw new IllegalArgumentException("Verwaltung ist frühestens ab Rang 7 verfügbar.");if(muteSeconds<0||muteSeconds>86400||minOnlineSeconds<0||minOnlineSeconds>31536000||maxChannels<1||maxChannels>100||maxNameLength<2||maxNameLength>64||maxParticipants<2||maxParticipants>99)throw new IllegalArgumentException("Ungültige Sprachchat-Einstellungen. Höchstens 99 Teilnehmer pro Kanal.");}
    }
    private static volatile Settings current;
    private static Connection db()throws SQLException{return Emulator.getDatabase().getDataSource().getConnection();}
    public static synchronized Settings settings()throws SQLException{
        if(current!=null)return current;
        try(Connection c=db();Statement s=c.createStatement()){
            // This optional website-owned table predates configurable name lengths.
            try(PreparedStatement p=c.prepareStatement("SELECT character_maximum_length FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='website_voice_channels' AND column_name='name'");ResultSet r=p.executeQuery()){if(r.next()&&r.getInt(1)<64)s.executeUpdate("ALTER TABLE website_voice_channels MODIFY name VARCHAR(64) NOT NULL");}
            s.executeUpdate("CREATE TABLE IF NOT EXISTS habbix_event_administration (id INT NOT NULL PRIMARY KEY,config_json TEXT NOT NULL) ENGINE=InnoDB");
            s.executeUpdate("CREATE TABLE IF NOT EXISTS habbix_voice_exclusions (user_id INT NOT NULL PRIMARY KEY,until_ms BIGINT NOT NULL,reason VARCHAR(200) NOT NULL,actor_id INT NOT NULL) ENGINE=InnoDB");
            s.executeUpdate("CREATE TABLE IF NOT EXISTS habbix_administration_audit (id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,actor_id INT NOT NULL,action VARCHAR(40) NOT NULL,details TEXT NOT NULL,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB");
            try(PreparedStatement p=c.prepareStatement("INSERT IGNORE INTO habbix_event_administration VALUES(1,?)")){p.setString(1,JSON.toJson(new Settings()));p.executeUpdate();}
            try(ResultSet r=s.executeQuery("SELECT config_json FROM habbix_event_administration WHERE id=1")){r.next();Settings next=JSON.fromJson(r.getString(1),Settings.class);next.validate();current=next;return next;}
        }
    }
    public static int rank(int user)throws SQLException{try(Connection c=db();PreparedStatement p=c.prepareStatement("SELECT rank FROM users WHERE id=?")){p.setInt(1,user);try(ResultSet r=p.executeQuery()){return r.next()?r.getInt(1):0;}}}
    static void require(int user,int minimum)throws SQLException{if(rank(user)<Math.max(7,minimum))throw new IllegalArgumentException("Diese Verwaltung ist ab Rang "+Math.max(7,minimum)+" verfügbar.");}
    public static boolean excluded(int user)throws SQLException{settings();try(Connection c=db();PreparedStatement p=c.prepareStatement("SELECT until_ms FROM habbix_voice_exclusions WHERE user_id=?")){p.setInt(1,user);try(ResultSet r=p.executeQuery()){return r.next()&&(r.getLong(1)==0||r.getLong(1)>System.currentTimeMillis());}}}
    static JsonObject handle(int user,String action,JsonObject q)throws Exception{
        Settings s=settings();require(user,s.minimumRank);JsonObject out=new JsonObject();
        if(action.startsWith("eventFishing")){
            require(user,s.angelRank);boolean found=false;
            for(var plugin:Emulator.getPluginManager().getPlugins())if(plugin.getClass().getName().equals("de.habbix.fishing.FishingPlugin")){
                try{JsonObject result=(JsonObject)plugin.getClass().getMethod("admin",int.class,JsonObject.class).invoke(plugin,user,q);out.add("fishingAdmin",result);if(result.has("notice"))out.add("notice",result.get("notice"));}
                catch(java.lang.reflect.InvocationTargetException e){Throwable cause=e.getCause();if(cause instanceof java.util.concurrent.ExecutionException&&cause.getCause()!=null)cause=cause.getCause();if(cause instanceof IllegalArgumentException)throw (IllegalArgumentException)cause;throw e;}found=true;break;
            }
            if(!found)throw new IllegalArgumentException("Das Angelpark-Plugin ist noch nicht geladen.");
        }else if(action.equals("eventAdministrationSave")){
            require(user,s.settingsRank);Settings n=JSON.fromJson(q.get("settings"),Settings.class);n.validate();save(user,n,"settings");current=n;ProfileVoiceChannels.applyAdministration();out.addProperty("notice","Einstellungen gespeichert.");
        }else if(action.equals("eventVoiceSave")){
            require(user,s.voiceRank);Settings n=JSON.fromJson(q.get("settings"),Settings.class);n.minimumRank=s.minimumRank;n.angelRank=s.angelRank;n.voiceRank=s.voiceRank;n.settingsRank=s.settingsRank;n.validate();save(user,n,"voice_settings");current=n;ProfileVoiceChannels.applyAdministration();out.addProperty("notice","Sprachchat-Einstellungen gespeichert.");
        }else if(action.equals("eventVoiceExclude")||action.equals("eventVoiceUnblock")){
            require(user,s.voiceRank);int target=q.get("userId").getAsInt();if(target<=0||target==user)throw new IllegalArgumentException("Ungültiger Benutzer.");if(rank(target)==0)throw new IllegalArgumentException("Benutzer nicht gefunden.");if(rank(target)>=rank(user))throw new IllegalArgumentException("Gleichrangige oder höhere Ränge können nicht gesperrt werden.");
            try(Connection c=db()){c.setAutoCommit(false);try{try(PreparedStatement p=c.prepareStatement(action.equals("eventVoiceUnblock")?"DELETE FROM habbix_voice_exclusions WHERE user_id=?":"INSERT INTO habbix_voice_exclusions(user_id,until_ms,reason,actor_id) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE until_ms=VALUES(until_ms),reason=VALUES(reason),actor_id=VALUES(actor_id)")){p.setInt(1,target);if(!action.equals("eventVoiceUnblock")){long until=q.has("temporary")&&q.get("temporary").getAsBoolean()&&s.muteSeconds>0?System.currentTimeMillis()+s.muteSeconds*1000L:0;p.setLong(2,until);String reason=q.has("reason")?q.get("reason").getAsString():"Sprachchat-Moderation";if(reason.length()>200)throw new IllegalArgumentException("Grund zu lang.");p.setString(3,reason);p.setInt(4,user);}p.executeUpdate();}audit(c,user,action,Integer.toString(target));c.commit();}catch(Exception e){c.rollback();throw e;}}
            ProfileVoiceChannels.applyAdministration();out.addProperty("notice",action.equals("eventVoiceUnblock")?"Sprachchat-Sperre aufgehoben.":"Sprachchat-Zugang gesperrt.");
        }else if(!action.equals("eventAdministration"))throw new IllegalArgumentException("Unbekannte Verwaltungsfunktion.");
        out.add("administration",state(user));return out;
    }
    public static void moderate(int user,int target)throws Exception{Settings s=settings();require(user,s.moderationRank);JsonObject q=new JsonObject();q.addProperty("userId",target);q.addProperty("temporary",true);q.addProperty("reason","Sprachchat-Stummschaltung");exclude(user,target,q,"eventVoiceExclude",s);}
    private static void exclude(int user,int target,JsonObject q,String action,Settings s)throws Exception{require(user,s.moderationRank);if(target<=0||target==user||rank(target)==0||rank(target)>=rank(user))throw new IllegalArgumentException("Dieser Benutzer kann nicht moderiert werden.");try(Connection c=db()){c.setAutoCommit(false);try{try(PreparedStatement p=c.prepareStatement("INSERT INTO habbix_voice_exclusions(user_id,until_ms,reason,actor_id) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE until_ms=VALUES(until_ms),reason=VALUES(reason),actor_id=VALUES(actor_id)")){p.setInt(1,target);p.setLong(2,s.muteSeconds>0?System.currentTimeMillis()+s.muteSeconds*1000L:0);p.setString(3,"Sprachchat-Stummschaltung");p.setInt(4,user);p.executeUpdate();}audit(c,user,action,Integer.toString(target));c.commit();}catch(Exception e){c.rollback();throw e;}}ProfileVoiceChannels.applyAdministration();}
    public static JsonObject state(int user)throws SQLException{
        Settings s=settings();int rank=rank(user);JsonObject o=new JsonObject();o.addProperty("rank",rank);o.addProperty("canAdmin",rank>=Math.max(7,s.minimumRank));if(rank<Math.max(7,s.minimumRank))return o;
        o.add("settings",JSON.toJsonTree(s));JsonArray ranks=new JsonArray();try(Connection c=db();PreparedStatement p=c.prepareStatement("SELECT id,rank_name FROM permission_ranks WHERE id>=7 ORDER BY id");ResultSet r=p.executeQuery()){while(r.next()){JsonObject v=new JsonObject();v.addProperty("id",r.getInt(1));v.addProperty("name",r.getString(2));ranks.add(v);}}o.add("ranks",ranks);JsonArray excluded=new JsonArray();if(rank>=s.voiceRank)try(Connection c=db();PreparedStatement p=c.prepareStatement("SELECT e.user_id,u.username,e.until_ms,e.reason FROM habbix_voice_exclusions e JOIN users u ON u.id=e.user_id WHERE e.until_ms=0 OR e.until_ms>? ORDER BY u.username LIMIT 200")){p.setLong(1,System.currentTimeMillis());try(ResultSet r=p.executeQuery()){while(r.next()){JsonObject b=new JsonObject();b.addProperty("userId",r.getInt(1));b.addProperty("name",r.getString(2));b.addProperty("until",r.getLong(3));b.addProperty("reason",r.getString(4));excluded.add(b);}}}o.add("excluded",excluded);return o;
    }
    private static void save(int user,Settings value,String action)throws SQLException{try(Connection c=db()){c.setAutoCommit(false);try{try(PreparedStatement p=c.prepareStatement("UPDATE habbix_event_administration SET config_json=? WHERE id=1")){p.setString(1,JSON.toJson(value));p.executeUpdate();}audit(c,user,action,JSON.toJson(value));c.commit();}catch(Exception e){c.rollback();throw e;}}}
    private static void audit(Connection c,int actor,String action,String details)throws SQLException{try(PreparedStatement p=c.prepareStatement("INSERT INTO habbix_administration_audit(actor_id,action,details) VALUES(?,?,?)")){p.setInt(1,actor);p.setString(2,action);p.setString(3,details);p.executeUpdate();}}
}
