package server.websocket.client;

import gnu.trove.map.hash.THashMap;
import io.netty.channel.Channel;
import io.netty.handler.codec.http.websocketx.TextWebSocketFrame;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import server.data.classes.account.Account;
import server.data.queries.AccountDao;
import server.utils.JsonFactory;
import server.utils.Utils;
import server.websocket.outgoing.OutgoingWebMessage;

import java.net.InetSocketAddress;

public class WebSocketClient {
    private final Channel channel;
    private Account account;
    public THashMap<String, Object> cache = new THashMap<>(0);
    private static final Logger LOGGER = LoggerFactory.getLogger(WebSocketClient.class);

    public WebSocketClient(Channel channel) {
        this.channel = channel;
    }

    public void sendMessage(OutgoingWebMessage message) {
        if (this.channel.isOpen()) {
            if (message == null)
                return;

            this.channel.write(new TextWebSocketFrame(JsonFactory.getInstance().toJson(message)), this.channel.voidPromise());
            this.channel.flush();
        }
    }

    public boolean tryAuthenticate(String authTicket) {
        Account user = AccountDao.loadAccount(authTicket);
        if (user == null)
            return false;

        if (!Utils.checkForBan(user.getId()))
            return false;

        this.account = user;
        return true;
    }

    public Channel getChannel() { return this.channel; }

    public String getChannelIp(){
        String ipAddress = "0.0.0.0";

        if(this.channel.hasAttr(WebSocketClientManager.CLIENT_IP)) return this.channel.attr(WebSocketClientManager.CLIENT_IP).get();
        else if (this.account == null) return ((InetSocketAddress) this.channel.remoteAddress()).getAddress().getHostAddress();

        if (this.getAccount() != null) ipAddress = AccountDao.getIpAddress(this.account.getId());

        return ipAddress;
    }

    public Account getAccount() {
        return this.account;
    }

    public Account setAccount(Account account){
        return this.account = account;
    }
    public void dispose() {
        try {
            this.channel.close();
            this.account = null;
        } catch (Exception ex) {
            LOGGER.info(ex.getMessage());
        }
    }
}
