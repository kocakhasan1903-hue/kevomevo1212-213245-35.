package server.data.classes.misc;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.guilds.Guild;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Comparator;

public class GroupData implements Comparable<GroupData>{
    private int id;
    private String name;
    private String description;
    private String badge;
    private int memberCount = 0;

    public static final Comparator SORT_MEMBERS = (o1, o2) -> {
        return o1 instanceof GroupData && o2 instanceof GroupData ? ((GroupData)o2).getMemberCount() - ((GroupData)o1).getMemberCount() : 0;
    };

    public GroupData(Guild guild){
        this.id = guild.getId();
        this.name = guild.getName();
        this.description = guild.getDescription();
        this.badge = guild.getBadge();
        this.memberCount = guild.getMemberCount();
    }

    public int getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public String getBadge() {
        return badge;
    }

    public int getMemberCount() {
        return memberCount;
    }

    @Override
    public int compareTo(GroupData o) {
        if (o.getMemberCount() != this.getMemberCount()) {
            return o.getMemberCount() - this.getMemberCount();
        }

        return this.id - o.id;
    }
}
