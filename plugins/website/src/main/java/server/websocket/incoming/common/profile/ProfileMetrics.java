package server.websocket.incoming.common.profile;
import java.sql.*;
import com.google.gson.JsonObject;
/** Optional emulator counters: absent fields remain unavailable, never fabricated. */
public final class ProfileMetrics {
 public static void read(Connection c,int owner,JsonObject stats)throws SQLException {
  // Public flame currency is type 105, not the unrelated consecutive-login counter.
  try(PreparedStatement p=c.prepareStatement("SELECT amount FROM users_currency WHERE user_id=? AND type=105")) {
   p.setInt(1,owner);
   try(ResultSet r=p.executeQuery()){stats.addProperty("flames",r.next()?r.getLong("amount"):0L);}
  }
  try(PreparedStatement p=c.prepareStatement("SELECT * FROM users_settings WHERE user_id=?")) {
   p.setInt(1,owner);
   try(ResultSet r=p.executeQuery()) { if(!r.next())return;
    ResultSetMetaData m=r.getMetaData();
    for(int i=1;i<=m.getColumnCount();i++) {
     String name=m.getColumnLabel(i);
     if("respects_received".equalsIgnoreCase(name))stats.addProperty("respect",r.getLong(i));
     if("login_streak".equalsIgnoreCase(name))stats.addProperty("login_streak",r.getLong(i));
     if("online_time".equalsIgnoreCase(name))stats.addProperty("onlinehours",r.getLong(i)/3600);
    }
   }
  }
 }
}
