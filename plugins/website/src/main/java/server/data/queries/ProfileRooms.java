package server.data.queries;
import java.sql.*;
import java.util.*;
import server.data.classes.misc.RoomData;
/** Read-only room summaries: no room loading, furniture initialization or custom room columns. */
public final class ProfileRooms {
 public static List<RoomData> load(Connection connection,String username)throws SQLException {
  List<RoomData> rooms=new ArrayList<>();
  try(PreparedStatement q=connection.prepareStatement("SELECT id,name,users,users_max,score FROM rooms WHERE owner_name=? ORDER BY id DESC LIMIT 25")){
   q.setString(1,username);
   try(ResultSet rs=q.executeQuery()){while(rs.next())rooms.add(new RoomData(rs));}
  }
  return rooms;
 }
}
