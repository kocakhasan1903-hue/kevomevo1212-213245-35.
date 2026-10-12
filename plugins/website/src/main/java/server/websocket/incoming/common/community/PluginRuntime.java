package server.websocket.incoming.common.community;

import com.eu.habbo.Emulator;
import java.sql.*;

public final class PluginRuntime {
 private PluginRuntime(){}
 public static void touch(String component,String message)throws SQLException{
  try(Connection db=Emulator.getDatabase().getDataSource().getConnection();PreparedStatement q=db.prepareStatement("INSERT INTO habboje_shop.plugin_runtime(component,state,message) VALUES(?,'running',?) ON DUPLICATE KEY UPDATE state='running',message=VALUES(message),checked_at=CURRENT_TIMESTAMP")){
   q.setString(1,component);q.setString(2,message);q.executeUpdate();
  }
 }
}
