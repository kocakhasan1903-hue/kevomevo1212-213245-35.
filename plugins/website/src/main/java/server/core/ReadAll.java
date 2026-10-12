package server.core;

import com.eu.habbo.Emulator;
import server.Main;

public class ReadAll {
    public static void readAll() {
        ReadCommands.readCommand();
        Emulator.getPluginManager().registerEvents(Main.INSTANCE, new Listener());
    }
}
