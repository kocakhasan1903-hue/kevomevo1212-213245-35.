package server.websocket;

import io.netty.channel.ChannelHandler;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.SimpleChannelInboundHandler;
import io.netty.channel.socket.ChannelInputShutdownEvent;
import io.netty.handler.codec.http.websocketx.TextWebSocketFrame;
import io.netty.handler.codec.http.websocketx.WebSocketFrame;
import io.netty.handler.timeout.IdleState;
import io.netty.handler.timeout.IdleStateEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import server.Main;
import server.websocket.client.WebSocketClient;
import server.websocket.client.WebSocketClientManager;

import java.io.IOException;

@ChannelHandler.Sharable
public class WebSocketMessageHandler extends SimpleChannelInboundHandler<WebSocketFrame> {
    private static final Logger LOGGER = LoggerFactory.getLogger(WebSocketMessageHandler.class);

    @Override
    public void channelInactive(ChannelHandlerContext ctx) {
        ctx.channel().close();
    }

    @Override
    public void channelActive(ChannelHandlerContext ctx) {
        WebSocketManager.getInstance().getClientManager().addClient(ctx);
    }

    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) {
        if (cause instanceof Exception) {
            if (!(cause instanceof IOException)) {
                //cause.printStackTrace(Logging.getErrorsRuntimeWriter());
            }
        }

        ctx.channel().close();
    }

    @Override
    protected void channelRead0(ChannelHandlerContext ctx, WebSocketFrame msg) throws Exception {

        WebSocketClient client = ctx.channel().attr(WebSocketClientManager.CLIENT).get();
        if (client != null && Main.website.start) {
            if(Main.bannedIps.contains(client.getChannelIp()) && client.getAccount() == null){
                return;
            }
        }

        if (msg instanceof TextWebSocketFrame) {
            try {
                TextWebSocketFrame message = (TextWebSocketFrame) msg;
                //System.out.println(message.text());
                WebSocketChannelReadRunnable handler = new WebSocketChannelReadRunnable(ctx, message.text());
                handler.run();
            } catch (Exception ex) {
                LOGGER.info(ex.getMessage());
            }
        }
    }

    @Override
    public void userEventTriggered(ChannelHandlerContext ctx, Object evt) {
        if (evt instanceof IdleStateEvent) {
            WebSocketClient client = ctx.channel().attr(WebSocketClientManager.CLIENT).get();

            if (client == null) {
                ctx.close();
                return;
            }

            IdleStateEvent e = (IdleStateEvent) evt;
            if (e.state() == IdleState.READER_IDLE)
                client.dispose();
        }

        if (evt instanceof ChannelInputShutdownEvent)
            ctx.close();
    }
}
