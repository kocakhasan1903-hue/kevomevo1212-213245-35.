package server.data.queries;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.HabboInfo;
import com.eu.habbo.habbohotel.users.subscriptions.Subscription;
import com.eu.habbo.plugin.events.users.subscriptions.UserSubscriptionCreatedEvent;
import com.eu.habbo.plugin.events.users.subscriptions.UserSubscriptionExtendedEvent;
import org.springframework.security.crypto.bcrypt.BCrypt;
import server.Main;
import server.data.classes.account.Account;
import server.data.classes.account.AccountSetting;
import server.utils.Utils;
import server.websocket.client.WebSocketClient;

import java.lang.reflect.Constructor;
import java.sql.*;

public class AccountDao {

    public static Account loadAccount(String sso) {
        Account account = null;

        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("SELECT * FROM users WHERE auth_ticket = ? LIMIT 1")) {
            statement.setString(1, sso);
            try (ResultSet set = statement.executeQuery()) {
                if (set.next()) {
                    account = new Account(set);
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        } catch (Exception ex) {
            Main.getLogger().error("Caught exception", ex);
        }

        return account;
    }
    public static Account getAccountByUsername(String username) {
        Account account = null;

        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("SELECT * FROM users WHERE username = ? LIMIT 1")) {
            statement.setString(1, username);
            try (ResultSet set = statement.executeQuery()) {
                if (set.next()) {
                    account = new Account(set);
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        } catch (Exception ex) {
            Main.getLogger().error("Caught exception", ex);
        }

        return account;
    }

    public static Account getAccountById(int userId) {
        Account account = null;

        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("SELECT * FROM users WHERE id = ? LIMIT 1")) {
            statement.setInt(1, userId);
            try (ResultSet set = statement.executeQuery()) {
                if (set.next()) {
                    account = new Account(set);
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        } catch (Exception ex) {
            Main.getLogger().error("Caught exception", ex);
        }

        return account;
    }

    public static boolean getUsernameExists(String username){
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("SELECT * FROM users WHERE username = ? LIMIT 1")) {
            statement.setString(1, username);
            try (ResultSet set = statement.executeQuery()) {
                set.first();
                return set.getRow() != 0;
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
            return false;
        } catch (Exception ex) {
            Main.getLogger().error("Caught exception", ex);
            return false;
        }
    }

    public static boolean getIpExists(String ip){
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("SELECT * FROM users WHERE ip_register = ? LIMIT 1")) {
            statement.setString(1, ip);
            try (ResultSet set = statement.executeQuery()) {
                return set.getRow() >= 3;
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
            return false;
        } catch (Exception ex) {
            Main.getLogger().error("Caught exception", ex);
            return false;
        }
    }

    public static boolean getEmailExists(String email){
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("SELECT * FROM users WHERE mail = ? LIMIT 1")) {
            statement.setString(1, email);
            try (ResultSet set = statement.executeQuery()) {
                set.first();
                return set.getRow() != 0;
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
            return false;
        } catch (Exception ex) {
            Main.getLogger().error("Caught exception", ex);
            return false;
        }
    }

    public static String updateIp(WebSocketClient client){
        String ip = client.getChannelIp();
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("UPDATE users SET ip_current = ? WHERE id = ? ;")) {
            statement.setString(1, ip);
            statement.setInt(2, client.getAccount().getId());
            statement.execute();
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }
        return ip;
    }

    public static String getIpAddress(int userId){
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("SELECT ip_current FROM users WHERE id = ? LIMIT 1")) {
            statement.setInt(1, userId);
            try (ResultSet set = statement.executeQuery()) {
                return set.getString("ip_current");
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
            return "";
        } catch (Exception ex) {
            Main.getLogger().error("Caught exception", ex);
            return "";
        }
    }

    public static String updateSSO(Account account){
        String sso = Utils.generateSSO();
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("UPDATE users SET auth_ticket = ? WHERE id = ? ;")) {
            statement.setString(1, sso);
            statement.setInt(2, account.getId());
            statement.execute();
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }

        return sso;
    }

    public static void updateSSONull(Account acount){
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("UPDATE users SET auth_ticket = ? WHERE id = ? ;")) {
            statement.setString(1, "");
            statement.setInt(2, acount.getId());
            statement.execute();
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }
    }

