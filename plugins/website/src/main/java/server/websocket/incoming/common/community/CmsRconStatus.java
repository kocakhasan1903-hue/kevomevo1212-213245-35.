package server.websocket.incoming.common.community;

import com.eu.habbo.Emulator;
import com.eu.habbo.messages.rcon.RCONMessage;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import java.sql.Connection;
import java.sql.PreparedStatement;
import server.Main;

/** Read-only metrics command; native RCON address restrictions remain in force. */
public final class CmsRconStatus extends RCONMessage<JsonObject> {
    public CmsRconStatus(){super(JsonObject.class);}
    @Override public void handle(Gson gson,JsonObject request){this.message=ShopBridge.metrics().toString();}
    public static void register(){
        if(Emulator.getRconServer()==null)return;
        Emulator.getRconServer().addRCONMessage("cmsserverstatus",CmsRconStatus.class);
        try(Connection db=Emulator.getDatabase().getDataSource().getConnection();PreparedStatement q=db.prepareStatement("INSERT INTO habboje_shop.emulator_endpoint(id,rcon_port) VALUES(1,?) ON DUPLICATE KEY UPDATE rcon_port=VALUES(rcon_port)")){
            q.setInt(1,Emulator.getRconServer().getPort());q.executeUpdate();
        }catch(Exception error){Main.getLogger().error("CMS emulator endpoint metadata could not be published",error);}
    }
}
