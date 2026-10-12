package server.utils;

import com.eu.habbo.Emulator;
import server.Main;

import java.net.URI;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class Utils {

    private static final java.security.SecureRandom SESSION_RANDOM = new java.security.SecureRandom();

    public static String generateSSO() {
        final String alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz";
        StringBuilder token = new StringBuilder(60);
        for (int i = 0; i < 60; i++) token.append(alphabet.charAt(SESSION_RANDOM.nextInt(alphabet.length())));
        return token.toString();
    }

    public static boolean checkForBan(int userId) {
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); PreparedStatement statement = connection.prepareStatement("SELECT * FROM bans WHERE user_id = ? AND ban_expire >= ?  ORDER BY timestamp LIMIT 1")) {
            statement.setInt(1, userId);
            statement.setInt(2, Emulator.getIntUnixTimestamp());

            try (ResultSet set = statement.executeQuery()) {
                if (set.next()) {
                    return false;
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }

        return true;
    }

    public static String getDomainNameFromUrl(String url) throws Exception {
        URI uri = new URI(url);
        String domain = uri.getHost();
        return domain.startsWith("www.") ? domain.substring(4) : domain;
    }

    public static boolean isWhitelisted(String toCheck, String[] whitelist) {
        for(String whitelistEntry : whitelist) {
            if(whitelistEntry.startsWith("*")) {
                if(toCheck.endsWith(whitelistEntry.substring(1)) || ("." + toCheck).equals(whitelistEntry.substring(1))) return true;
            } else {
                if(toCheck.equals(whitelistEntry)) return true;
            }
        }
        return false;
    }


}
