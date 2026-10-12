package server.websocket.incoming.common.community;

import com.eu.habbo.Emulator;
import com.google.gson.*;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.misc.DataComposer;
import java.sql.*;
import java.time.*;

/** Authenticated community homepage preferences and monthly nominations. */
public class CommunityHomeEvent extends IncomingWebMessage<CommunityHomeEvent.Request> {
    public CommunityHomeEvent() { super(Request.class); }
    @Override public void handle(WebSocketClient client, Request request) {
        if (client.getAccount() == null) { reply(client, "Bitte erneut anmelden."); return; }
        if (request == null || request.action == null) { reply(client,"Ungültige Anfrage."); return; }
        final int user = client.getAccount().getId();
        final String month = YearMonth.now(ZoneOffset.UTC).toString();
        try (Connection db = Emulator.getDatabase().getDataSource().getConnection()) {
            JsonObject eligibility=eligibility(db,user);
            if ("banner".equals(request.action)) {
                if (!"city".equals(request.banner) && !"night".equals(request.banner) && !"furni".equals(request.banner)) { reply(client,"Unbekanntes Banner."); return; }
                try (PreparedStatement q=db.prepareStatement("INSERT INTO website_home_preferences (user_id,banner) VALUES (?,?) ON DUPLICATE KEY UPDATE banner=VALUES(banner)")) {
                    q.setInt(1,user); q.setString(2,request.banner); q.executeUpdate();
                }
            } else if ("vote".equals(request.action)) {
                if(!eligibility.get("canVote").getAsBoolean()){reply(client,eligibility.get("reason").getAsString());return;}
                if (request.username==null || request.username.length()>32) { reply(client,"Bitte einen Benutzernamen eingeben."); return; }
                int nominee=0;
                try (PreparedStatement q=db.prepareStatement("SELECT id FROM users WHERE username=? LIMIT 1")) {
                    q.setString(1,request.username.trim()); try(ResultSet rs=q.executeQuery()) { if(rs.next()) nominee=rs.getInt(1); }
                }
                if (nominee==0) { reply(client,"Dieses Mitglied wurde nicht gefunden."); return; }
                try (PreparedStatement q=db.prepareStatement("INSERT INTO website_month_votes (month_key,voter_id,nominee_id) VALUES (?,?,?) ON DUPLICATE KEY UPDATE nominee_id=VALUES(nominee_id)")) {
                    q.setString(1,month);q.setInt(2,user);q.setInt(3,nominee);q.executeUpdate();
                } catch (SQLIntegrityConstraintViolationException e) { reply(client,"Du hast diesen Monat bereits abgestimmt."); return; }
            } else if (!"get".equals(request.action)) { reply(client,"Unbekannte Aktion.");return; }

            JsonObject data=new JsonObject();data.addProperty("month",month);data.addProperty("banner","city");
            data.add("voteEligibility",eligibility);
            data.addProperty("voteEndsAt",YearMonth.now(ZoneOffset.UTC).plusMonths(1).atDay(1).atStartOfDay(ZoneOffset.UTC).toEpochSecond());
            data.addProperty("canManage",CmsStudioEvent.allowed(db,user));
            data.addProperty("action",request.action);data.addProperty("votedFor",0);
            try (PreparedStatement q=db.prepareStatement("SELECT banner FROM website_home_preferences WHERE user_id=?")) {
                q.setInt(1,user);try(ResultSet rs=q.executeQuery()){if(rs.next())data.addProperty("banner",rs.getString(1));}
            }
            try (PreparedStatement q=db.prepareStatement("SELECT nominee_id FROM website_month_votes WHERE month_key=? AND voter_id=?")) {
                q.setString(1,month);q.setInt(2,user);try(ResultSet rs=q.executeQuery()){if(rs.next())data.addProperty("votedFor",rs.getInt(1));}
            }
            data.add("appearance",server.websocket.incoming.common.profile.ProfileAppearance.read(db,user));
            data.add("leaders",leaders(db,month));
            data.add("previous",leaders(db,YearMonth.now(ZoneOffset.UTC).minusMonths(1).toString()));
            client.sendMessage(new DataComposer("homeData",data.toString()));
        } catch (SQLException e) {
            org.slf4j.LoggerFactory.getLogger(CommunityHomeEvent.class).error("Community homepage database error",e);
            reply(client,"Die Aktion konnte nicht gespeichert werden. Bitte später erneut versuchen.");
        }
    }
    private JsonArray leaders(Connection db,String month) throws SQLException {
        JsonArray result=new JsonArray();
        try(PreparedStatement q=db.prepareStatement("SELECT u.id,u.username,u.look,COUNT(*) votes FROM website_month_votes v JOIN users u ON u.id=v.nominee_id WHERE v.month_key=? GROUP BY u.id,u.username,u.look ORDER BY votes DESC,u.id ASC LIMIT 3")) {
            q.setString(1,month);try(ResultSet rs=q.executeQuery()){while(rs.next()){
                JsonObject row=new JsonObject();row.addProperty("id",rs.getInt("id"));row.addProperty("username",rs.getString("username"));row.addProperty("look",rs.getString("look"));row.addProperty("votes",rs.getInt("votes"));row.add("appearance",server.websocket.incoming.common.profile.ProfileAppearance.read(db,rs.getInt("id")));result.add(row);
            }}
        }
        return result;
    }
    private JsonObject eligibility(Connection db,int user)throws SQLException{
        int requiredPoints=100,requiredSeconds=0;String source="achievement_score";
        try(PreparedStatement q=db.prepareStatement("SELECT min_activity_points,min_online_seconds,activity_source FROM habboje_shop.monthly_settings WHERE id=1");ResultSet r=q.executeQuery()){
            if(r.next()){requiredPoints=r.getInt(1);requiredSeconds=r.getInt(2);source=r.getString(3);}
        }
        if(!source.equals("achievement_score")&&!source.equals("hof_points"))throw new SQLException("Unknown monthly activity source");
        int points=0;long seconds=0;
        try(PreparedStatement q=db.prepareStatement("SELECT achievement_score,hof_points,online_time FROM users_settings WHERE user_id=?")){
            q.setInt(1,user);try(ResultSet r=q.executeQuery()){if(r.next()){points=r.getInt(source);seconds=r.getLong("online_time");}}
        }
        com.eu.habbo.habbohotel.users.Habbo online=Emulator.getGameEnvironment().getHabboManager().getHabbo(user);
        if(online!=null){seconds=Math.max(seconds,(long)online.getHabboStats().getOnlineMinutes(Emulator.getIntUnixTimestamp())*60);if(source.equals("achievement_score"))points=Math.max(points,online.getHabboStats().getAchievementScore());}
        int rank=1;
        try(PreparedStatement q=db.prepareStatement("SELECT rank FROM users WHERE id=?")){
            q.setInt(1,user);try(ResultSet r=q.executeQuery()){if(r.next())rank=r.getInt(1);}
        }
        boolean staffExempt=rank>=3;
        boolean allowed=staffExempt||(points>=requiredPoints&&seconds>=requiredSeconds);
        JsonObject result=new JsonObject();result.addProperty("canVote",allowed);result.addProperty("activityPoints",points);result.addProperty("onlineSeconds",seconds);result.addProperty("minActivityPoints",requiredPoints);result.addProperty("minOnlineSeconds",requiredSeconds);
        result.addProperty("staffExempt",staffExempt);
        result.addProperty("activitySource",source.equals("achievement_score")?"Erfolgspunkte":"Hall-of-Fame-Punkte");
        result.addProperty("reason",allowed?"":"Für die Monatsabstimmung benötigst du "+requiredPoints+" Aktivitätspunkte ("+(source.equals("achievement_score")?"Erfolge":"Hall of Fame")+")"+(requiredSeconds>0?" und "+requiredSeconds+" Sekunden Onlinezeit":"")+".");return result;
    }
    private void reply(WebSocketClient c,String error){c.sendMessage(new DataComposer("homeError",error));}
    static class Request { String action; String username; String banner; }
}
