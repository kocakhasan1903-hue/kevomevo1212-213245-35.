package server.websocket.incoming.common.community;
import com.eu.habbo.Emulator;
import com.google.gson.JsonObject;
import server.Main;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.misc.DataComposer;
import java.sql.*;
public class CmsPageEvent extends IncomingWebMessage<CmsPageEvent.Request>{
    public CmsPageEvent(){super(Request.class);}
    @Override public void handle(WebSocketClient client,Request req){
        if(req==null || req.slug==null || !req.slug.matches("[a-z0-9-]{1,40}"))return;
        JsonObject data=new JsonObject();data.addProperty("slug",req.slug);
        try(Connection db=Emulator.getDatabase().getDataSource().getConnection();PreparedStatement q=db.prepareStatement("SELECT title,body FROM website_cms_pages WHERE slug=?")){
            q.setString(1,req.slug);try(ResultSet r=q.executeQuery()){
                if(r.next()){data.addProperty("title",r.getString(1));data.addProperty("body",r.getString(2));}
                else data.addProperty("error","Diese Seite wurde noch nicht veröffentlicht.");
            }
        }catch(SQLException e){Main.getLogger().error("CMS page failed",e);data.addProperty("error","Die Seite konnte nicht geladen werden.");}
        client.sendMessage(new DataComposer("cmsPage",data.toString()));
    }
    public static class Request {public String slug;}
}
