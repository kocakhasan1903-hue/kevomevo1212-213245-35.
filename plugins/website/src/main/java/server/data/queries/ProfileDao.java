package server.data.queries;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.guilds.Guild;
import com.eu.habbo.habbohotel.messenger.MessengerBuddy;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.habbohotel.users.HabboBadge;
import com.eu.habbo.habbohotel.users.HabboInfo;
import server.Main;
import server.data.classes.account.Account;
import server.data.classes.account.AccountInfo;
import server.data.classes.misc.GroupData;
import server.data.classes.profile.Profile;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public class ProfileDao {

    public static Profile getOfflineHabboInfo(String username) {
        Profile profile = null;

        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); PreparedStatement statement = connection.prepareStatement("SELECT * FROM users WHERE username = ? LIMIT 1")) {
            statement.setString(1, username);

            try (ResultSet set = statement.executeQuery()) {
                if (set.next()) {
                    profile = new Profile(set);
                    Main.website.profileManager.insertProfile(profile);
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
            throw new IllegalStateException("Profile database lookup failed", e);
        }

        return profile;
    }

    public static List<AccountInfo> loadFriends(int userId) {
        List<AccountInfo> friends = new ArrayList<>();
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("SELECT " +
                     "users.id, " +
                     "users.username, " +
                     "users.gender, " +
                     "users.online, " +
                     "users.look, " +
                     "users.motto, " +
                     "messenger_friendships.* FROM messenger_friendships INNER JOIN users ON messenger_friendships.user_two_id = users.id WHERE user_one_id = ?")) {
            statement.setInt(1, userId);

            try (ResultSet set = statement.executeQuery()) {
                while (set.next()) {
                    MessengerBuddy buddy = new MessengerBuddy(set);

                    if (buddy.getId() == userId) {
                        continue;
                    }

                    friends.add(new AccountInfo(buddy.getId()));
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }

        return friends;
    }

    public static List<GroupData> getGroupsByUser(int userId) {
        List<GroupData> guilds = new ArrayList<>();

        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); PreparedStatement statement = connection.prepareStatement("SELECT guild_id FROM guilds_members WHERE user_id = "+ userId +" ORDER BY id DESC")) {
            try (ResultSet set = statement.executeQuery()) {
                while (set.next()) {
                    Guild guild = Emulator.getGameEnvironment().getGuildManager().getGuild(set.getInt("guild_id"));
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

    public static ArrayList<HabboBadge> getBadgesOfflineHabbo(int userId) {
        ArrayList<HabboBadge> badgesList = new ArrayList();

        try {
            Connection connection = Emulator.getDatabase().getDataSource().getConnection();

            try {
                PreparedStatement statement = connection.prepareStatement("SELECT * FROM users_badges WHERE user_id = ? ORDER BY id DESC");

                try {
                    statement.setInt(1, userId);
                    ResultSet set = statement.executeQuery();

                    try {
                        while(set.next()) {
                            badgesList.add(new HabboBadge(set, (Habbo)null));
                        }
                    } catch (Throwable var10) {
                        if (set != null) {
                            try {
                                set.close();
                            } catch (Throwable var9) {
                                var10.addSuppressed(var9);
                            }
                        }

                        throw var10;
                    }

                    set.close();
                } catch (Throwable var11) {
                    if (statement != null) {
                        try {
                            statement.close();
                        } catch (Throwable var8) {
                            var11.addSuppressed(var8);
                        }
                    }

                    throw var11;
                }

                statement.close();
            } catch (Throwable var12) {
                if (connection != null) {
                    try {
                        connection.close();
                    } catch (Throwable var7) {
                        var12.addSuppressed(var7);
                    }
                }

                throw var12;
            }

            connection.close();
        } catch (SQLException var13) {
            Main.getLogger().error("Caught SQL exception", var13);
        }

        return badgesList;
    }


    public static void updateStyle(int userId, String style){
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("UPDATE users SET profile_style = ? WHERE id = ?")) {
            statement.setString(1, style);
            statement.setInt(2, userId);
            statement.execute();
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }
    }
}
