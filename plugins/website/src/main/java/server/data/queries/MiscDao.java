package server.data.queries;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.rooms.Room;
import server.Main;
import server.data.classes.account.Account;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class MiscDao {

    public static String getRoomName(int roomId) {

        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("SELECT * FROM rooms WHERE id = ? LIMIT 1")) {
            statement.setInt(1, roomId);
            try (ResultSet set = statement.executeQuery()) {
                while (set.next()) {
                    return set.getString("name");
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        } catch (Exception ex) {
            Main.getLogger().error("Caught exception", ex);
        }

        return null;
    }

    public static boolean updateRareCatalogPrice(int id, int credits, int diamonds){
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement("UPDATE rare_catalog_items SET price_credits = ?, price_diamonds = ? WHERE id = ?")) {
            statement.setInt(1, credits);
            statement.setInt(2, diamonds);
            statement.setInt(3, id);
            statement.execute();
            return true;
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }

        return  false;
    }
}
