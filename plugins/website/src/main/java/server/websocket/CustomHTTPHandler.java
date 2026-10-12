package server.websocket;

import com.eu.habbo.Emulator;
import io.netty.buffer.Unpooled;
import io.netty.channel.ChannelFutureListener;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelInboundHandlerAdapter;
import io.netty.handler.codec.http.*;
import io.netty.util.ReferenceCountUtil;
import server.utils.Utils;
import server.websocket.client.WebSocketClientManager;

public class CustomHTTPHandler extends ChannelInboundHandlerAdapter {
    private static final String ORIGIN_HEADER = "Origin";
    //private static final String FORWARD_PROXY_REALIP = "X-Forwarded-For";

    @Override
    public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {
        if(msg instanceof HttpMessage) {
            if(!handleHttpRequest(ctx, (HttpMessage) msg))
            {
                ReferenceCountUtil.release(msg);//discard message
                return;
            }
        }
        super.channelRead(ctx, msg);
        ctx.pipeline().remove(this);
    }

    public boolean handleHttpRequest(ChannelHandlerContext ctx, HttpMessage req) {
        String origin = "error";


        try {
            if(req.headers().contains(ORIGIN_HEADER)) {
                origin = Utils.getDomainNameFromUrl(req.headers().get(ORIGIN_HEADER));
            }
        } catch (Exception ignored) { }

        if(!Utils.isWhitelisted(origin, Emulator.getConfig().getValue("websockets.whitelist", "localhost").split(","))) {
            FullHttpResponse response = new DefaultFullHttpResponse(HttpVersion.HTTP_1_1, HttpResponseStatus.FORBIDDEN, Unpooled.wrappedBuffer("Origin forbidden".getBytes()));
            ctx.writeAndFlush(response).addListener(ChannelFutureListener.CLOSE);
            return false;
        }

        String header = Emulator.getConfig().getValue("ws.cms.ip.header", "X-Forwarded-For");

        if(!header.isEmpty() && req.headers().contains(header)) {
            String ip = req.headers().get(header);
            ctx.channel().attr(WebSocketClientManager.CLIENT_IP).set(ip);
        }
        String browser=req.headers().get("User-Agent","");
        ctx.channel().attr(server.websocket.security.SecurityAudit.BROWSER).set(browser.substring(0,Math.min(256,browser.length())));
        return true;
    }
}