package server.data.queries;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.guilds.Guild;
import server.Main;
import server.data.classes.account.Account;
import server.data.classes.account.AccountInfo;
import server.data.classes.community.data.*;
import server.data.classes.misc.GroupData;
import server.data.classes.misc.RoomData;
import server.data.classes.misc.StatsType;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class CommunityDao {

    public static List<Photos> loadPhotos(){
        List<Photos> photos = new ArrayList<Photos>();
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); Statement statement = connection.createStatement()) {
            try (ResultSet set = statement.executeQuery("SELECT * FROM `camera_web` ORDER BY id DESC LIMIT 50")) {
                while (set.next()) {
                    try {
                        photos.add(new Photos(set));
                    } catch (SQLException e) {
                        Main.getLogger().error("Caught SQL exception", e);
                    }
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }

        return photos;
    }

    public static List<TopsCurrency> loadTopsByCurrency(int currencyType){
        List<TopsCurrency> tops = new ArrayList<>();
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); Statement statement = connection.createStatement()) {
            try (ResultSet set = statement.executeQuery("SELECT * FROM users_currency uc INNER JOIN users u ON u.id = uc.user_id WHERE `type` = " + currencyType + " AND rank IN (1,2,3,4,5) ORDER BY `amount` DESC LIMIT 10")) {
                while (set.next()) {
                    try {

                        Account account = AccountDao.getAccountById(set.getInt("user_id"));
                        if (account == null) continue;

                        tops.add(new TopsCurrency(
                                account.getUsername(),
                                account.getLook(),
                                set.getInt("type"),
                                set.getInt("amount")));
                    } catch (SQLException e) {
                        Main.getLogger().error("Caught SQL exception", e);
                    }
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }

        return tops;
    }

    public static List<TopsCurrency> lastUsers(){
        List<TopsCurrency> lastUsers = new ArrayList<>();

        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); Statement statement = connection.createStatement()) {
            try (ResultSet set = statement.executeQuery("SELECT * FROM `users` ORDER BY `id` DESC LIMIT 30")) {
                while (set.next()) {
                    try {

                        lastUsers.add(new TopsCurrency(
                                set.getString("username"),
                                set.getString("look"),
                                0,
                                set.getInt("account_created")));
                    } catch (SQLException e) {
                        Main.getLogger().error("Caught SQL exception", e);
                    }
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }

        return lastUsers;
    }

    public static List<TopsCurrency> loadTopsByCredits(){
        List<TopsCurrency> tops = new ArrayList<>();

        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); Statement statement = connection.createStatement()) {
            try (ResultSet set = statement.executeQuery("SELECT * FROM `users` WHERE `rank` <= '2' ORDER BY `credits` DESC LIMIT 10")) {
                while (set.next()) {
                    try {
                        tops.add(new TopsCurrency(
                                set.getString("username"),
                                set.getString("look"),
                                0,
                                set.getInt("credits")));
                    } catch (SQLException e) {
                        Main.getLogger().error("Caught SQL exception", e);
                    }
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }

        return tops;
    }

    public static List<Staffs> loadStaffs(){
        List<Staffs> staffs = new ArrayList<>();

        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); Statement statement = connection.createStatement()) {
            try (ResultSet set = statement.executeQuery("SELECT * FROM users WHERE rank >= 3 ORDER BY id DESC")) {
                while (set.next()) {
                    try {
                        staffs.add(new Staffs(set));
                    } catch (SQLException e) {
                        Main.getLogger().error("Caught SQL exception", e);
                    }
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }

        return staffs;
    }

    public static List<Vips> loadVips(){
        List<Vips> vips = new ArrayList<>();

        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); Statement statement = connection.createStatement()) {
            try (ResultSet set = statement.executeQuery("SELECT * FROM users WHERE rank = 2")) {
                while (set.next()) {
                    try {
                        vips.add(new Vips(set));
                    } catch (SQLException e) {
                        Main.getLogger().error("Caught SQL exception", e);
                    }
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }

        return vips;
    }

    public static List<Ranks> loadRanks(){
        List<Ranks> ranks = new ArrayList<Ranks>();
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); Statement statement = connection.createStatement()) {
            try (ResultSet set = statement.executeQuery("SELECT * FROM `permissions` WHERE id >= 3 ORDER BY id DESC")) {
                while (set.next()) {
                    try {
                        ranks.add(new Ranks(set));
                    } catch (SQLException e) {
                        Main.getLogger().error("Caught SQL exception", e);
                    }
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }

        return ranks;
    }

    public static List<TopsStats> loadStats(){
        List<TopsStats> topsStats = new ArrayList<>();

        for (StatsType type : StatsType.values()){

            if (type.getType().equalsIgnoreCase(StatsType.SCORE.getType())){
                topsStats.addAll(loadTopsScore());
                continue;
            }

            if(type.getType().equalsIgnoreCase(StatsType.ONLINE.getType())){
                topsStats.addAll(loadTopsOnlineTime());
                continue;
            }

            if(type.getType().equalsIgnoreCase(StatsType.RESPECTS_PAID.getType())){
                topsStats.addAll(loadTopsRespectsGive());
                continue;
            }

            if(type.getType().equalsIgnoreCase(StatsType.RESPECTS.getType())){
                topsStats.addAll(loadTopsRespectsReceived());
                continue;
            }

            try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
                 PreparedStatement statement = connection.prepareStatement("SELECT * FROM users_achievements ua INNER JOIN users u ON u.id = ua.user_id WHERE achievement_name = ? AND rank IN (1,2,3,4,5) ORDER BY progress DESC LIMIT 10")) {
                statement.setString(1, type.getType());
                try (ResultSet set = statement.executeQuery()) {
                    while (set.next()) {
                        try {
                            topsStats.add(new TopsStats(new AccountInfo(set.getInt("user_id")), type, set.getInt("progress")));
                        } catch (SQLException e) {
                            Main.getLogger().error("Caught SQL exception", e);
                        }
                    }
                }
            } catch (SQLException e) {
                Main.getLogger().error("Caught SQL exception", e);
            }
        }

        return topsStats;
    }

    public static List<TopsStats> loadTopsScore(){
        List<TopsStats> topsStats = new ArrayList<>();

        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); Statement statement = connection.createStatement()) {
            try (ResultSet set = statement.executeQuery("SELECT * FROM users_settings us INNER JOIN users u ON u.id = us.user_id WHERE rank IN (1,2,3,4,5) ORDER BY achievement_score DESC LIMIT 10")) {
                while (set.next()) {
                    try {
                            topsStats.add(new TopsStats(new AccountInfo(set.getInt("user_id")), StatsType.SCORE, set.getInt("achievement_score")));
                    } catch (SQLException e) {
                            Main.getLogger().error("Caught SQL exception", e);
                    }
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }

        return topsStats;
    }

    public static List<TopsStats> loadTopsOnlineTime(){
        List<TopsStats> topsStats = new ArrayList<>();

        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); Statement statement = connection.createStatement()) {
            try (ResultSet set = statement.executeQuery("SELECT * FROM users_settings ua INNER JOIN users u ON u.id = ua.user_id WHERE rank IN (1,2,3,4,5) ORDER BY online_time DESC LIMIT 10")) {
                while (set.next()) {
                    try {
                        topsStats.add(new TopsStats(new AccountInfo(set.getInt("user_id")), StatsType.ONLINE, set.getInt("online_time") / 60));
                    } catch (SQLException e) {
                        Main.getLogger().error("Caught SQL exception", e);
                    }
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }

        return topsStats;
    }

    public static List<TopsStats> loadTopsRespectsReceived(){
        List<TopsStats> topsStats = new ArrayList<>();

        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); Statement statement = connection.createStatement()) {
            try (ResultSet set = statement.executeQuery("SELECT * FROM users_settings ua INNER JOIN users u ON u.id = ua.user_id WHERE rank IN (1,2,3,4,5) ORDER BY respects_received DESC LIMIT 10")) {
                while (set.next()) {
                    try {
                        topsStats.add(new TopsStats(new AccountInfo(set.getInt("user_id")), StatsType.RESPECTS, set.getInt("respects_received")));
                    } catch (SQLException e) {
                        Main.getLogger().error("Caught SQL exception", e);
                    }
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }

        return topsStats;
    }

    public static List<TopsStats> loadTopsRespectsGive(){
        List<TopsStats> topsStats = new ArrayList<>();

        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); Statement statement = connection.createStatement()) {
            try (ResultSet set = statement.executeQuery("SELECT * FROM users_settings ua INNER JOIN users u ON u.id = ua.user_id WHERE rank IN (1,2,3,4,5) ORDER BY respects_given DESC LIMIT 10")) {
                while (set.next()) {
                    try {
                        topsStats.add(new TopsStats(new AccountInfo(set.getInt("user_id")), StatsType.RESPECTS_PAID, set.getInt("respects_given")));
                    } catch (SQLException e) {
                        Main.getLogger().error("Caught SQL exception", e);
                    }
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }

        return topsStats;
    }

    public static List<RoomData> loadTopsRoomsScore(){
        List<RoomData> topsRoomsScore = new ArrayList<>();

        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); Statement statement = connection.createStatement()) {
            try (ResultSet set = statement.executeQuery("SELECT * FROM rooms ORDER BY score DESC LIMIT 10")) {
                while (set.next()) {
                    try {
                        topsRoomsScore.add(new RoomData(set));
                    } catch (SQLException e) {
                        Main.getLogger().error("Caught SQL exception", e);
                    }
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }

        return topsRoomsScore;
    }

    public static List<GroupData> getAllGuilds() {
        List<GroupData> guilds = new ArrayList<>();

        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); PreparedStatement statement = connection.prepareStatement("SELECT id FROM guilds ORDER BY id DESC")) {
            try (ResultSet set = statement.executeQuery()) {
                while (set.next()) {
                    Guild guild = Emulator.getGameEnvironment().getGuildManager().getGuild(set.getInt("id"));
                    if (guild != null) {
                        guilds.add(new GroupData(guild));
                    }
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }

        return guilds;
    }

}
