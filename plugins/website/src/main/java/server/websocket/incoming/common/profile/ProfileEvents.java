package server.websocket.incoming.common.profile;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.events.HabbixEventManager;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.networking.gameserver.decoders.GameMessageHandler;
import com.google.gson.*;
import java.sql.*;
import java.util.concurrent.TimeUnit;

/** Optional authenticated CMS/client adapter. Rewards, escrow, timer and chat commands are native Polaris. */
public final class ProfileEvents {
    public static JsonObject handle(int user,String action,String text)throws Exception{
        if(text==null||text.length()>20000)throw new IllegalArgumentException("Ungültige Event-Anfrage.");
        JsonObject q=new JsonParser().parse(text).getAsJsonObject();
        if(action.startsWith("eventFishing")||action.startsWith("eventAdministration")||action.startsWith("eventVoice")){JsonObject administration=EventAdministration.handle(user,action,q);administration.addProperty("requestId",HabbixEventManager.string(q,"requestId",""));administration.addProperty("action",action);return administration;}
        HabbixEventManager engine=HabbixEventManager.getInstance();
        boolean manage;try(Connection db=Emulator.getDatabase().getDataSource().getConnection()){manage=policy(db,user,"read",false);}
        boolean mutation=action.equals("eventCreate")||action.equals("eventCancel")||action.equals("eventPlanSave")||action.startsWith("eventCollection");
        if(mutation){
            try(Connection db=Emulator.getDatabase().getDataSource().getConnection()){
                String operation=action.equals("eventCancel")||action.equals("eventCollectionDelete")?"delete":action.equals("eventCreate")?"create":action.equals("eventCollectionStart")||action.equals("eventCollectionStop")?"save":HabbixEventManager.number(q,"id",0)>0?"save":"create";
                if(!policy(db,user,operation,true))throw new IllegalArgumentException("Diese Event-Aktion ist in der Housekeeping-Berechtigung gesperrt.");
            }
        }
        JsonObject state;
        if(action.equals("eventPlanSave")){
            if(!engine.canManage(user))throw new IllegalArgumentException("Eventverwaltung ist für deinen Rang nicht freigeschaltet.");
            savePlan(user,q);state=engine.state(user);state.addProperty("notice","Eventplan gespeichert; Homepage und Client verwenden denselben Plan.");
        }else if(action.equals("eventBid")||action.equals("eventJoin")){
            Habbo h=Emulator.getGameEnvironment().getHabboManager().getHabbo(user);
            if(h==null||h.getClient()==null||h.getClient().getChannel()==null)throw new IllegalArgumentException("Bitte im Hotel einchecken.");
            var client=h.getClient();var context=client.getChannel().pipeline().context(GameMessageHandler.class);
            if(context==null)throw new IllegalArgumentException("Hotel-Verbindung nicht bereit.");
            java.util.concurrent.Callable<JsonObject> work=()->{if(!client.getChannel().isActive()||client.getHabbo()!=h)throw new IllegalArgumentException("Bitte erneut einchecken.");return engine.request(user,action,q);};
            try{state=context.executor().inEventLoop()?work.call():context.executor().submit(work).get(20,TimeUnit.SECONDS);}
            catch(java.util.concurrent.ExecutionException e){if(e.getCause() instanceof IllegalArgumentException)throw (IllegalArgumentException)e.getCause();throw e;}
            catch(java.util.concurrent.TimeoutException e){throw new IllegalArgumentException("Die Verarbeitung dauert länger. Bitte vor einer erneuten Aktion den Eventstatus und dein Guthaben aktualisieren.");}
        }else state=engine.request(user,action,q);
        state.addProperty("canManage",state.get("canManage").getAsBoolean()&&manage);
        if(!state.get("canManage").getAsBoolean())state.remove("collections");
        state.addProperty("requestId",HabbixEventManager.string(q,"requestId",""));state.addProperty("action",action);
        state.add("administration",EventAdministration.state(user));addPlan(state,user,manage);return state;
    }
    /** Exact existing events policy, with native rank minimum as an additional floor. */
    public static boolean policy(Connection db,int user,String operation,boolean required)throws SQLException{
        int rank;try(PreparedStatement p=db.prepareStatement("SELECT rank FROM users WHERE id=?")){p.setInt(1,user);try(ResultSet r=p.executeQuery()){rank=r.next()?r.getInt(1):0;}}
        if(rank<6)return false;
        try{
            try(PreparedStatement p=db.prepareStatement("SELECT staff_min_rank FROM habboje_shop.site_settings WHERE id=1");ResultSet r=p.executeQuery()){if(r.next()&&rank<Math.max(6,Math.min(7,r.getInt(1))))return false;}
            if(rank>=7)return true;
            boolean exception=false;
            try(PreparedStatement p=db.prepareStatement("SELECT user_id FROM habboje_shop.staff_user_access WHERE module='events' AND user_id=?")){p.setInt(1,user);try(ResultSet r=p.executeQuery()){exception=r.next();}}
            try(PreparedStatement p=db.prepareStatement("SELECT * FROM habboje_shop.staff_access WHERE module='events'");ResultSet r=p.executeQuery()){
                if(!r.next())return true;
                if(r.getInt("enabled")==0||(!exception&&rank<r.getInt("min_rank")))return false;
                if(operation.equals("read"))return true;
                return r.getInt("allow_"+operation)!=0&&(exception||rank>=r.getInt(operation+"_rank"));
            }
        }catch(SQLException e){
            // Legacy deployments without the optional CMS retain native rank-checked event commands.
            // A present but incomplete CMS policy must never grant web administration by accident.
            if(missingTable(e))return false;throw e;
        }
    }
    private static boolean missingTable(SQLException error){String state=error.getSQLState();return "42S02".equals(state)||"42102".equals(state)||error.getErrorCode()==1146;}
    private static long stamp(JsonObject q,String key)throws Exception{try{return q.get(key).getAsBigDecimal().longValueExact();}catch(Exception e){throw new IllegalArgumentException("Ungültiger Zeitpunkt: "+key);}}
    private static void savePlan(int user,JsonObject q)throws Exception{
        int id=HabbixEventManager.number(q,"id",0),room=HabbixEventManager.number(q,"roomId",0);
        String title=HabbixEventManager.string(q,"title","").trim(),description=HabbixEventManager.string(q,"description","").trim();
        long start=stamp(q,"startsAt"),end=stamp(q,"endsAt"),now=System.currentTimeMillis()/1000;
        if(title.isEmpty()||title.length()>120||description.length()>2000||end<=start||end-start>604800||end>now+366L*86400||start<now-86400)throw new IllegalArgumentException("Bitte Titel, Beschreibung und einen gültigen Zeitraum (höchstens 7 Tage) angeben.");
        try(Connection db=Emulator.getDatabase().getDataSource().getConnection()){
            db.setAutoCommit(false);try{
                try(PreparedStatement p=db.prepareStatement("SELECT id FROM rooms WHERE id=?")){p.setInt(1,room);try(ResultSet r=p.executeQuery()){if(!r.next())throw new IllegalArgumentException("Raum nicht gefunden.");}}
                String sql=id>0?"UPDATE habboje_shop.events SET title=?,description=?,room_id=?,starts_at=?,ends_at=?,active=1 WHERE id=?":"INSERT INTO habboje_shop.events(title,description,room_id,starts_at,ends_at,host_id,active) VALUES(?,?,?,?,?,?,1)";
                try(PreparedStatement p=db.prepareStatement(sql,Statement.RETURN_GENERATED_KEYS)){p.setString(1,title);p.setString(2,description);p.setInt(3,room);p.setLong(4,start);p.setLong(5,end);p.setInt(6,id>0?id:user);int changed=p.executeUpdate();if(id>0&&changed==0)throw new IllegalArgumentException("Planeintrag nicht gefunden oder unverändert.");if(id<=0)try(ResultSet keys=p.getGeneratedKeys()){if(!keys.next())throw new SQLException("Missing event plan id");id=keys.getInt(1);}}
                try(PreparedStatement p=db.prepareStatement("INSERT INTO habboje_shop.audit(user_id,action,target) VALUES(?,'save_events',?)")){p.setInt(1,user);p.setString(2,String.valueOf(id));p.executeUpdate();}db.commit();
            }catch(Exception ex){db.rollback();throw ex;}
        }
    }
    private static void addPlan(JsonObject state,int user,boolean manage)throws SQLException{
        JsonArray plan=new JsonArray();boolean available=true;
        try(Connection db=Emulator.getDatabase().getDataSource().getConnection();PreparedStatement p=db.prepareStatement("SELECT e.id,e.title,e.description,e.room_id,e.starts_at,e.ends_at,u.username,r.name AS room_name FROM habboje_shop.events e LEFT JOIN users u ON u.id=e.host_id LEFT JOIN rooms r ON r.id=e.room_id WHERE e.active=1 AND e.ends_at>=? ORDER BY e.starts_at,e.id LIMIT 100")){
            p.setLong(1,System.currentTimeMillis()/1000);try(ResultSet r=p.executeQuery()){while(r.next()){
                JsonObject event=new JsonObject();event.addProperty("id",r.getInt(1));event.addProperty("title",r.getString(2));event.addProperty("description",r.getString(3));event.addProperty("roomId",r.getInt(4));event.addProperty("startsAt",r.getLong(5));event.addProperty("endsAt",r.getLong(6));event.addProperty("host",r.getString(7));event.addProperty("roomName",r.getString(8));plan.add(event);
            }}
        }catch(SQLException ex){if(missingTable(ex))available=false;else throw ex;}
        state.add("plan",plan);state.addProperty("planEditable",available&&manage&&state.get("canManage").getAsBoolean());
    }
}
