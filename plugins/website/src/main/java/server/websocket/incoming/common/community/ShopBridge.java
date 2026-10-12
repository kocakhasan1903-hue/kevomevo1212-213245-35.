package server.websocket.incoming.common.community;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.habbohotel.economy.EconomyLedger;
import com.eu.habbo.habbohotel.economy.EconomyOperation;
import com.eu.habbo.messages.outgoing.users.UserCreditsComposer;
import com.eu.habbo.messages.outgoing.users.UserCurrencyComposer;
import com.eu.habbo.messages.outgoing.inventory.InventoryRefreshComposer;
import com.google.gson.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.util.*;
import server.Main;

/** Authenticated, server-to-server shop gateway and durable game reward delivery. */
public final class ShopBridge {
    private static final Timer DELIVERY = new Timer("CMS shop deliveries",true);
    static { DELIVERY.schedule(new TimerTask(){public void run(){try{deliver();staffCommands();badgePayments();}catch(Exception e){Main.getLogger().error("Shop delivery retry failed",e);}}},10000,10000); }
    private static boolean hooksStarted=false;
    public static synchronized void start() {if(!hooksStarted){Emulator.getPluginManager().registerEvents(Main.INSTANCE,new HousekeepingHooks());hooksStarted=true;com.eu.habbo.habbohotel.commands.CommandHandler.addCommand(new EventPrizeCommand());com.eu.habbo.habbohotel.commands.CommandHandler.addCommand(new BuyBubbleCommand());}}
    public static JsonObject request(int user,CmsStudioEvent.Request req) throws Exception {
        if(Emulator.isReady){PhantomRooms.start(Main.INSTANCE);PremiumMemberships.start();}
        if("shop_emulatorStatus".equals(req.action))return emulatorStatus(user);
        if("shop_emulatorLogs".equals(req.action))return emulatorLogs(user,req.values);
        Properties config=new Properties();
        try(InputStream in=new FileInputStream("/etc/habboje-shop-bridge.properties")){config.load(in);}
        List<com.eu.habbo.habbohotel.bots.Bot> pausedBots=new ArrayList<>();
        if(("shop_hkSave".equals(req.action)||"shop_hkDelete".equals(req.action))&&req.values!=null&&req.values.has("module")&&"bots".equals(req.values.get("module").getAsString())&&req.values.has("original")&&!req.values.get("original").isJsonNull()){
            try(Connection db=Emulator.getDatabase().getDataSource().getConnection();PreparedStatement q=db.prepareStatement("SELECT rank FROM users WHERE id=?")){
                q.setInt(1,user);try(ResultSet r=q.executeQuery()){if(!r.next()||r.getInt(1)<6)throw new IllegalArgumentException("Bot-Bearbeitung benötigt Rang 6.");}
            }
            int botId=req.values.getAsJsonObject("original").get("id").getAsInt();
            for(com.eu.habbo.habbohotel.rooms.Room room:Emulator.getGameEnvironment().getRoomManager().getActiveRooms()){
                com.eu.habbo.habbohotel.bots.Bot bot=room.getBot(botId);if(bot!=null){bot.setCmsPaused(true);pausedBots.add(bot);}
            }
            for(Habbo online:Emulator.getGameEnvironment().getHabboManager().getOnlineHabbos().values()){
                com.eu.habbo.habbohotel.bots.Bot bot=online.getInventory().getBotsComponent().getBot(botId);
                if(bot!=null&&!pausedBots.contains(bot)){bot.setCmsPaused(true);pausedBots.add(bot);}
            }
        }
        JsonObject data=new JsonObject();data.addProperty("user",user);data.addProperty("action",req.action.substring(5));data.add("values",req.values==null?new JsonObject():req.values);
        HttpURLConnection connection=(HttpURLConnection)new URL("http://127.0.0.1:2088/request").openConnection();
        try{
        connection.setRequestMethod("POST");connection.setConnectTimeout(3000);connection.setReadTimeout(65000);connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type","application/json; charset=utf-8");connection.setRequestProperty("X-Shop-Key",config.getProperty("key"));
        try(OutputStream out=connection.getOutputStream()){out.write(data.toString().getBytes(StandardCharsets.UTF_8));}
        try(InputStream in=connection.getInputStream();Reader reader=new InputStreamReader(in,StandardCharsets.UTF_8)){JsonObject result=new JsonParser().parse(reader).getAsJsonObject();
            JsonObject values=req.values;
            if(!result.has("error")&&"shop_hkSave".equals(req.action)&&result.has("ban_id")&&result.get("ban_id").getAsInt()>0){
                try{applyStoredBan(result.get("ban_id").getAsInt());result.addProperty("notice","Ban gespeichert und aktive Spielverbindungen geprüft.");}
                catch(Exception e){Main.getLogger().error("Stored CMS ban enforcement failed",e);result.addProperty("notice","Ban gespeichert; sofortige Durchsetzung fehlgeschlagen. Emulator-Protokoll prüfen.");}
            }
            if(!result.has("error")&&"shop_hkGrant".equals(req.action)&&result.has("reset_user_id")&&result.get("reset_user_id").getAsInt()>0){
                int targetId=result.get("reset_user_id").getAsInt();
                try(Connection db=Emulator.getDatabase().getDataSource().getConnection();PreparedStatement q=db.prepareStatement("SELECT look FROM users WHERE id=?")){
                    q.setInt(1,targetId);try(ResultSet r=q.executeQuery()){if(r.next()){
                        Habbo online=Emulator.getGameEnvironment().getHabboManager().getHabbo(targetId);
                        if(online!=null){
                            online.getHabboInfo().setLook(r.getString("look"));
                            online.getClient().sendResponse(new com.eu.habbo.messages.outgoing.users.UpdateUserLookComposer(online));
                            if(online.getHabboInfo().getCurrentRoom()!=null)online.getHabboInfo().getCurrentRoom().sendComposer(new com.eu.habbo.messages.outgoing.rooms.users.RoomUserDataComposer(online).compose());
                            online.getMessenger().connectionChanged(online,online.isOnline(),online.getHabboInfo().getCurrentRoom()!=null);
                        }
                        result.addProperty("notice","Aussehen zurückgesetzt und im Client übernommen.");
                    }}
                }catch(Exception e){Main.getLogger().error("Look reset live update failed",e);result.addProperty("notice","Aussehen gespeichert; Live-Übernahme fehlgeschlagen. Emulator-Protokoll prüfen.");}
            }
            boolean audioUpload="shop_hkUpload".equals(req.action)&&values!=null&&values.has("kind")&&"audio".equals(values.get("kind").getAsString());
            boolean audioChange=("shop_hkSave".equals(req.action)||"shop_hkDelete".equals(req.action))&&values!=null&&values.has("module")&&"audio".equals(values.get("module").getAsString());
            if(!result.has("error")&&(audioUpload||audioChange)){
                try{Emulator.getGameEnvironment().getSoundboardManager().reload();result.addProperty("notice","Audio gespeichert. Soundboard im Emulator neu geladen.");}
                catch(Exception e){Main.getLogger().error("Soundboard reload after CMS change failed",e);result.addProperty("notice","Audio gespeichert; Live-Übernahme fehlgeschlagen. Emulator-Protokoll prüfen.");}
            }
            boolean bubbleChange="shop_bubbleSave".equals(req.action)||(("shop_hkSave".equals(req.action)||"shop_hkDelete".equals(req.action))&&values!=null&&values.has("module")&&"bubbles".equals(values.get("module").getAsString()));
            if(!result.has("error")&&bubbleChange){
                try{com.eu.habbo.habbohotel.rooms.RoomChatMessageBubbles.removeDynamicBubbles();Emulator.getGameEnvironment().getRoomChatBubbleManager().reload();result.addProperty("notice","Bubble gespeichert. Chat-Bubbles im Emulator neu geladen.");}
                catch(Exception e){Main.getLogger().error("Chat bubble reload after CMS change failed",e);result.addProperty("notice","Bubble gespeichert; Live-Übernahme fehlgeschlagen. Emulator-Protokoll prüfen.");}
            }
            if(!result.has("error")&&"shop_hkSave".equals(req.action)&&values!=null&&values.has("module")&&"cmssettings".equals(values.get("module").getAsString())){
                try{Main.website.getConfigManager().reload();result.addProperty("notice","CMS-Einstellung gespeichert und im WebSocket-Dienst neu geladen.");}
                catch(Exception e){Main.getLogger().error("CMS configuration reload failed",e);result.addProperty("notice","Gespeichert; Konfigurationsspeicher konnte nicht aktualisiert werden.");}
            }
            if(!result.has("error")&&"shop_hkSave".equals(req.action)&&values!=null&&values.has("module")){
                String module=values.get("module").getAsString();
                try{
                    if(module.equals("settings")){Emulator.getConfig().reload();result.addProperty("notice","Hotel-Einstellung gespeichert und Konfiguration neu geladen. Startparameter gelten erst nach einem Neustart.");}
                    if(module.equals("texts")){
                        Emulator.getTexts().reload();Emulator.getGameEnvironment().getCommandHandler().reloadCommands();
                        com.eu.habbo.habbohotel.commands.CommandHandler.addCommand(new EventPrizeCommand());com.eu.habbo.habbohotel.commands.CommandHandler.addCommand(new BuyBubbleCommand());
                        com.eu.habbo.habbohotel.commands.CommandHandler.addCommand(new HourlyLotto.LottoCommand());
                        result.addProperty("notice","Emulator-Texte und Chat-Befehle neu geladen.");
                    }
                }catch(Exception e){Main.getLogger().error("Emulator configuration reload failed",e);result.addProperty("notice","Gespeichert; Emulator konnte die Änderung noch nicht übernehmen. Protokoll prüfen.");}
            }
            if(!result.has("error")&&( "shop_hkSave".equals(req.action)||"shop_hkDelete".equals(req.action))&&values!=null&&values.has("module")&&"crates".equals(values.get("module").getAsString())){
                try{Emulator.getGameEnvironment().getItemManager().loadCrackable();result.addProperty("notice","Kisten gespeichert und Gewinnkonfiguration im Emulator neu geladen.");}
                catch(Exception e){Main.getLogger().error("Crackable reload after CMS change failed",e);result.addProperty("notice","Kisten gespeichert; Live-Übernahme fehlgeschlagen. Emulator-Protokoll prüfen.");}
            }
            if(!result.has("error")&&( "shop_hkSave".equals(req.action)||"shop_hkDelete".equals(req.action))&&values!=null&&values.has("module")){
                String changed=values.get("module").getAsString();
                try{
                    if("wordfilter".equals(changed)){Emulator.getGameEnvironment().getWordFilter().reload();result.addProperty("notice","Wordfilter gespeichert und im Emulator neu geladen.");}
                    if("furni".equals(changed)||"catalogpages".equals(changed)||"catalogitems".equals(changed)){
                        if("furni".equals(changed))Emulator.getGameEnvironment().getItemManager().loadItems();
                        new com.eu.habbo.messages.rcon.UpdateCatalog().handle(new Gson(),null);
                        result.addProperty("notice","Katalog gespeichert, Emulator neu geladen und verbundene Clients aktualisiert.");
                    }
                }catch(Exception e){Main.getLogger().error("Catalog or wordfilter live update failed",e);result.addProperty("notice","Gespeichert; Live-Übernahme fehlgeschlagen. Emulator-Protokoll prüfen.");}
            }
            if(!result.has("error")&&"shop_staffPublicRoomSet".equals(req.action)&&values!=null){
                try{
                    com.eu.habbo.habbohotel.rooms.Room room=Emulator.getGameEnvironment().getRoomManager().loadRoom(values.get("room_id").getAsInt());
                    if(room==null)throw new IllegalStateException("Room missing after save");
                    room.setPublicRoom(values.get("enabled").getAsInt()==1);
                    Emulator.getGameEnvironment().getNavigatorManager().loadNavigator();
                    result.addProperty("notice","Raum-Zuordnung gespeichert und im Navigator übernommen.");
                }catch(Exception e){Main.getLogger().error("Public room update failed",e);result.addProperty("notice","Gespeichert; Navigator-Übernahme fehlgeschlagen. Emulator-Protokoll prüfen.");}
            }
            if(!result.has("error")&&"shop_staffAssetUpload".equals(req.action)&&values!=null&&values.has("kind")&&"converter".equals(values.get("kind").getAsString())){
                try{
                    Emulator.getGameEnvironment().getItemManager().loadItems();
                    new com.eu.habbo.messages.rcon.UpdateCatalog().handle(new Gson(),null);
                    result.addProperty("notice","Dateien und Einträge gespeichert. Möbel und Katalog im Emulator neu geladen; für neue Client-Metadaten den Client erneut öffnen.");
                }catch(Exception e){Main.getLogger().error("Furniture converter live reload failed",e);result.addProperty("notice","Dateien gespeichert; Emulator-Neuladung fehlgeschlagen. Serverprotokoll prüfen.");}
            }
            if(!result.has("error")&&( "shop_hkSave".equals(req.action)||"shop_hkDelete".equals(req.action))&&values!=null&&values.has("module")&&"bots".equals(values.get("module").getAsString())&&result.has("bot_id")&&result.get("bot_id").getAsInt()>0){
                try{refreshBot(result.get("bot_id").getAsInt());result.addProperty("notice","Bot gespeichert und Raumfigur oder Inventar aktualisiert.");}
                catch(Exception e){Main.getLogger().error("Bot live update failed",e);result.addProperty("notice","Bot gespeichert; Live-Übernahme fehlgeschlagen. Emulator-Protokoll prüfen.");}
            }
            return result;}}finally{connection.disconnect();for(com.eu.habbo.habbohotel.bots.Bot bot:pausedBots)if(bot.getRoom()!=null||isCurrentInventoryBot(bot)){try{refreshBot(bot.getId());}catch(Exception ex){Main.getLogger().error("Bot state recovery after CMS request failed",ex);bot.setCmsPaused(false);}}}
    }
    private static void applyStoredBan(int id) throws Exception {
        com.eu.habbo.habbohotel.modtool.ModToolBan ban;
        try(Connection db=Emulator.getDatabase().getDataSource().getConnection();PreparedStatement q=db.prepareStatement("SELECT * FROM bans WHERE id=? AND ban_expire>?")){
            q.setInt(1,id);q.setInt(2,Emulator.getIntUnixTimestamp());try(ResultSet r=q.executeQuery()){if(!r.next())return;ban=new com.eu.habbo.habbohotel.modtool.ModToolBan(r);}
        }
        Set<Habbo> targets=new HashSet<>();
        if(ban.type==com.eu.habbo.habbohotel.modtool.ModToolBanType.ACCOUNT||ban.type==com.eu.habbo.habbohotel.modtool.ModToolBanType.SUPER){
            Habbo target=Emulator.getGameEnvironment().getHabboManager().getHabbo(ban.userId);if(target!=null)targets.add(target);
            com.eu.habbo.habbohotel.gameclients.SessionResumeManager.getInstance().disposeGhostSession(ban.userId);
            server.websocket.WebSocketManager.getInstance().getClientManager().disconnectAccount(ban.userId);
        }
        if((ban.type==com.eu.habbo.habbohotel.modtool.ModToolBanType.IP||ban.type==com.eu.habbo.habbohotel.modtool.ModToolBanType.SUPER)&&ban.ip!=null&&!ban.ip.isEmpty())targets.addAll(Emulator.getGameServer().getGameClientManager().getHabbosWithIP(ban.ip));
        if((ban.type==com.eu.habbo.habbohotel.modtool.ModToolBanType.MACHINE||ban.type==com.eu.habbo.habbohotel.modtool.ModToolBanType.SUPER)&&ban.machineId!=null&&!ban.machineId.isEmpty())targets.addAll(Emulator.getGameServer().getGameClientManager().getHabbosWithMachineId(ban.machineId));
        for(Habbo target:targets){
            int userId=target.getHabboInfo().getId();
            if(target.getClient()!=null){target.getClient().sendResponse(new com.eu.habbo.messages.outgoing.users.BanInfoComposer(userId,ban.reason,Math.max(1,ban.expireDate-Emulator.getIntUnixTimestamp()),""));Emulator.getGameServer().getGameClientManager().disconnectWithReason(target.getClient(),com.eu.habbo.messages.outgoing.handshake.DisconnectReasonComposer.JUST_BANNED);}
            com.eu.habbo.habbohotel.gameclients.SessionResumeManager.getInstance().disposeGhostSession(userId);
            server.websocket.WebSocketManager.getInstance().getClientManager().disconnectAccount(userId);
        }
    }
    private static boolean isCurrentInventoryBot(com.eu.habbo.habbohotel.bots.Bot bot){
        Habbo owner=Emulator.getGameEnvironment().getHabboManager().getHabbo(bot.getOwnerId());
        return owner!=null&&owner.getInventory().getBotsComponent().getBot(bot.getId())==bot;
    }
    private static synchronized void refreshBot(int id) throws Exception {
        com.eu.habbo.habbohotel.bots.Bot next=null;com.eu.habbo.habbohotel.rooms.Room target=null;com.eu.habbo.habbohotel.rooms.RoomUnit unit=null;boolean inInventory=false;
        try(Connection db=Emulator.getDatabase().getDataSource().getConnection();PreparedStatement q=db.prepareStatement("SELECT b.*,u.username owner_name FROM bots b JOIN users u ON u.id=b.user_id WHERE b.id=?")){
            q.setInt(1,id);try(ResultSet r=q.executeQuery()){if(r.next()){
                next=Emulator.getGameEnvironment().getBotManager().loadBot(r);if(next==null)throw new IllegalStateException("Unsupported bot type");
                inInventory=r.getInt("room_id")==0;
                target=inInventory?null:Emulator.getGameEnvironment().getRoomManager().getRoom(r.getInt("room_id"));
                if(target!=null){
                    com.eu.habbo.habbohotel.rooms.RoomTile tile=target.getLayout().getTile((short)r.getInt("x"),(short)r.getInt("y"));
                    if(tile==null||tile.state==com.eu.habbo.habbohotel.rooms.RoomTileState.INVALID)throw new IllegalArgumentException("Bot position is outside room");
                    unit=new com.eu.habbo.habbohotel.rooms.RoomUnit();unit.setRoomUnitType(com.eu.habbo.habbohotel.rooms.RoomUnitType.BOT);unit.setRotation(com.eu.habbo.habbohotel.rooms.RoomUserRotation.fromValue(r.getInt("rot")));unit.setDanceType(com.eu.habbo.habbohotel.users.DanceType.values()[r.getInt("dance")]);unit.setLocation(tile);unit.setZ(r.getDouble("z"));unit.setPreviousLocationZ(r.getDouble("z"));unit.setPathFinderRoom(target);unit.setCanWalk(r.getBoolean("freeroam"));
                }
            }}
        }
        for(com.eu.habbo.habbohotel.rooms.Room room:Emulator.getGameEnvironment().getRoomManager().getActiveRooms()){
            com.eu.habbo.habbohotel.bots.Bot old=room.getBot(id);if(old!=null){old.discardCmsPendingUpdate();room.removeBot(old);}
        }
        for(Habbo online:Emulator.getGameEnvironment().getHabboManager().getOnlineHabbos().values()){
            com.eu.habbo.habbohotel.bots.Bot old=online.getInventory().getBotsComponent().getBot(id);
            if(old!=null){old.discardCmsPendingUpdate();online.getInventory().getBotsComponent().removeBot(old);if(online.getClient()!=null)online.getClient().sendResponse(new com.eu.habbo.messages.outgoing.inventory.RemoveBotComposer(old));}
        }
        if(next!=null&&inInventory){
            Habbo owner=Emulator.getGameEnvironment().getHabboManager().getHabbo(next.getOwnerId());
            if(owner!=null){owner.getInventory().getBotsComponent().addBot(next);if(owner.getClient()!=null)owner.getClient().sendResponse(new com.eu.habbo.messages.outgoing.inventory.AddBotComposer(next));}
        }
        if(next!=null&&target!=null&&unit!=null){next.setRoom(target);next.setRoomUnit(unit);target.addBot(next);target.sendComposer(new com.eu.habbo.messages.outgoing.rooms.users.RoomUsersComposer(next).compose());target.sendComposer(new com.eu.habbo.messages.outgoing.rooms.users.RoomUserStatusComposer(unit).compose());Emulator.getThreading().run(next);}
    }
    public static final class BuyBubbleCommand extends com.eu.habbo.habbohotel.commands.Command {
        public BuyBubbleCommand(){super(null,new String[]{"buybubble"});}
        @Override public boolean handle(com.eu.habbo.habbohotel.gameclients.GameClient client,String[] args){
            if(args.length!=2){client.getHabbo().whisper("Verwendung: :buybubble Bubble-ID");return true;}
            try{com.eu.habbo.habbohotel.rooms.CmsBubblePolicy.buy(client.getHabbo(),Integer.parseInt(args[1]));}
            catch(IllegalArgumentException e){client.getHabbo().whisper(e.getMessage());}
            catch(Exception e){Main.getLogger().error("Bubble purchase failed",e);client.getHabbo().whisper("Der Kauf konnte nicht bestätigt werden. Prüfe die Bubble-Auswahl vor einer erneuten Anfrage.");}
            return true;
        }
    }
    public static final class EventPrizeCommand extends com.eu.habbo.habbohotel.commands.Command {
        public EventPrizeCommand(){super(null,new String[]{"prize"});}
        @Override public boolean handle(com.eu.habbo.habbohotel.gameclients.GameClient client,String[] args){
            Habbo actor=client.getHabbo();
            if(args.length!=2){actor.whisper("Verwendung: :prize Benutzername — vergibt ein Eventlevel mit den im Housekeeping hinterlegten Belohnungen.");return true;}
            try{
                CmsStudioEvent.Request req=new CmsStudioEvent.Request();req.action="shop_prizeChange";req.values=new JsonObject();
                req.values.addProperty("username",args[1]);req.values.addProperty("delta",1);req.values.addProperty("key","client-prize-"+UUID.randomUUID());
                JsonObject result=request(actor.getHabboInfo().getId(),req);
                if(result.has("error")){actor.whisper(result.get("error").getAsString());return true;}
                actor.whisper("Eventlevel für "+args[1]+" gespeichert. Hinterlegte Belohnungen werden vom Emulator zugestellt.");
            }catch(Exception e){Main.getLogger().error("Event prize command failed",e);actor.whisper("Keine Bestätigung für die Vergabe erhalten. Prüfe den Eventlevel im Housekeeping vor einer erneuten Vergabe.");}
            return true;
        }
    }
    private static JsonObject emulatorStatus(int user)throws Exception {
        try(Connection db=Emulator.getDatabase().getDataSource().getConnection();PreparedStatement q=db.prepareStatement("SELECT rank FROM users WHERE id=?")){
            q.setInt(1,user);try(ResultSet r=q.executeQuery()){if(!r.next()||r.getInt(1)<7)throw new IllegalArgumentException("Emulator-Status benötigt Rang 7.");}
        }
        return metrics();
    }
    public static JsonObject metrics(){
        java.lang.management.RuntimeMXBean process=java.lang.management.ManagementFactory.getRuntimeMXBean();
        java.lang.management.MemoryUsage memory=java.lang.management.ManagementFactory.getMemoryMXBean().getHeapMemoryUsage();
        JsonObject result=new JsonObject();result.addProperty("ready",Emulator.isReady);
        result.addProperty("sampledAt",System.currentTimeMillis());result.addProperty("uptime",process.getUptime());
        result.addProperty("pid",ProcessHandle.current().pid());
        result.addProperty("startedAt",process.getStartTime());
        result.addProperty("javaHome",System.getProperty("java.home"));
        try{File jar=new File(Emulator.class.getProtectionDomain().getCodeSource().getLocation().toURI());result.addProperty("jar",jar.getAbsolutePath());result.addProperty("jarBytes",jar.length());result.addProperty("jarModified",jar.lastModified());}catch(Exception ignored){}
        result.addProperty("javaVersion",System.getProperty("java.version"));result.addProperty("heapUsed",memory.getUsed());
        result.addProperty("heapCommitted",memory.getCommitted());result.addProperty("heapMax",memory.getMax());
        result.addProperty("threads",java.lang.management.ManagementFactory.getThreadMXBean().getThreadCount());
        result.addProperty("processors",Runtime.getRuntime().availableProcessors());
        java.lang.management.OperatingSystemMXBean operatingSystem=java.lang.management.ManagementFactory.getOperatingSystemMXBean();
        result.addProperty("hostName",operatingSystem.getName());result.addProperty("hostArchitecture",operatingSystem.getArch());
        if(operatingSystem instanceof com.sun.management.OperatingSystemMXBean){
            com.sun.management.OperatingSystemMXBean host=(com.sun.management.OperatingSystemMXBean)operatingSystem;
            double cpu=host.getProcessCpuLoad();if(cpu>=0)result.addProperty("processCpuPercent",cpu*100);
            double totalCpu=host.getCpuLoad();if(totalCpu>=0)result.addProperty("hostCpuPercent",totalCpu*100);
            result.addProperty("hostMemoryTotal",host.getTotalMemorySize());result.addProperty("hostMemoryFree",host.getFreeMemorySize());
        }
        result.addProperty("online",Emulator.getGameEnvironment().getHabboManager().getOnlineCount());
        result.addProperty("rooms",Emulator.getGameEnvironment().getRoomManager().loadedRoomsCount());
        long collections=0,collectionTime=0;for(java.lang.management.GarbageCollectorMXBean gc:java.lang.management.ManagementFactory.getGarbageCollectorMXBeans()){collections+=Math.max(0,gc.getCollectionCount());collectionTime+=Math.max(0,gc.getCollectionTime());}
        result.addProperty("gcCount",collections);result.addProperty("gcTime",collectionTime);return result;
    }
    private static JsonObject emulatorLogs(int user,JsonObject values)throws Exception {
        emulatorStatus(user); // Fresh database rank check, even after a demotion.
        String selected=values!=null&&values.has("file")?values.get("file").getAsString():"runtime";
        Map<String,String> paths=new LinkedHashMap<>();paths.put("runtime","errors/runtime.txt");paths.put("debug","debug.txt");paths.put("sql","errors/sql.txt");paths.put("slow","database/slow-queries.log");
        if(!paths.containsKey(selected))throw new IllegalArgumentException("Unbekannte Log-Datei.");
        File root=new File("logging").getCanonicalFile();JsonArray files=new JsonArray();
        for(Map.Entry<String,String> entry:paths.entrySet()){
            File file=new File(root,entry.getValue()).getCanonicalFile();
            if(!file.toPath().startsWith(root.toPath()))throw new IllegalArgumentException("Ungültiger Log-Pfad.");
            JsonObject info=new JsonObject();info.addProperty("id",entry.getKey());info.addProperty("name",entry.getValue());info.addProperty("exists",file.isFile());info.addProperty("bytes",file.length());info.addProperty("modified",file.lastModified());files.add(info);
        }
        File file=new File(root,paths.get(selected)).getCanonicalFile();String tail="";
        if(file.isFile())try(RandomAccessFile reader=new RandomAccessFile(file,"r")){
            long start=Math.max(0,reader.length()-65536);reader.seek(start);byte[] bytes=new byte[(int)Math.min(65536,reader.length()-start)];reader.readFully(bytes);
            tail=new String(bytes,StandardCharsets.UTF_8);if(start>0){int newline=tail.indexOf('\n');tail=newline<0?"":tail.substring(newline+1);}
            String[] lines=tail.split("\n",-1);if(lines.length>300)tail=String.join("\n",Arrays.copyOfRange(lines,lines.length-300,lines.length));
        }
        JsonObject result=new JsonObject();result.add("files",files);result.addProperty("selected",selected);result.addProperty("tail",tail);result.addProperty("sampledAt",System.currentTimeMillis());return result;
    }
    public static synchronized void deliver() throws Exception {
        try(Connection db=Emulator.getDatabase().getDataSource().getConnection()){
            List<Integer> ids=new ArrayList<>();
            try(PreparedStatement q=db.prepareStatement("SELECT id FROM habboje_shop.deliveries WHERE status='pending' ORDER BY id LIMIT 50");ResultSet r=q.executeQuery()){while(r.next())ids.add(r.getInt(1));}
            for(int id:ids){
                db.setAutoCommit(false);
                try(PreparedStatement q=db.prepareStatement("SELECT * FROM habboje_shop.deliveries WHERE id=? AND status='pending' FOR UPDATE")){
                    q.setInt(1,id);
                    try(ResultSet r=q.executeQuery()){
                        if(!r.next()){db.rollback();continue;}
                        int user=r.getInt("user_id"),amount=r.getInt("amount"),item=r.getInt("item_id");String type=r.getString("type"),code=r.getString("code");
                        Habbo online=Emulator.getGameEnvironment().getHabboManager().getHabbo(user);
                        if(type.equals("credits")||type.equals("diamonds")||type.equals("points")){
                            int currency=type.equals("credits")?-1:type.equals("diamonds")?5:Integer.parseInt(code);
                            if(currency < -1 || currency > 1000)throw new IllegalArgumentException("Invalid delivery currency");
                            EconomyOperation operation=new EconomyOperation("cms-shop-delivery-"+id,user,user,currency==-1?"credit_grant":"currency_grant","cms.shop",currency,amount,null,"");
                            // Ledger operation IDs make retries safe after a process crash.
                            if(online==null)EconomyLedger.execute(operation);else{
                                if(currency==-1)online.giveCredits(amount,"cms.shop","cms-shop-delivery-"+id,user);
                                else online.givePoints(currency,amount,"cms.shop","cms-shop-delivery-"+id,user);
                                try(PreparedStatement verified=db.prepareStatement("SELECT operation_id FROM logs_economy WHERE operation_id=?")){verified.setString(1,"cms-shop-delivery-"+id);try(ResultSet applied=verified.executeQuery()){if(!applied.next())throw new SQLException("Reward mutation was not confirmed by the economy ledger");}}
                                online.getClient().sendResponse(currency==-1?new UserCreditsComposer(online):new UserCurrencyComposer(online));
                            }
                        }else if(type.equals("item_notify")){
                            if(online!=null){
                                if(!online.getInventory().getItemsComponent().getItems().containsKey(item))online.getInventory().getItemsComponent().addItem(Emulator.getGameEnvironment().getItemManager().loadHabboItem(item));
                                online.getClient().sendResponse(new InventoryRefreshComposer());
                            }
                        }else if(type.equals("badge")){
                            if(online!=null)online.addBadge(code);
                            else{
                                try(PreparedStatement lock=db.prepareStatement("SELECT id FROM users WHERE id=? FOR UPDATE")){lock.setInt(1,user);lock.executeQuery().close();}
                                try(PreparedStatement badge=db.prepareStatement("INSERT INTO users_badges(user_id,slot_id,badge_code) SELECT ?,0,? WHERE NOT EXISTS(SELECT 1 FROM users_badges WHERE user_id=? AND badge_code=?)")){badge.setInt(1,user);badge.setString(2,code);badge.setInt(3,user);badge.setString(4,code);badge.executeUpdate();}
                            }
                        }else if(type.equals("premium")){
                            long now=System.currentTimeMillis()/1000,start=now;
                            try(PreparedStatement sub=db.prepareStatement("SELECT COALESCE(MAX(timestamp_start+duration),0) FROM users_subscriptions WHERE user_id=? AND subscription_type='HABBO_CLUB'")){sub.setInt(1,user);try(ResultSet result=sub.executeQuery()){result.next();start=Math.max(now,result.getLong(1));}}
                            try(PreparedStatement sub=db.prepareStatement("INSERT INTO users_subscriptions(user_id,subscription_type,timestamp_start,duration,active) VALUES(?,'HABBO_CLUB',?,?,1)")){sub.setInt(1,user);sub.setLong(2,start);sub.setLong(3,amount*86400L);sub.executeUpdate();}
                        }else throw new IllegalArgumentException("Unsupported shop delivery type");
                        try(PreparedStatement done=db.prepareStatement("UPDATE habboje_shop.deliveries SET status='delivered',error='' WHERE id=?")){done.setInt(1,id);done.executeUpdate();}
                        db.commit();
                    }
                }catch(Exception e){db.rollback();Main.getLogger().error("Shop reward delivery failed: "+id,e);}finally{db.setAutoCommit(true);}
            }
        }
    }
    private static void badgePayments() throws Exception {
        List<Integer> ids=new ArrayList<>();
        try(Connection db=Emulator.getDatabase().getDataSource().getConnection();Statement q=db.createStatement();ResultSet r=q.executeQuery("SELECT badge_id FROM habboje_shop.badge_payments WHERE status='pending' ORDER BY badge_id LIMIT 50")){while(r.next())ids.add(r.getInt(1));}
        for(int id:ids){
            try(Connection db=Emulator.getDatabase().getDataSource().getConnection()){
                db.setAutoCommit(false);
                try(PreparedStatement q=db.prepareStatement("SELECT * FROM habboje_shop.badge_payments WHERE badge_id=? AND status='pending' FOR UPDATE")){
                    q.setInt(1,id);try(ResultSet r=q.executeQuery()){
                        if(!r.next()){db.rollback();continue;}
                        int user=r.getInt("user_id"),amount=r.getInt("amount"),currency=r.getInt("currency_type");
                        if(amount<1||amount>100000||currency < -1||currency>1000)throw new SQLException("Invalid badge payment configuration");
                        EconomyOperation operation=new EconomyOperation("cms-badge-payment-"+id,user,user,currency==-1?"credit_debit":"currency_debit","badgecreator.upload",currency,-amount,null,"");
                        Habbo online=Emulator.getGameEnvironment().getHabboManager().getHabbo(user);
                        boolean alreadyPaid;
                        try(PreparedStatement paid=db.prepareStatement("SELECT operation_id FROM logs_economy WHERE operation_id=?")){paid.setString(1,"cms-badge-payment-"+id);try(ResultSet exists=paid.executeQuery()){alreadyPaid=exists.next();}}
                        if(!alreadyPaid){
                            if(online==null)EconomyLedger.execute(operation);else{
                                com.eu.habbo.habbohotel.users.LedgerWalletMutation.execute(online,operation);
                                online.getClient().sendResponse(currency==-1?new UserCreditsComposer(online):new UserCurrencyComposer(online));
                            }
                        }
                        try(PreparedStatement done=db.prepareStatement("UPDATE habboje_shop.badge_payments SET status='paid',error='' WHERE badge_id=?")){done.setInt(1,id);done.executeUpdate();}
                        try(PreparedStatement ready=db.prepareStatement("UPDATE habboje_shop.badges SET status='pending' WHERE id=? AND status='awaiting_payment'")){ready.setInt(1,id);ready.executeUpdate();}
                        db.commit();
                    }
                }catch(IllegalArgumentException e){
                    db.rollback();
                    try(PreparedStatement fail=db.prepareStatement("UPDATE habboje_shop.badge_payments SET status='failed',error='Gebühr konnte nicht abgebucht werden. Guthaben prüfen.' WHERE badge_id=? AND status='pending'")){fail.setInt(1,id);fail.executeUpdate();}
                    try(PreparedStatement fail=db.prepareStatement("UPDATE habboje_shop.badges SET status='payment_failed',review_note='Gebühr konnte nicht abgebucht werden. Guthaben prüfen.' WHERE id=? AND status='awaiting_payment'")){fail.setInt(1,id);fail.executeUpdate();}
                    db.commit();
                }catch(Exception e){db.rollback();Main.getLogger().error("Badge fee deferred: "+id,e);}
            }
        }
    }
    /** Commands are claimed before dispatch; alerts are never silently replayed after a crash. */
    private static synchronized void staffCommands() throws Exception {
        try(Connection db=Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement q=db.prepareStatement("SELECT id,staff_id,kind,payload FROM habboje_shop.staff_commands WHERE status='pending' ORDER BY id LIMIT 20");ResultSet r=q.executeQuery()){
            while(r.next()){
                long id=r.getLong("id");int staff=r.getInt("staff_id");String kind=r.getString("kind"),payload=r.getString("payload");
                String failure="";
                try(PreparedStatement rank=db.prepareStatement("SELECT rank FROM users WHERE id=?")){
                    rank.setInt(1,staff);try(ResultSet user=rank.executeQuery()){if(!user.next()||user.getInt(1)<7)failure="Keine Berechtigung mehr.";}
                }
                Habbo online=Emulator.getGameEnvironment().getHabboManager().getHabbo(staff);
                if(failure.isEmpty()&&(online==null||online.getClient()==null))failure="Mitarbeiter ist nicht im Client online.";
                if(failure.isEmpty()&&kind.equals("phantom")&&online.getRoomUnit().getRoom()==null)failure="Betrete zuerst einen Raum.";
                try(PreparedStatement claim=db.prepareStatement("UPDATE habboje_shop.staff_commands SET status=?,error=? WHERE id=? AND status='pending'")){
                    claim.setString(1,failure.isEmpty()?"dispatching":"failed");claim.setString(2,failure);claim.setLong(3,id);if(claim.executeUpdate()!=1)continue;
                }
                if(!failure.isEmpty())continue;
                try{
                    if(kind.equals("alert"))new com.eu.habbo.habbohotel.commands.HotelAlertCommand().handle(online.getClient(),new String[]{"ha",payload});
                    else if(kind.equals("phantom")){
                        boolean desired=payload.equals("1");
                        if(online.getRoomUnit().isInvisible()!=desired)new com.eu.habbo.habbohotel.commands.InvisibleCommand().handle(online.getClient(),new String[]{"invisible"});
                    }else throw new IllegalArgumentException("Unbekannte Spielaktion");
                    try(PreparedStatement done=db.prepareStatement("UPDATE habboje_shop.staff_commands SET status='done' WHERE id=?")){done.setLong(1,id);done.executeUpdate();}
                }catch(Exception e){
                    Main.getLogger().error("Housekeeping command failed: "+id,e);
                    try(PreparedStatement failed=db.prepareStatement("UPDATE habboje_shop.staff_commands SET status='failed',error='Spielaktion fehlgeschlagen; Emulatorprotokoll prüfen.' WHERE id=?")){failed.setLong(1,id);failed.executeUpdate();}
                }
            }
        }
    }

}
