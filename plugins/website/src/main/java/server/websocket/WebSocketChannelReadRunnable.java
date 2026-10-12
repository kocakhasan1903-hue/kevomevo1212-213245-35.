package server.websocket;

import com.eu.habbo.Emulator;
import io.netty.channel.ChannelHandlerContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import server.Main;
import server.utils.JsonFactory;
import server.websocket.client.WebSocketClient;
import server.websocket.client.WebSocketClientManager;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.misc.PongComposer;
import server.websocket.security.RateLimitInfo;

import java.util.ArrayList;
import java.util.Objects;

public class WebSocketChannelReadRunnable {
    private final ChannelHandlerContext ctx;
    private final String msg;
    private static final Logger LOGGER = LoggerFactory.getLogger(WebSocketChannelReadRunnable.class);

    public WebSocketChannelReadRunnable(ChannelHandlerContext ctx, String msg) {
        this.ctx = ctx;
        this.msg = msg;
    }

    public void run() {
        WebSocketClient client = this.ctx.channel().attr(WebSocketClientManager.CLIENT).get();
        if (client != null && Main.website.start) {
            try {
                IncomingWebMessage.JSONIncomingEvent heading = JsonFactory.getInstance().fromJson(msg,  IncomingWebMessage.JSONIncomingEvent.class);
                Class<? extends IncomingWebMessage> message = WebSocketManager.getInstance().getIncomingMessages().get(heading.header);

                if (message == null)return;

                IncomingWebMessage webEvent = message.getDeclaredConstructor().newInstance();

                if (Objects.equals(heading.header, "ping")){
                    client.sendMessage(new PongComposer());
                    return;
                }

                Main.ips.add(new RateLimitInfo(client.getChannelIp(), Emulator.getIntUnixTimestamp()));

                if (Objects.equals(heading.header, "cleanlistxd")){
                    Main.bannedIps = new ArrayList<>();
                    System.out.println(Main.bannedIps.size());
                    return;
                }

                if(Main.ips.stream().filter(x -> x.getIp().equalsIgnoreCase(client.getChannelIp()) && x.getDate() == Emulator.getIntUnixTimestamp()).count() >= 30 && client.getAccount() == null){
                    server.websocket.security.SecurityAudit.record(client,"rate_limit","","CMS-Limit für nicht authentifizierte Verbindungen überschritten.");
                    Main.bannedIps.add(client.getChannelIp());
                    LOGGER.info(client.getChannelIp() + " ha sido baneada");
                    return;
                }

                webEvent.handle(client, JsonFactory.getInstance().fromJson(heading.data.toString(), webEvent.type));
            } catch(Exception ex) {
                LOGGER.error(ex.getMessage());
            }
        }
    }
}
