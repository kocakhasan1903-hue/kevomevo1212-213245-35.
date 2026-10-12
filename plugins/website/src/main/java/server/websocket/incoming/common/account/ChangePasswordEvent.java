package server.websocket.incoming.common.account;

import com.eu.habbo.Emulator;
import java.sql.*;
import java.nio.charset.StandardCharsets;
import org.springframework.security.crypto.bcrypt.BCrypt;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.misc.DataComposer;

public class ChangePasswordEvent extends IncomingWebMessage<ChangePasswordEvent.JSONChangePasswordEvent> {
 public ChangePasswordEvent(){super(JSONChangePasswordEvent.class);}
 public void handle(WebSocketClient client,JSONChangePasswordEvent message){
  if(client.getAccount()==null||message==null||message.passwordActual==null||message.password==null||message.rPassword==null){reply(client,"Ungültige Anfrage.");return;}
  if(message.passwordActual.getBytes(StandardCharsets.UTF_8).length>72||message.password.getBytes(StandardCharsets.UTF_8).length>72){reply(client,"Das Passwort darf höchstens 72 UTF-8-Bytes enthalten.");return;}
  if(!message.password.equals(message.rPassword)){reply(client,"Die neuen Passwörter stimmen nicht überein.");return;}
  try(Connection db=Emulator.getDatabase().getDataSource().getConnection()){
   db.setAutoCommit(false);
   try{
    int minimum;
    try(Statement q=db.createStatement();ResultSet r=q.executeQuery("SELECT min_password_length FROM habboje_shop.registration_settings WHERE id=1")){if(!r.next())throw new SQLException("Password policy missing");minimum=r.getInt(1);}
    if(message.password.length()<minimum){db.rollback();reply(client,"Das Passwort muss mindestens "+minimum+" Zeichen enthalten.");return;}
    try(PreparedStatement q=db.prepareStatement("SELECT password FROM users WHERE id=? FOR UPDATE")){
     q.setInt(1,client.getAccount().getId());try(ResultSet r=q.executeQuery()){
      if(!r.next()||!BCrypt.checkpw(message.passwordActual,r.getString(1))){db.rollback();reply(client,"Das aktuelle Passwort ist falsch.");return;}
     }
    }
    String hashed=BCrypt.hashpw(message.password,BCrypt.gensalt(12));
    try(PreparedStatement q=db.prepareStatement("UPDATE users SET password=? WHERE id=?")){q.setString(1,hashed);q.setInt(2,client.getAccount().getId());q.executeUpdate();}
    for(String table:new String[]{"cms_sessions","habboje_shop.emulator_control_sessions"})try(PreparedStatement q=db.prepareStatement("DELETE FROM "+table+" WHERE user_id=?")){q.setInt(1,client.getAccount().getId());q.executeUpdate();}
    db.commit();int accountId=client.getAccount().getId();reply(client,"Passwort geändert. Bitte melde dich erneut an.");server.websocket.WebSocketManager.getInstance().getClientManager().disconnectAccount(accountId);
   }catch(Exception ex){db.rollback();throw ex;}
  }catch(Exception ex){reply(client,"Das Passwort konnte nicht geändert werden.");}
 }
 private static void reply(WebSocketClient client,String text){client.sendMessage(new DataComposer("passwordResponse",text));}
 static class JSONChangePasswordEvent{String passwordActual;String password;String rPassword;}
}
