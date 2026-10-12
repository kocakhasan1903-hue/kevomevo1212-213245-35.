package server.websocket.security;
import com.eu.habbo.Emulator;
import io.netty.util.AttributeKey;
import server.websocket.client.WebSocketClient;
import java.sql.*;
import java.util.concurrent.*;
public final class SecurityAudit {
 public static final AttributeKey<String> BROWSER=AttributeKey.valueOf("CmsBrowser");
 private static final ThreadPoolExecutor WRITER=new ThreadPoolExecutor(1,1,0,TimeUnit.SECONDS,new ArrayBlockingQueue<Runnable>(500),r->{Thread t=new Thread(r,"CMS security audit");t.setDaemon(true);return t;},new ThreadPoolExecutor.DiscardPolicy());
 private static String clip(String text,int max){if(text==null)return "";return text.substring(0,Math.min(max,text.length()));}
 public static void record(WebSocketClient client,String action,String subject,String details){
  if(client==null)return;
  int user=client.getAccount()==null?0:client.getAccount().getId();String username=clip(client.getAccount()==null?subject:client.getAccount().getUsername(),32);
  String browser=clip(client.getChannel().attr(BROWSER).get(),256),ip=clip(client.getChannelIp(),64),note=clip(details,500);
  WRITER.execute(()->{try(Connection db=Emulator.getDatabase().getDataSource().getConnection();PreparedStatement q=db.prepareStatement("INSERT INTO habboje_shop.security_logs(user_id,username,action,confidence,browser,ip,details) VALUES(?,?,?,1,?,?,?)")){q.setInt(1,user);q.setString(2,username);q.setString(3,clip(action,40));q.setString(4,browser);q.setString(5,ip);q.setString(6,note);q.executeUpdate();}catch(Exception e){server.Main.getLogger().error("CMS security audit failed",e);}});
 }
}