    public static void updatePassword(Account acount, String newPassword){
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("UPDATE users SET password = ? WHERE id = ? ;")) {
            statement.setString(1, newPassword);
            statement.setInt(2, acount.getId());
            statement.execute();
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }
    }

    public static Account createAccount(String username,String look,String gender,String password,String motto,String ip,String mail,String sso){
        try(Connection connection=Emulator.getDatabase().getDataSource().getConnection()){
            connection.setAutoCommit(false);
            try(Statement maintenance=connection.createStatement();ResultSet state=maintenance.executeQuery("SELECT maintenance_enabled,maintenance_message FROM habboje_shop.site_settings WHERE id=1")){
                if(!state.next())throw new IllegalArgumentException("Hotel-Konfiguration fehlt.");
                if(state.getBoolean(1))throw new IllegalArgumentException(state.getString(2));
            }
            try(Statement policy=connection.createStatement();ResultSet settings=policy.executeQuery("SELECT * FROM habboje_shop.registration_settings WHERE id=1 FOR UPDATE")){
                if(!settings.next()||!settings.getBoolean("enabled")||username.length()<settings.getInt("min_username_length")||username.length()>settings.getInt("max_username_length")||password.length()<settings.getInt("min_password_length")){connection.rollback();return null;}
                try(PreparedStatement unique=connection.prepareStatement("SELECT id FROM users WHERE username=? OR mail=? LIMIT 1")){unique.setString(1,username);unique.setString(2,mail);try(ResultSet duplicate=unique.executeQuery()){if(duplicate.next()){connection.rollback();return null;}}}
                try(PreparedStatement count=connection.prepareStatement("SELECT COUNT(*) FROM users WHERE ip_register=?")){count.setString(1,ip);try(ResultSet exists=count.executeQuery()){exists.next();if(exists.getInt(1)>=settings.getInt("max_accounts_per_ip")){connection.rollback();return null;}}}
                int id;
                try(PreparedStatement insert=connection.prepareStatement("INSERT INTO users(username,look,gender,password,motto,account_created,last_login,last_online,ip_register,ip_current,mail,auth_ticket,credits,home_room) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",Statement.RETURN_GENERATED_KEYS)){
                    insert.setString(1,username);insert.setString(2,look);insert.setString(3,gender.toUpperCase());insert.setString(4,BCrypt.hashpw(password,BCrypt.gensalt(12)));insert.setString(5,settings.getString("start_motto"));
                    insert.setInt(6,Emulator.getIntUnixTimestamp());insert.setInt(7,Emulator.getIntUnixTimestamp());insert.setInt(8,Emulator.getIntUnixTimestamp());insert.setString(9,ip);insert.setString(10,ip);insert.setString(11,mail);insert.setString(12,sso);insert.setInt(13,settings.getInt("start_credits"));insert.setInt(14,settings.getInt("start_room"));insert.executeUpdate();
                    try(ResultSet keys=insert.getGeneratedKeys()){if(!keys.next())throw new SQLException("Registration did not return user id");id=keys.getInt(1);}
                }
                int diamonds=settings.getInt("start_diamonds"),points=settings.getInt("start_points");
                try(PreparedStatement currency=connection.prepareStatement("INSERT INTO users_currency(user_id,type,amount) VALUES(?,?,?) ON DUPLICATE KEY UPDATE amount=amount+VALUES(amount)")){
                    if(diamonds>0){currency.setInt(1,id);currency.setInt(2,5);currency.setInt(3,diamonds);currency.executeUpdate();}
                    if(points>0){currency.setInt(1,id);currency.setInt(2,settings.getInt("points_type"));currency.setInt(3,points);currency.executeUpdate();}
                }
                String badge=settings.getString("welcome_badge");if(!badge.isEmpty()){try(PreparedStatement welcome=connection.prepareStatement("INSERT INTO users_badges(user_id,slot_id,badge_code) VALUES(?,0,?)")){welcome.setInt(1,id);welcome.setString(2,badge);welcome.executeUpdate();}}
                connection.commit();return loadAccount(sso);
            }catch(Exception e){connection.rollback();Main.getLogger().error("Registration transaction failed",e);return null;}
        }catch(SQLException e){Main.getLogger().error("Registration connection failed",e);return null;}
    }

    public static boolean updateAccountSettings(Account account){
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("UPDATE users_settings SET block_following = ?, block_friendrequests = ?, block_roominvites = ?, can_trade = ?, block_alerts = ? WHERE user_id = ?")) {
            statement.setString(1, account.getSettings().isBlockFollowing() ? "1" : "0");
            statement.setString(2, account.getSettings().isBlockFriendRequests() ? "1" : "0");
            statement.setString(3, account.getSettings().isBlockRoomInvites() ? "1" : "0");
            statement.setString(4, account.getSettings().isAllowTrade() ? "1" : "0");
            statement.setString(5, account.getSettings().isBlockAlerts() ? "1" : "0");
            statement.setInt(6, account.getId());
            statement.execute();
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
            return false;
        }

        return true;
    }

    public static boolean updateEmailandMotto(Account account){
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("UPDATE users SET mail = ?, motto = ? WHERE id = ?")) {
            statement.setString(1, account.getEmail());
            statement.setString(2, account.getMotto());
            statement.setInt(3, account.getId());
            statement.execute();
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
            return false;
        }

        return true;
    }

    public static AccountSetting getAccountSetting(int id) {
        AccountSetting settings = null;

        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("SELECT * FROM users_settings WHERE user_id = ? LIMIT 1")) {
            statement.setInt(1, id);
            try (ResultSet set = statement.executeQuery()) {
                if (set.next()) {
                    settings = new AccountSetting(set);
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        } catch (Exception ex) {
            Main.getLogger().error("Caught exception", ex);
        }

        return settings;
    }

    public static boolean createSubscription(String subscriptionType, int duration, Account account) {
        HabboInfo habbo = Emulator.getGameEnvironment().getHabboManager().getHabboInfo(account.getId());

        if (habbo != null){
            Subscription subscription = habbo.getHabboStats().getSubscription(subscriptionType);

            if(subscription != null) {
                if (!Emulator.getPluginManager().fireEvent(new UserSubscriptionExtendedEvent(account.getId(), subscription, duration)).isCancelled()) {
                    subscription.addDuration(duration);
                    subscription.onExtended(duration);
                }
                return true;
            }

            if (!Emulator.getPluginManager().fireEvent(new UserSubscriptionCreatedEvent(account.getId(), subscriptionType, duration)).isCancelled()) {
                int startTimestamp = Emulator.getIntUnixTimestamp();
                try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); PreparedStatement statement = connection.prepareStatement("INSERT INTO `users_subscriptions` (`user_id`, `subscription_type`, `timestamp_start`, `duration`, `active`) VALUES (?, ?, ?, ?, ?)", Statement.RETURN_GENERATED_KEYS)) {
                    statement.setInt(1, account.getId());
                    statement.setString(2, subscriptionType);
                    statement.setInt(3, startTimestamp);
                    statement.setInt(4, duration);
                    statement.setInt(5, 1);
                    statement.execute();
                    try (ResultSet set = statement.getGeneratedKeys()) {
                        if (set.next()) {
                            Class<? extends Subscription> subClazz = Emulator.getGameEnvironment().getSubscriptionManager().getSubscriptionClass(subscriptionType);
                            try {
                                Constructor<? extends Subscription> c = subClazz.getConstructor(Integer.class, Integer.class, String.class, Integer.class, Integer.class, Boolean.class);
                                c.setAccessible(true);
                                Subscription sub = c.newInstance(set.getInt(1), account.getId(), subscriptionType, startTimestamp, duration, true);
                                habbo.getHabboStats().subscriptions.add(sub);
                                sub.onCreated();
                                return true;
                            }
                            catch (Exception e) {
                                Main.getLogger().error("Caught exception", e);
                            }
                        }
                    }
                } catch (SQLException e) {
                    Main.getLogger().error("Caught SQL exception", e);
                }
            }
        }
        return false;
    }

    public static int getExitsRooms(String username) {
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("SELECT * FROM rooms WHERE owner_name = ?")) {
            statement.setString(1, username);
            try (ResultSet set = statement.executeQuery()) {
                if (set.next()) {
                    return set.getInt("owner_id");
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        } catch (Exception ex) {
            Main.getLogger().error("Caught exception", ex);
        }

        return 0;
    }

    public static boolean updateAccountId(Account account){
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("UPDATE users SET id = ? WHERE username = ?")) {
            statement.setInt(1, account.getId());
            statement.setString(2, account.getUsername());
            statement.execute();
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
            return false;
        }

        return true;
    }

}
