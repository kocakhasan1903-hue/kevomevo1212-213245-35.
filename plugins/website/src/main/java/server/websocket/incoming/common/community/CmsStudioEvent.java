package server.websocket.incoming.common.community;

import com.eu.habbo.Emulator;
import com.google.gson.*;
import server.Main;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.misc.DataComposer;
import java.sql.*;

/** Website editorial tools. Permissions are rechecked in SQL on every request. */
public class CmsStudioEvent extends IncomingWebMessage<CmsStudioEvent.Request> {
    public CmsStudioEvent() { super(Request.class); ShopBridge.start(); }
    public static boolean allowed(Connection db, int id) throws SQLException {
        try (PreparedStatement q=db.prepareStatement("SELECT u.id FROM users u JOIN habboje_shop.site_settings s ON s.id=1 WHERE u.id=? AND u.rank>=GREATEST(5,LEAST(7,s.staff_min_rank))")) {
            q.setInt(1,id);try(ResultSet r=q.executeQuery()){return r.next();}
        }
    }
    private static String text(String s,int max) {
        if(s==null || s.trim().isEmpty() || s.length()>max) throw new IllegalArgumentException("Bitte alle Pflichtfelder innerhalb der angegebenen Länge ausfüllen.");
        return s.trim();
    }
    private static void editorialAccess(Connection db,int user,String module,boolean create) throws SQLException {
        int rank=HousekeepingData.rank(db,user);
        if(rank>=7)return;
        try(PreparedStatement q=db.prepareStatement("SELECT min_rank,enabled,allow_save,allow_create,save_rank,create_rank FROM habboje_shop.staff_access WHERE module=?")){
            q.setString(1,module);
            try(ResultSet r=q.executeQuery()){
                if(r.next()&&(rank<r.getInt("min_rank")||r.getInt("enabled")==0||r.getInt(create?"allow_create":"allow_save")==0||rank<r.getInt(create?"create_rank":"save_rank")))
                    throw new IllegalArgumentException("Diese Aktion ist für deinen Rang gesperrt.");
            }
        }
    }
    private static String escape(String s){return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;").replace("'","&#39;");}
    private static String story(String body){
        java.util.regex.Matcher matcher=java.util.regex.Pattern.compile("\\[img\\](.*?)\\[/img\\]",java.util.regex.Pattern.CASE_INSENSITIVE|java.util.regex.Pattern.DOTALL).matcher(body);
        StringBuilder html=new StringBuilder();int end=0;
        while(matcher.find()){
            html.append(escape(body.substring(end,matcher.start())).replace("\n","<br>"));
            html.append("<img src=\"").append(escape(image(matcher.group(1).trim()))).append("\" alt=\"\">");end=matcher.end();
        }
        return html.append(escape(body.substring(end)).replace("\n","<br>")).toString();
    }
    private static String image(String s){
        if(s==null || s.isEmpty())return "/assets/source/hekos/images/web/big-banner.png";
        if(s.length()>500 || !(s.startsWith("https://") || (s.startsWith("/")&&!s.startsWith("//"))))throw new IllegalArgumentException("Bildadresse muss HTTPS oder ein lokaler Pfad sein.");
        return s;
    }
    @Override public void handle(WebSocketClient client,Request req){
        if(req==null)return;
        JsonObject answer=new JsonObject();answer.addProperty("requestId",req.requestId);
        try(Connection db=Emulator.getDatabase().getDataSource().getConnection()){
            if(req.action!=null && req.action.startsWith("shop_")){
                if(client.getAccount()==null&&!"shop_headerPublic".equals(req.action)&&!"shop_maintenanceUnlock".equals(req.action))throw new IllegalArgumentException("Bitte zuerst anmelden.");
                JsonObject shop=ShopBridge.request(client.getAccount()==null?0:client.getAccount().getId(),req);
                shop.addProperty("requestId",req.requestId);
                client.sendMessage(new DataComposer("cmsStudio",shop.toString()));return;
            }
            if(client.getAccount()==null || !allowed(db,client.getAccount().getId()))throw new IllegalArgumentException("Für dieses Konto ist die CMS-Verwaltung nicht freigeschaltet.");
            int user=client.getAccount().getId();
            if("dbGet".equals(req.action)||"dbSave".equals(req.action)){
                HousekeepingData.handle(db,user,req,answer);client.sendMessage(new DataComposer("cmsStudio",answer.toString()));return;
            }
            if("saveRare".equals(req.action)&&HousekeepingData.rank(db,user)<6)throw new IllegalArgumentException("Preisliste bearbeiten ab Rang 6.");
            if("saveNews".equals(req.action) || "savePage".equals(req.action) || "saveRare".equals(req.action)){
                boolean creating=req.id<=0;
                if("savePage".equals(req.action)){
                    try(PreparedStatement q=db.prepareStatement("SELECT slug FROM website_cms_pages WHERE slug=?")){
                        q.setString(1,req.slug);try(ResultSet r=q.executeQuery()){creating=!r.next();}
                    }
                }
                editorialAccess(db,user,"saveNews".equals(req.action)?"news":"saveRare".equals(req.action)?"rares":"pages",creating);
                String title=text(req.title,120),body="saveRare".equals(req.action)?"":text(req.body,20000);
                db.setAutoCommit(false);
                try{
                    if("saveNews".equals(req.action)){
                        String summary=text(req.summary,250),url=image(req.image);
                        String sql=req.id>0?"UPDATE website_articles SET title=?,short_story=?,full_story=?,image=? WHERE id=?":"INSERT INTO website_articles(title,short_story,full_story,image,user_id,timestamp) VALUES(?,?,?,?,?,?)";
                        try(PreparedStatement q=db.prepareStatement(sql)){
                            q.setString(1,title);q.setString(2,summary);q.setString(3,story(body));q.setString(4,url);
                            q.setInt(5,req.id>0?req.id:user);if(req.id<=0)q.setLong(6,System.currentTimeMillis()/1000);
                            int changed=q.executeUpdate();if(req.id>0 && changed==0){try(PreparedStatement exists=db.prepareStatement("SELECT id FROM website_articles WHERE id=?")){exists.setInt(1,req.id);try(ResultSet r=exists.executeQuery()){if(!r.next())throw new IllegalArgumentException("Nachricht nicht gefunden.");}}}
                        }
                    }else if("saveRare".equals(req.action)){
                        String category=text(req.category,40),url=image(req.image);
                        try(PreparedStatement categories=db.prepareStatement("INSERT INTO habboje_shop.price_categories(title) SELECT ? WHERE NOT EXISTS(SELECT 1 FROM habboje_shop.price_categories WHERE BINARY title=BINARY ?)")){categories.setString(1,category);categories.setString(2,category);categories.executeUpdate();}
                        if(req.credits<0||req.diamonds<0||req.furniId<0)throw new IllegalArgumentException("Preise und Möbel-ID dürfen nicht negativ sein.");
                        String sql=req.id>0?"UPDATE rare_catalog_items SET name=?,category=?,image=?,price_credits=?,price_diamonds=?,furni_id=?,date=? WHERE id=?":"INSERT INTO rare_catalog_items(name,category,image,price_credits,price_diamonds,furni_id,date) VALUES(?,?,?,?,?,?,?)";
                        try(PreparedStatement q=db.prepareStatement(sql)){
                            q.setString(1,title);q.setString(2,category);q.setString(3,url);q.setInt(4,req.credits);q.setInt(5,req.diamonds);q.setInt(6,req.furniId);q.setLong(7,System.currentTimeMillis()/1000);if(req.id>0)q.setInt(8,req.id);
                            if(q.executeUpdate()==0&&req.id>0)throw new IllegalArgumentException("Eintrag unverändert oder nicht gefunden.");
                        }
                    }else{
                        String slug=text(req.slug,40);
                        if(!slug.matches("[a-z0-9]+(?:-[a-z0-9]+)*"))throw new IllegalArgumentException("Seitenadresse: nur Kleinbuchstaben, Zahlen und Bindestriche.");
                        try(PreparedStatement q=db.prepareStatement("INSERT INTO website_cms_pages(slug,title,body,updated_by) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title),body=VALUES(body),updated_by=VALUES(updated_by)")){
                            q.setString(1,slug);q.setString(2,title);q.setString(3,body);q.setInt(4,user);q.executeUpdate();
                        }
                    }
                    try(PreparedStatement q=db.prepareStatement("INSERT INTO website_cms_audit(user_id,action,target) VALUES(?,?,?)")){
                        q.setInt(1,user);q.setString(2,req.action);q.setString(3,"savePage".equals(req.action)?req.slug:String.valueOf(req.id));q.executeUpdate();
                    }
                    db.commit();
                }catch(Exception e){db.rollback();throw e;}finally{db.setAutoCommit(true);}
                if("saveNews".equals(req.action))Main.website.articleManager.reload();
                answer.addProperty("saved",true);
            }else if(!"get".equals(req.action))throw new IllegalArgumentException("Unbekannte Aktion.");
            answer.addProperty("rank",HousekeepingData.rank(db,user));
            answer.add("modules",HousekeepingData.modules(db,HousekeepingData.rank(db,user)));
            answer.add("news",rows(db,"SELECT id,title,short_story AS summary,full_story AS body,image FROM website_articles ORDER BY id DESC LIMIT 100"));
            answer.add("rares",rows(db,"SELECT id,name AS title,category,image,price_credits AS credits,price_diamonds AS diamonds,furni_id AS furniId FROM rare_catalog_items ORDER BY id DESC LIMIT 200"));
            answer.add("pages",rows(db,"SELECT slug,title,body FROM website_cms_pages ORDER BY slug"));
            answer.add("audit",rows(db,"SELECT a.action,a.target,a.created_at,u.username FROM website_cms_audit a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 25"));
        }catch(IllegalArgumentException e){answer.addProperty("error",e.getMessage());}
        catch(Exception e){Main.getLogger().error("CMS studio request failed",e);answer.addProperty("error","Die Anfrage konnte nicht abgeschlossen werden. Bitte den Serverlog prüfen.");}
        client.sendMessage(new DataComposer("cmsStudio",answer.toString()));
    }
    public static JsonArray rows(Connection db,String sql) throws SQLException{
        JsonArray items=new JsonArray();try(PreparedStatement q=db.prepareStatement(sql);ResultSet r=q.executeQuery()){
            ResultSetMetaData meta=r.getMetaData();while(r.next()){
                JsonObject item=new JsonObject();for(int i=1;i<=meta.getColumnCount();i++)item.addProperty(meta.getColumnLabel(i),r.getString(i));items.add(item);
            }
        }return items;
    }
    public static class Request {public String requestId,action,title,summary,body,image,slug,category;public int id,credits,diamonds,furniId,page;public String table,key,search;public JsonObject values,original;}
}
