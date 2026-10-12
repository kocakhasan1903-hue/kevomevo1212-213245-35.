package server.websocket.incoming.common.profile;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.modtool.ModToolIssue;
import com.eu.habbo.habbohotel.modtool.ModToolTicketType;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.networking.gameserver.decoders.GameMessageHandler;
import com.google.gson.*;
import java.sql.*;
import java.util.concurrent.TimeUnit;

/** Optional hotel UI adapter; tickets and moderation remain in Polaris' native system. */
public final class ProfileSupport {
 public static JsonObject handle(int author, String action, String text) throws Exception {
  if(text == null || text.length() > 2000) throw new IllegalArgumentException("Ungültige Ticket-Anfrage.");
  JsonObject request = new JsonParser().parse(text).getAsJsonObject();
  if(!"supportList".equals(action) && !"supportCreate".equals(action)) throw new IllegalArgumentException("Unbekannte Ticket-Aktion.");
  if("supportCreate".equals(action)) {
   String message = request.has("message") ? request.get("message").getAsString().trim() : "";
   if(message.length() < 15 || message.length() > 140 || message.indexOf('\0') >= 0) throw new IllegalArgumentException("Bitte 15 bis 140 Zeichen eingeben.");
   Habbo habbo = Emulator.getGameEnvironment().getHabboManager().getHabbo(author);
   if(habbo == null || habbo.getClient() == null || habbo.getClient().getChannel() == null) throw new IllegalArgumentException("Bitte im Hotel einchecken.");
   var client = habbo.getClient();
   var context = client.getChannel().pipeline().context(GameMessageHandler.class);
   if(context == null) throw new IllegalArgumentException("Hotel-Verbindung nicht bereit.");
   java.util.concurrent.Callable<Void> create = () -> {
    if(!client.getChannel().isActive() || client.getHabbo() != habbo) throw new IllegalArgumentException("Bitte erneut einchecken.");
    if(!habbo.getHabboStats().allowTalk()) throw new IllegalArgumentException("Du kannst derzeit kein Ticket senden.");
    // The native packet executor serializes this with ordinary calls for help.
    try(Connection db = Emulator.getDatabase().getDataSource().getConnection();
        PreparedStatement p = db.prepareStatement("SELECT COUNT(*) FROM support_tickets WHERE sender_id=? AND state<>0")) {
     p.setInt(1, author);
     try(ResultSet rows = p.executeQuery()) { rows.next(); if(rows.getInt(1) > 0) throw new IllegalArgumentException("Du hast bereits ein offenes Ticket. Bitte warte auf die Bearbeitung."); }
    }
    var manager = Emulator.getGameEnvironment().getModToolManager();
    int room = habbo.getHabboInfo().getCurrentRoom() == null ? 0 : habbo.getHabboInfo().getCurrentRoom().getId();
    ModToolIssue issue = new ModToolIssue(author, habbo.getHabboInfo().getUsername(), -1, "", room, message, ModToolTicketType.NORMAL_UNKNOWN);
    manager.addTicket(issue);
    if(issue.id <= 0) throw new IllegalArgumentException("Ticket konnte nicht gespeichert werden. Bitte die Liste aktualisieren.");
    manager.updateTicketToMods(issue);
    return null;
   };
   try { if(context.executor().inEventLoop()) create.call(); else context.executor().submit(create).get(20, TimeUnit.SECONDS); }
   catch(java.util.concurrent.ExecutionException e) { if(e.getCause() instanceof IllegalArgumentException) throw (IllegalArgumentException)e.getCause(); throw e; }
   catch(java.util.concurrent.TimeoutException e) { throw new IllegalArgumentException("Die Verarbeitung dauert länger. Bitte vor erneutem Senden die Ticketliste aktualisieren."); }
  }
  return list(author, action, request.has("requestId") ? request.get("requestId").getAsString() : "");
 }

 static JsonObject list(int author, String action, String requestId) throws SQLException {
  JsonObject result = new JsonObject();
  result.addProperty("requestId", requestId); result.addProperty("action", action);
  JsonArray tickets = new JsonArray();
  try(Connection db = Emulator.getDatabase().getDataSource().getConnection()) {
   try(PreparedStatement p = db.prepareStatement("SELECT COUNT(*) FROM support_tickets WHERE sender_id=? AND state<>0")) {
    p.setInt(1, author); try(ResultSet r = p.executeQuery()) { r.next(); result.addProperty("openCount", r.getInt(1)); }
   }
   // Separate limits prevent recent closed tickets from hiding an older open request.
   for(boolean closed : new boolean[]{false, true}) {
    try(PreparedStatement p = db.prepareStatement("SELECT id,state,timestamp,issue FROM support_tickets WHERE sender_id=? AND state" + (closed ? "=0" : "<>0") + " ORDER BY id DESC LIMIT 50")) {
     p.setInt(1, author); try(ResultSet r = p.executeQuery()) { while(r.next()) {
      JsonObject ticket = new JsonObject(); ticket.addProperty("id", r.getInt(1)); ticket.addProperty("state", r.getInt(2)); ticket.addProperty("timestamp", r.getLong(3)); ticket.addProperty("message", r.getString(4)); tickets.add(ticket);
     } }
    }
   }
  }
  result.add("tickets", tickets); return result;
 }
}
