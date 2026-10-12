package server.websocket.incoming.common.community;
import com.eu.habbo.Emulator;
import com.eu.habbo.plugin.EventHandler;
import com.eu.habbo.plugin.EventListener;
import com.eu.habbo.plugin.events.users.UserLoginEvent;
import com.eu.habbo.plugin.events.users.UserTalkEvent;
import com.eu.habbo.plugin.events.marketplace.MarketPlaceItemSoldEvent;
import java.sql.*;
public final class HousekeepingHooks implements EventListener {
 @EventHandler public static void login(UserLoginEvent e){
  try(Connection db=Emulator.getDatabase().getDataSource().getConnection();PreparedStatement q=db.prepareStatement("INSERT INTO habboje_shop.login_logs(user_id,ip) VALUES(?,?)")){q.setInt(1,e.habbo.getHabboInfo().getId());q.setString(2,e.ip);q.executeUpdate();}catch(Exception ex){server.Main.getLogger().error("Housekeeping login log failed",ex);}
 }
 @EventHandler public static void sale(MarketPlaceItemSoldEvent e){
  if(e.seller==null||e.purchaser==null)return;
  try(Connection db=Emulator.getDatabase().getDataSource().getConnection();PreparedStatement q=db.prepareStatement("INSERT INTO habboje_shop.market_logs(seller_id,buyer_id,item_id,price) VALUES(?,?,?,?)")){q.setInt(1,e.seller.getHabboInfo().getId());q.setInt(2,e.purchaser.getHabboInfo().getId());q.setInt(3,e.item.getId());q.setInt(4,e.price);q.executeUpdate();}catch(Exception ex){server.Main.getLogger().error("Housekeeping marketplace log failed",ex);}
 }
 @EventHandler public static void emote(UserTalkEvent e){
  if(e.habbo.getRoomUnit().getRoom()==null)return;
  try(Connection db=Emulator.getDatabase().getDataSource().getConnection();PreparedStatement q=db.prepareStatement("SELECT effect_id FROM habboje_shop.chat_emotes WHERE keyword=? AND min_rank<=? AND enabled=1 AND image_url='' AND effect_id>0")){q.setString(1,e.chatMessage.getMessage().trim());q.setInt(2,e.habbo.getHabboInfo().getRank().getId());try(ResultSet r=q.executeQuery()){if(r.next())e.habbo.getRoomUnit().getRoom().giveEffect(e.habbo,r.getInt(1),3);}}catch(Exception ex){server.Main.getLogger().error("Housekeeping chat emote failed",ex);}
 }
}
