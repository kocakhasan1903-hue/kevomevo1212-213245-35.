package server.data.classes.account;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.permissions.Rank;
import gnu.trove.map.hash.THashMap;
import gnu.trove.map.hash.TIntIntHashMap;
import gnu.trove.procedure.TIntIntProcedure;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import server.Main;
import server.data.queries.AccountDao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class Account {
    public int id;
    public String username;
    public String email;
    public String password;
    public String motto;
    public String look;
    public String gender;
    public int credits;
    public Rank rank;
    public String sso = null;
    public String ipRegister;
    public String ipLogin;
    public int accountCreated;
    public int lastOnline;
    private AccountSetting settings;
    private TIntIntHashMap currencies;
    private boolean canCatalogEdit = false;


    public Account(ResultSet set){
        try {
            this.id = set.getInt("id");
            this.username = set.getString("username");
            this.email = set.getString("mail");
            this.password = set.getString("password");
            this.motto = set.getString("motto");
            this.look = set.getString("look");
            this.gender = set.getString("gender");
            this.sso = set.getString("auth_ticket");
            this.ipRegister = set.getString("ip_register");
            this.ipLogin = set.getString("ip_current");
            this.rank = Emulator.getGameEnvironment().getPermissionsManager().getRank(set.getInt("rank"));

            if (this.rank == null) {
                Main.getLogger().error("No existing rank found with id " + set.getInt("rank") + ". Make sure an entry in the permissions table exists.");
                Main.getLogger().warn(this.username + " has an invalid rank with id " + set.getInt("rank") + ". Make sure an entry in the permissions table exists.");
                this.rank = Emulator.getGameEnvironment().getPermissionsManager().getRank(1);
            }

            this.accountCreated = set.getInt("account_created");
            this.credits = set.getInt("credits");
            this.lastOnline = set.getInt("last_online");

            this.settings = AccountDao.getAccountSetting(this.id);

            loadCurrencies();

            this.canCatalogEdit = set.getString("can_edit_price").equals("1");

        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }
    }

    private void loadCurrencies() {
        this.currencies = new TIntIntHashMap();

        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); PreparedStatement statement = connection.prepareStatement("SELECT * FROM users_currency WHERE user_id = ?")) {
            statement.setInt(1, this.id);
            try (ResultSet set = statement.executeQuery()) {
                while (set.next()) {
                    this.currencies.put(set.getInt("type"), set.getInt("amount"));
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }
    }

    private void saveCurrencies() {
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); PreparedStatement statement = connection.prepareStatement("INSERT INTO users_currency (user_id, type, amount) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE amount = ?")) {
            this.currencies.forEachEntry(new TIntIntProcedure() {
                @Override
                public boolean execute(int a, int b) {
                    try {
                        statement.setInt(1, id);
                        statement.setInt(2, a);
                        statement.setInt(3, b);
                        statement.setInt(4, b);
                        statement.addBatch();
                    } catch (SQLException e) {
                        Main.getLogger().error("Caught SQL exception", e);
                    }
                    return true;
                }
            });
            statement.executeBatch();
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }
    }

    public void addCurrencyAmount(int type, int amount) {
        this.currencies.adjustOrPutValue(type, amount, amount);
        saveCurrencies();
    }

    public void setPassword(String newPassword){
        this.password = newPassword;
        AccountDao.updatePassword(this, newPassword);
    }

    public int getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getPassword() {
        return password;
    }

    public String getMotto() {
        return motto;
    }

    public String getLook() {
        return look;
    }

    public String getGender() {
        return gender;
    }

    public int getCredits() {
        return credits;
    }

    public Rank getRank() {
        return rank;
    }

    public String getSso() {
        return sso;
    }

    public String getIpRegister() {
        return ipRegister;
    }

    public String getIpLogin() {
        return ipLogin;
    }

    public int getAccountCreated() {
        return accountCreated;
    }

    public int getLastOnline() {
        return lastOnline;
    }

    public int getCurrencyAmount(int type) {
        return this.currencies.get(type);
    }

    public TIntIntHashMap getCurrencies() {
        return this.currencies;
    }

    public String getEmail() {
        return email;
    }

    public AccountSetting getSettings() {
        return settings;
    }

    public boolean getEditCatalogPrice() {
        return this.canCatalogEdit;
    }
}
