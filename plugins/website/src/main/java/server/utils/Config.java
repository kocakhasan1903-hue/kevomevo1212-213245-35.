package server.utils;

import com.eu.habbo.Emulator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import server.Main;

import java.sql.*;
import java.util.Properties;

public class Config {
    private final Properties configs;

    public Config() {
        long millis = System.currentTimeMillis();

        this.configs = new Properties();

        try {
            this.reload();

            Main.getLogger().info("Config Manager Loaded! (" + (System.currentTimeMillis() - millis) + " MS)");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public void reload() throws Exception {
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); Statement statement = connection.createStatement(); ResultSet set = statement.executeQuery("SELECT * FROM website_config")) {
            while (set.next()) {
                if (this.configs.containsKey(set.getString("key"))) {
                    this.configs.setProperty(set.getString("key"), set.getString("value"));
                } else {
                    this.configs.put(set.getString("key"), set.getString("value"));
                }
            }
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }
    }

    public String getValue(String key) {
        return this.getValue(key, "");
    }

    public String getValue(String key, String defaultValue) {
        if (!this.configs.containsKey(key)) {
            Main.getLogger().error("Config key not found: {}", key);
        }
        return this.configs.getProperty(key, defaultValue);
    }

    public boolean getBoolean(String key) {
        return this.getBoolean(key, false);
    }

    public boolean getBoolean(String key, Boolean defaultValue) {
        try {
            return (this.getValue(key, "0").equals("1")) || (this.getValue(key, "false").equals("true"));
        } catch (Exception e) {
            Main.getLogger().error("Caught exception", e);
        }
        return defaultValue;
    }

    public int getInt(String key) {
        return this.getInt(key, 0);
    }

    public int getInt(String key, Integer defaultValue) {
        try {
            return Integer.parseInt(this.getValue(key, defaultValue.toString()));
        } catch (NumberFormatException e) {
            Main.getLogger().error("Caught exception", e);
        }
        return defaultValue;
    }

    public void update(String key, String value) {
        this.configs.setProperty(key, value);
    }

    public void register(String key, String value) {
        if (this.configs.getProperty(key, null) != null)
            return;

        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection(); PreparedStatement statement = connection.prepareStatement("INSERT INTO emulator_texts VALUES (?, ?)")) {
            statement.setString(1, key);
            statement.setString(2, value);
            statement.execute();
        } catch (SQLException e) {
            Main.getLogger().error("Caught SQL exception", e);
        }

        this.update(key, value);
    }
}
