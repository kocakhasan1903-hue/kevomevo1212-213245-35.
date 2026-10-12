package server.data.classes.cooldown;

import server.websocket.client.WebSocketClient;

import java.util.concurrent.TimeUnit;

public class CooldownManager {
    private String COOLDOWN = "cooldown-";

    public void setCooldown(WebSocketClient client, String type, int seconds) {
            long daysMilli = TimeUnit.MILLISECONDS.convert(seconds, TimeUnit.SECONDS);
            client.cache.put(this.COOLDOWN + type, Long.valueOf(System.currentTimeMillis() + daysMilli));
    }

    public boolean isOnCooldown(WebSocketClient client, String type) {
        boolean cooldown = ((client).cache.containsKey(this.COOLDOWN + type) && System.currentTimeMillis() < ((Long)(client).cache.get(this.COOLDOWN + type)).longValue());
        if (cooldown) {
            int secondsLeft = (int)(((Long)(client).cache.get(this.COOLDOWN + type)).longValue() - System.currentTimeMillis()) / 1000;
            if (secondsLeft <= 0)
                (client).cache.remove(this.COOLDOWN + type);
        }
        return cooldown;
    }

    public int getSecondsLeft(WebSocketClient client, String type) {
        if (!isOnCooldown(client, type))
            return 0;
        return (int)(((Long)(client).cache.get(this.COOLDOWN + type)).longValue() - System.currentTimeMillis()) / 1000;
    }
}
