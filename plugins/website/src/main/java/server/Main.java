package server;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.plugin.EventHandler;
import com.eu.habbo.plugin.EventListener;
import com.eu.habbo.plugin.HabboPlugin;
import com.eu.habbo.plugin.events.emulator.EmulatorLoadedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import server.websocket.security.RateLimitInfo;
import server.websocket.WebSocketManager;
import server.websocket.Website;

import java.util.ArrayList;
import java.util.List;

import static server.core.ReadAll.readAll;


public class Main extends HabboPlugin implements EventListener {
    public static Main INSTANCE = null;
    public static Website website;
    public static List<RateLimitInfo> ips = new ArrayList<>();
    public static List<String> bannedIps = new ArrayList<String>();
    private static final Logger LOGGER = LoggerFactory.getLogger("[WebSocket CMS]");

    @Override
    public void onEnable() {
        INSTANCE = this;
        website = new Website();
        Emulator.getPluginManager().registerEvents(this, this);

        if (Emulator.isReady) {
            server.websocket.incoming.common.community.CmsRconStatus.register();
            server.websocket.incoming.common.community.PhantomRooms.start(INSTANCE);
            server.websocket.incoming.common.community.PremiumMemberships.start();
            LOGGER.info("Detected Plugin!");
        }
    }

    @Override
    public void onDisable() {
        server.websocket.incoming.common.community.PhantomRooms.stop();
        server.websocket.incoming.common.community.PremiumMemberships.stop();
        server.websocket.incoming.common.community.DailyLotto.stop();
        WebSocketManager.getInstance().stop();
        WebSocketManager.getInstance().Dispose();
        ips.clear();

        website.dispose();
        LOGGER.info("Disabled -> OK!");
    }

    @Override
    public boolean hasPermission(Habbo habbo, String s) {
        return false;
    }

    @EventHandler
    public static void onEmulatorLoaded(EmulatorLoadedEvent event) throws Exception {

        readAll();

        WebSocketManager.Init();
        WebSocketManager.getInstance().initializePipeline();
        WebSocketManager.getInstance().connect();

        try {
            Main.website.load();
        }catch (Exception e) {
            e.printStackTrace();
        }

        LOGGER.info("Server on: " + (WebSocketManager.getInstance().isSSL() ? "wss" : "ws") + "://" + WebSocketManager.getInstance().getHost() + ":" + WebSocketManager.getInstance().getPort());
        server.websocket.incoming.common.community.DailyLotto.start();
        server.websocket.incoming.common.community.CmsRconStatus.register();
        server.websocket.incoming.common.community.PhantomRooms.start(INSTANCE);
            server.websocket.incoming.common.community.PremiumMemberships.start();
        LOGGER.info("Server loaded!");
    }

    @EventHandler
    public static void onLottoLogin(com.eu.habbo.plugin.events.users.UserLoginEvent event) {
        try { server.websocket.incoming.common.community.DailyLotto.payAtLogin(event.habbo); server.websocket.incoming.common.community.PaidLotto.onLogin(event.habbo); server.websocket.incoming.common.community.HourlyLotto.pay(event.habbo); }
        catch (Exception e) { LOGGER.error("Lotto payout deferred until next login", e); }
    }

    public static Logger getLogger(){
        return LOGGER;
    }

    public static void main(String[] args) {
        System.out.println("Â¡Por favor, mueve este archivo a tu carpeta de plugins!");
    }
}
