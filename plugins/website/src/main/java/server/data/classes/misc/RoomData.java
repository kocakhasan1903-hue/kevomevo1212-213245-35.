package server.data.classes.misc;

import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.rooms.RoomManager;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Comparator;

public class RoomData implements Comparable<RoomData>{
    private final int id;
    private final String roomName;
    private final int userCount;
    private final int userMax;

    private final int roomScore;

    public static final Comparator SORT_ID = (o1, o2) -> {
        return o1 instanceof RoomData && o2 instanceof RoomData ? ((RoomData)o2).getId() - ((RoomData)o1).getId() : 0;
    };


    public RoomData(int id, String roomName, int roomUserCount, int roomUsersMax, int roomScore){
        this.id = id;
        this.roomName = roomName;
        this.userCount = roomUserCount;
        this.userMax = roomUsersMax;
        this.roomScore = roomScore;
    }

    public RoomData(ResultSet set) throws SQLException {
        this.id = set.getInt("id");
        this.roomName = set.getString("name");
        this.userCount = set.getInt("users");
        this.userMax = set.getInt("users_max");
        this.roomScore = set.getInt("score");
    }

    @Override
    public int compareTo(RoomData o) {
        return 0;
    }

    public int getId() {
        return id;
    }

    public String getRoomName() {
        return roomName;
    }

    public int getUserCount() {
        return userCount;
    }

    public int getUserMax() {
        return userMax;
    }

    public int getRoomScore() {
        return roomScore;
    }
}
