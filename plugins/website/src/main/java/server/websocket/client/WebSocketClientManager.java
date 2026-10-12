package server.websocket.client;

import io.netty.channel.Channel;
import io.netty.channel.ChannelFutureListener;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelId;
import io.netty.util.AttributeKey;
import server.websocket.outgoing.OutgoingWebMessage;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

public class WebSocketClientManager {
    public static final AttributeKey<WebSocketClient> CLIENT = AttributeKey.valueOf("WebSocketCMS");
    public static final AttributeKey<String> CLIENT_IP = AttributeKey.valueOf("WebSocketIP");

    private final ConcurrentMap<ChannelId, WebSocketClient> clients;

    public WebSocketClientManager() {
        this.clients = new ConcurrentHashMap<>();
    }

    public boolean addClient(ChannelHandlerContext ctx) {
        WebSocketClient client = new WebSocketClient(ctx.channel());
        ctx.channel().closeFuture().addListener((ChannelFutureListener) channelFuture ->
                this.disposeClient(ctx.channel())
        );

        ctx.channel().attr(CLIENT).set(client);
        ctx.fireChannelRegistered();

        return this.clients.putIfAbsent(ctx.channel().id(), client) == null;
    }

    public WebSocketClient getWebSocketClientForAccount(int id) {
        for(WebSocketClient client : this.clients.values()) {
            if (client.getAccount() == null)
                continue;
            if (client.getAccount().id == id)
                return client;
        }
        return null;
    }

    public void disconnectAccount(int accountId) {
        for (WebSocketClient client : this.clients.values()) {
            if (client.getAccount() != null && client.getAccount().getId() == accountId) client.dispose();
        }
    }

    public void sendWSForAll(OutgoingWebMessage composer) {
        for(WebSocketClient client : this.clients.values()) {
            if (client.getAccount() != null) client.sendMessage(composer);
        }
    }


    public void disposeClient(WebSocketClient client) {
        this.disposeClient(client.getChannel());
    }

    private void disposeClient(Channel channel) {
        WebSocketClient client = channel.attr(CLIENT).get();

        if (client != null)
            client.dispose();

        channel.deregister();
        channel.attr(CLIENT).set(null);
        channel.closeFuture();
        channel.close();
        this.clients.remove(channel.id());
    }

    public void dispose() {
        clients.forEach((k,v) -> {
            v.dispose();
            v.getChannel().deregister();
            v.getChannel().attr(CLIENT).set(null);
            v.getChannel().closeFuture();
            v.getChannel().close();
        });

        clients.clear();
    }
}
