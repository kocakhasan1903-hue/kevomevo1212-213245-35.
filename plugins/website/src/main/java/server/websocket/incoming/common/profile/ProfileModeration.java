package server.websocket.incoming.common.profile;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.permissions.Permission;
import com.eu.habbo.habbohotel.users.Habbo;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

/** Optional read-only staff history. Native ticket decisions and permissions remain in Polaris. */
public final class ProfileModeration {
    public static JsonObject handle(int author, String action, String text) throws Exception {
        if (!"moderationClosedTickets".equals(action) && !"moderationUserStats".equals(action)) throw new IllegalArgumentException("Unbekannte Moderations-Aktion.");
        if (text == null || text.length() > 1000) throw new IllegalArgumentException("Ungültige Moderations-Anfrage.");
        Habbo staff = Emulator.getGameEnvironment().getHabboManager().getHabbo(author);
        if (staff == null || staff.getClient() == null || !staff.hasPermission(Permission.ACC_SUPPORTTOOL))
            throw new IllegalArgumentException("Keine Berechtigung für das MOD Tool.");
        JsonObject request;
        int beforeId = 0;
        try {
            request = new JsonParser().parse(text).getAsJsonObject();
            if (request.has("beforeId")) beforeId = request.get("beforeId").getAsBigDecimal().intValueExact();
            if (beforeId < 0) throw new IllegalArgumentException();
        } catch (RuntimeException invalid) { throw new IllegalArgumentException("Ungültige Moderations-Anfrage."); }
        String requestId = request.has("requestId") ? request.get("requestId").getAsString() : "";
        if (requestId.length() > 100) throw new IllegalArgumentException("Ungültige Moderations-Anfrage.");
        JsonObject result = new JsonObject();
        result.addProperty("action", action);
        result.addProperty("requestId", requestId);
        if ("moderationUserStats".equals(action)) {
            int target;
            try { target = request.get("userId").getAsBigDecimal().intValueExact(); }
            catch (RuntimeException ex) { throw new IllegalArgumentException("Ungültige User ID."); }
            if (target <= 0) throw new IllegalArgumentException("Ungültige User ID.");
            try (Connection db = Emulator.getDatabase().getDataSource().getConnection()) {
                JsonObject stats = new JsonObject();
                try (PreparedStatement p = db.prepareStatement("SELECT username,look,gender,credits FROM users WHERE id=?")) {
                    p.setInt(1, target);
                    try (ResultSet row = p.executeQuery()) {
                        if (!row.next()) throw new IllegalArgumentException("User nicht gefunden.");
                        result.addProperty("username", row.getString(1));
                        result.addProperty("look", row.getString(2)); result.addProperty("gender", row.getString(3));
                        stats.addProperty("credits", row.getInt(4));
                    }
                }
                stats.addProperty("diamonds", 0); stats.addProperty("eventstars", 0);
                try (PreparedStatement p = db.prepareStatement("SELECT type,amount FROM users_currency WHERE user_id=?")) {
                    p.setInt(1, target);
                    try (ResultSet rows = p.executeQuery()) { while (rows.next()) {
                        if (rows.getInt(1)==5) stats.addProperty("diamonds",rows.getInt(2));
                        if (rows.getInt(1)==104) stats.addProperty("eventstars",rows.getInt(2));
                    } }
                }
                ProfileMetrics.read(db,target,stats);
                readOptional(db,"users_settings",target,stats,new String[][] {
                    {"keys_used","keysUsed"},{"boxes_opened","boxesOpened"},{"credits_collected","creditsCollected"},
                    {"diamonds_collected","diamondsCollected"},{"bottles_collected","bottlesCollected"},{"event_level","eventLevel"}
                });
                if (tableExists(db,"website_hourly_lotto_winners")) try (PreparedStatement p=db.prepareStatement("SELECT COUNT(*) FROM website_hourly_lotto_winners WHERE user_id=?")) {
                    p.setInt(1,target); try(ResultSet rows=p.executeQuery()){rows.next();stats.addProperty("lottoWins",rows.getLong(1));}
                }
                JsonObject roleplay = new JsonObject();
                String[][] roleplayFields={{"health","health"},{"max_health","maxHealth"},{"shield","shield"},{"max_shield","maxShield"},
                    {"kills","kills"},{"deaths","deaths"},{"killstreak","killstreak"},{"in_jail","inJail"},{"is_police","police"},
                    {"is_medic","medic"},{"rpg_ban","banned"},{"bounty","bounty"}};
                for(String table:new String[]{"users_roleplay","users_rpg","roleplay_users","rpg_users"}) {
                    if(tableExists(db,table)) readOptional(db,table,target,roleplay,roleplayFields);
                }
                result.add("stats",stats); result.add("roleplay",roleplay); result.addProperty("userId",target);
                result.addProperty("roleplayAvailable",roleplay.size()>0);
            }
            if(!staff.hasPermission(Permission.ACC_SUPPORTTOOL)) throw new IllegalArgumentException("Keine Berechtigung für das MOD Tool.");
            return result;
        }
        JsonArray tickets = new JsonArray();
        boolean hasMore = false;
        try (Connection db = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement query = db.prepareStatement(
                "SELECT t.id,t.timestamp,t.closed_timestamp,t.sender_id,t.reported_id,t.room_id,t.category,t.issue,"
                + "COALESCE(s.username,'') AS sender_name,COALESCE(r.username,'') AS reported_name,COALESCE(m.username,'') AS moderator_name "
                + "FROM support_tickets t LEFT JOIN users s ON s.id=t.sender_id LEFT JOIN users r ON r.id=t.reported_id "
                + "LEFT JOIN users m ON m.id=t.mod_id WHERE t.state=0 AND (?=0 OR t.id<?) ORDER BY t.id DESC LIMIT 51")) {
            query.setInt(1, beforeId); query.setInt(2, beforeId);
            try (ResultSet rows = query.executeQuery()) {
                while (rows.next()) {
                    if (tickets.size() == 50) { hasMore = true; break; }
                    JsonObject ticket = new JsonObject();
                    ticket.addProperty("id", rows.getInt("id"));
                    ticket.addProperty("timestamp", rows.getLong("timestamp"));
                    ticket.addProperty("closedTimestamp", rows.getLong("closed_timestamp"));
                    ticket.addProperty("senderId", rows.getInt("sender_id"));
                    ticket.addProperty("reportedId", rows.getInt("reported_id"));
                    ticket.addProperty("roomId", rows.getInt("room_id"));
                    ticket.addProperty("category", rows.getInt("category"));
                    ticket.addProperty("message", rows.getString("issue"));
                    ticket.addProperty("senderName", rows.getString("sender_name"));
                    ticket.addProperty("reportedName", rows.getString("reported_name"));
                    ticket.addProperty("moderatorName", rows.getString("moderator_name"));
                    tickets.add(ticket);
                }
            }
        }
        // Do not return staff data if the rank was revoked during the query.
        if (!staff.hasPermission(Permission.ACC_SUPPORTTOOL)) throw new IllegalArgumentException("Keine Berechtigung für das MOD Tool.");
        result.add("tickets", tickets);
        result.addProperty("hasMore", hasMore);
        return result;
    }
    private static boolean tableExists(Connection db,String table)throws Exception {
        try(ResultSet tables=db.getMetaData().getTables(db.getCatalog(),null,table,new String[]{"TABLE"})) {
            while(tables.next()) if(table.equalsIgnoreCase(tables.getString("TABLE_NAME"))) return true;
        }
        return false;
    }
    private static void readOptional(Connection db,String table,int user,JsonObject target,String[][] fields)throws Exception {
        // Identifiers are fixed internal names; only the user ID is supplied by the client.
        if(!tableExists(db,table))return;
        boolean userColumn=false;
        try(ResultSet columns=db.getMetaData().getColumns(db.getCatalog(),null,table,"user_id")) {
            while(columns.next()) if("user_id".equalsIgnoreCase(columns.getString("COLUMN_NAME"))) userColumn=true;
        }
        if(!userColumn)return;
        try(PreparedStatement p=db.prepareStatement("SELECT * FROM "+table+" WHERE user_id=?")) {
            p.setInt(1,user);try(ResultSet rows=p.executeQuery()) {
                if(!rows.next())return;
                var meta=rows.getMetaData();
                for(int i=1;i<=meta.getColumnCount();i++) for(String[] field:fields) {
                    if(field[0].equalsIgnoreCase(meta.getColumnLabel(i)) && rows.getObject(i)!=null) target.addProperty(field[1],rows.getLong(i));
                }
            }
        }
    }
}
