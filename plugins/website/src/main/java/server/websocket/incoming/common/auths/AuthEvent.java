package server.websocket.incoming.common.auths;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.misc.DataComposer;
import server.websocket.outgoing.common.account.GetAccountComposer;
import server.data.classes.account.Account;
import server.data.queries.AccountDao;
import server.Main;
public class AuthEvent extends IncomingWebMessage<AuthEvent.JSONAuthEvent>{
 public AuthEvent(){super(JSONAuthEvent.class);}
 @Override public void handle(WebSocketClient client,JSONAuthEvent message){
  if(message==null)return;
  try {
   if("clientTicket".equals(message.action)){
    Account account=CmsSession.authenticate(message.sso);
    if(account==null||client.getAccount()==null||client.getAccount().getId()!=account.getId()){client.sendMessage(new DataComposer("clientTicketError","Bitte erneut anmelden."));return;}
    client.sendMessage(new DataComposer("clientTicket",CmsSession.clientTicket(account)));return;
   }
   if("logout".equals(message.action)){CmsSession.revoke(message.sso);client.setAccount(null);return;}
   Account account=CmsSession.authenticate(message.sso);
   String session=message.sso;
   if(account==null&&message.sso!=null&&!message.sso.startsWith("cms_")&&client.tryAuthenticate(message.sso)){account=client.getAccount();session=CmsSession.issue(account);}
   if(account==null){client.sendMessage(new DataComposer("authResponse","Error"));return;}
   client.setAccount(account);
   client.sendMessage(new DataComposer("cmsSession",session));
   client.sendMessage(new DataComposer("authResponse","Success"));client.sendMessage(new GetAccountComposer(account));
  }catch(IllegalArgumentException e){client.sendMessage(new DataComposer("clientTicketError",e.getMessage()));
  }catch(Exception e){Main.getLogger().error("CMS session failed",e);client.sendMessage(new DataComposer("sessionError","Die Anmeldung ist momentan nicht verfuegbar."));}
 }
 static class JSONAuthEvent{String sso,action;}
}
