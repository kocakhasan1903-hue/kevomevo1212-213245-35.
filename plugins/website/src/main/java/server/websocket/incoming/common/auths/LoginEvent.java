package server.websocket.incoming.common.auths;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.bcrypt.BCrypt;
import server.data.classes.account.Account;
import server.data.queries.AccountDao;
import server.utils.Utils;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.misc.DataComposer;
import server.websocket.outgoing.common.account.GetAccountComposer;

public class LoginEvent extends IncomingWebMessage<LoginEvent.JSONLoginEvent> {
    public LoginEvent(){super(JSONLoginEvent.class);}

    public static Logger LOGGER = LoggerFactory.getLogger(LoginEvent.class);

    @Override
    public void handle(WebSocketClient client, JSONLoginEvent message){
            if(message==null||message.username==null||message.password==null||message.username.length()>32||message.password.length()>72){client.sendMessage(new DataComposer("loginResponse","Ungültige Zugangsdaten."));return;}
            String username = message.username;
            String password = message.password;

            Account account = AccountDao.getAccountByUsername(username);

            if (account != null){
                if (BCrypt.checkpw(password, account.password)){
                    if (Utils.checkForBan(account.getId())){
                        client.setAccount(account);
                        server.websocket.security.SecurityAudit.record(client,"login_success",username,"CMS-Anmeldung erfolgreich.");
                        client.getAccount().sso = AccountDao.updateSSO(account);
                        client.getAccount().ipLogin = AccountDao.updateIp(client);

                        client.sendMessage(new DataComposer("loginResponse", issueSession(client)));
                        client.sendMessage(new GetAccountComposer(client.getAccount()));
                    }
                    else client.sendMessage(new DataComposer("loginResponse", "Esta cuenta esta baneada"));
                }
                else {server.websocket.security.SecurityAudit.record(client,"login_failed",username,"Zugangsdaten nicht bestätigt.");client.sendMessage(new DataComposer("loginResponse", "Zugangsdaten nicht bestätigt."));}
            }
            else {server.websocket.security.SecurityAudit.record(client,"login_failed",username,"Zugangsdaten nicht bestätigt.");client.sendMessage(new DataComposer("loginResponse", "Zugangsdaten nicht bestätigt."));}
    }

    private String issueSession(WebSocketClient client){
        try{return CmsSession.issue(client.getAccount());}
        catch(Exception e){throw new IllegalStateException("Unable to create CMS session",e);}
    }

    static class JSONLoginEvent {
        String username;
        String password;
    }
}
