package server.websocket.incoming.common.auths;
import com.eu.habbo.Emulator;
import server.data.classes.account.Account;
import server.data.queries.AccountDao;
import server.utils.Utils;
import java.sql.*;
import java.security.*;
import java.nio.charset.StandardCharsets;
public final class CmsSession {
 private static String hash(String value) throws Exception {
  byte[] bytes=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
  StringBuilder s=new StringBuilder();for(byte b:bytes)s.append(String.format("%02x",b&255));return s.toString();
 }
 public static String issue(Account account) throws Exception {
  byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);StringBuilder token=new StringBuilder("cms_");for(byte b:bytes)token.append(String.format("%02x",b&255));
  try(Connection db=Emulator.getDatabase().getDataSource().getConnection();PreparedStatement q=db.prepareStatement("INSERT INTO cms_sessions(token_hash,user_id,password_hash,expires_at) VALUES (?,?,?,UNIX_TIMESTAMP()+86400)")){
   q.setString(1,hash(token.toString()));q.setInt(2,account.getId());q.setString(3,hash(account.password));q.executeUpdate();
  }return token.toString();
 }
 public static Account authenticate(String token) throws Exception {
  if(token==null||!token.matches("cms_[0-9a-f]{64}"))return null;
  int id=0;String passwordHash=null;
  try(Connection db=Emulator.getDatabase().getDataSource().getConnection();PreparedStatement q=db.prepareStatement("SELECT user_id,password_hash FROM cms_sessions WHERE token_hash=? AND expires_at>UNIX_TIMESTAMP()")){
   q.setString(1,hash(token));try(ResultSet rs=q.executeQuery()){if(rs.next()){id=rs.getInt(1);passwordHash=rs.getString(2);}}
  }
  if(id==0)return null;Account account=AccountDao.getAccountById(id);
  return account!=null&&hash(account.password).equals(passwordHash)&&Utils.checkForBan(id)?account:null;
 }
 public static String clientTicket(Account account) throws Exception {
  try(Connection db=Emulator.getDatabase().getDataSource().getConnection();PreparedStatement q=db.prepareStatement("SELECT s.maintenance_enabled,s.maintenance_min_rank,s.maintenance_message,u.rank FROM habboje_shop.site_settings s JOIN users u ON u.id=? WHERE s.id=1")){
   q.setInt(1,account.getId());try(ResultSet r=q.executeQuery()){if(!r.next())throw new IllegalArgumentException("Hotel-Konfiguration fehlt.");if(r.getBoolean(1)&&r.getInt(4)<r.getInt(2))throw new IllegalArgumentException(r.getString(3));}
  }
  try(Connection db=Emulator.getDatabase().getDataSource().getConnection();Statement q=db.createStatement();ResultSet r=q.executeQuery("SELECT client_enabled FROM habboje_shop.feature_settings WHERE id=1")){
   if(!r.next()||!r.getBoolean(1))throw new IllegalArgumentException("Einchecken ist momentan deaktiviert.");
  }
  String token=Utils.generateSSO();
  try(Connection db=Emulator.getDatabase().getDataSource().getConnection()){
   boolean expiry=false;try(ResultSet columns=db.getMetaData().getColumns(db.getCatalog(),null,"users","auth_ticket_expires_at")){expiry=columns.next();}
   try(PreparedStatement q=db.prepareStatement("UPDATE users SET auth_ticket=?"+(expiry?",auth_ticket_expires_at=DATE_ADD(NOW(),INTERVAL 2 MINUTE)":"")+" WHERE id=?")){q.setString(1,token);q.setInt(2,account.getId());if(q.executeUpdate()!=1)throw new SQLException("Client ticket was not issued");}
  }return token;
 }
 public static void revoke(String token) throws Exception {
  if(token==null)return;
  try(Connection db=Emulator.getDatabase().getDataSource().getConnection()){
   db.setAutoCommit(false);
   try{
    int user=0;
    try(PreparedStatement q=db.prepareStatement("SELECT user_id FROM cms_sessions WHERE token_hash=? FOR UPDATE")){q.setString(1,hash(token));try(ResultSet r=q.executeQuery()){if(r.next())user=r.getInt(1);}}
    try(PreparedStatement q=db.prepareStatement("DELETE FROM cms_sessions WHERE token_hash=?")){q.setString(1,hash(token));q.executeUpdate();}
    if(user>0)try(PreparedStatement q=db.prepareStatement("DELETE FROM habboje_shop.emulator_control_sessions WHERE user_id=?")){q.setInt(1,user);q.executeUpdate();}
    db.commit();
   }catch(Exception error){db.rollback();throw error;}
  }
 }
}
