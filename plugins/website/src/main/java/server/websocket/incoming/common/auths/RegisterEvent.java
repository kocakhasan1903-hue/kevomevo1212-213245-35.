package server.websocket.incoming.common.auths;

import com.eu.habbo.Emulator;
import server.Main;
import server.data.classes.cooldown.CooldownManager;
import server.data.classes.cooldown.CooldownType;
import server.data.queries.AccountDao;
import server.utils.Utils;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.misc.DataComposer;
import server.websocket.outgoing.common.account.GetAccountComposer;

public class RegisterEvent extends IncomingWebMessage<RegisterEvent.JSONRegisterEvent> {
    public RegisterEvent(){super(JSONRegisterEvent.class);}

    @Override
    public void handle(WebSocketClient client,JSONRegisterEvent message)throws InterruptedException{
        if(message==null||message.username==null||message.email==null||message.password==null||message.look==null||message.gender==null
            ||!message.username.matches("[A-Za-z0-9_.-]{3,25}")||message.email.length()>254||!message.email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")
            ||message.password.length()<6||message.password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length>72||message.look.length()>512||!(message.gender.equals("M")||message.gender.equals("F"))){
            client.sendMessage(new DataComposer("registerResponse","invalid_input"));return;
        }
        if(!Emulator.getConfig().getValue("cms.register.enabled","1").equals("1")){client.sendMessage(new DataComposer("registerResponse","Disabled"));return;}
        CooldownManager cooldown=Main.website.getCooldownManager();
        if(cooldown.isOnCooldown(client,CooldownType.REGISTER)){client.sendMessage(new DataComposer("registerResponse","cooldown"));return;}
        if(AccountDao.getUsernameExists(message.username)){client.sendMessage(new DataComposer("registerResponse","Dieser Benutzername ist bereits vergeben."));return;}
        if(AccountDao.getEmailExists(message.email)){client.sendMessage(new DataComposer("registerResponse","Diese E-Mail-Adresse wird bereits verwendet."));return;}
        String sso=Utils.generateSSO();
        client.setAccount(AccountDao.createAccount(message.username,message.look,message.gender,message.password,"",client.getChannelIp(),message.email,sso));
        if(client.getAccount()==null){client.sendMessage(new DataComposer("registerResponse","Registrierung abgelehnt. Prüfe Namen, Passwortlänge und das Accountlimit dieser IP."));return;}
        client.getAccount().sso=sso;
        client.sendMessage(new DataComposer("registerResponse",issueSession(client)));
        client.sendMessage(new GetAccountComposer(client.getAccount()));
        cooldown.setCooldown(client,CooldownType.REGISTER,120);
        Main.website.communityManager.updateLastUsers(client.getAccount());
    }

        private String issueSession(WebSocketClient client){
        try{return CmsSession.issue(client.getAccount());}
        catch(Exception e){throw new IllegalStateException("Unable to create CMS session",e);}
    }

static  class JSONRegisterEvent {
        String username;
        String email;
        String password;
        String look;
        String gender;
    }
}
