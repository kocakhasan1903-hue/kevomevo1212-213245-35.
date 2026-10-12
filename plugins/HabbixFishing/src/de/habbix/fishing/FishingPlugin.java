package de.habbix.fishing;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.commands.*;
import com.eu.habbo.habbohotel.gameclients.GameClient;
import com.eu.habbo.habbohotel.rooms.*;
import com.eu.habbo.habbohotel.users.*;
import com.eu.habbo.messages.outgoing.generic.alerts.BubbleAlertComposer;
import com.eu.habbo.messages.outgoing.rooms.users.RoomUserTalkComposer;
import com.eu.habbo.plugin.*;
import com.eu.habbo.plugin.events.emulator.EmulatorLoadedEvent;
import com.eu.habbo.plugin.events.users.*;
import com.eu.habbo.plugin.events.furniture.FurnitureToggleEvent;
import com.google.gson.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Optional Polaris plugin; native commands continue to work without the custom client. */
public final class FishingPlugin extends HabboPlugin implements com.eu.habbo.plugin.EventListener {
    private final FishingStore store=new FishingStore();
    private final ScheduledExecutorService worker=Executors.newSingleThreadScheduledExecutor(r->{Thread t=new Thread(r,"habbix-fishing");t.setDaemon(true);return t;});
    private final ConcurrentMap<Integer,Session> sessions=new ConcurrentHashMap<>();
    private final Map<Integer,Long> requests=new HashMap<>();
    private final Map<Integer,Long> casts=new HashMap<>();
    private final AtomicBoolean started=new AtomicBoolean();
    private volatile FishingConfig config=new FishingConfig();
    private static final class Session {
        final Habbo habbo;final int room,x,y,item;final long created=System.currentTimeMillis();
        long deadline;int warnings;boolean bite,warned;String roll=UUID.randomUUID().toString();
        Session(Habbo h,int r,int x,int y,int item){habbo=h;room=r;this.x=x;this.y=y;this.item=item;}
    }
    @Override public void onEnable()throws Exception{Emulator.getPluginManager().registerEvents(this,this);if(Emulator.isReady)boot();}
    @EventHandler public void loaded(EmulatorLoadedEvent event)throws Exception{boot();}
    private void boot()throws Exception{if(!started.compareAndSet(false,true))return;store.migrate();config=store.config();if(!config.passRequired){config.passRequired=true;store.config(config,0);}CommandHandler.addCommand(new FishingCommand());worker.scheduleAtFixedRate(()->{try{tick();}catch(Exception e){Emulator.getLogging().logErrorLine("[HabbixFishing] Tick failed: "+e.getClass().getSimpleName());}},1,1,TimeUnit.SECONDS);Emulator.getLogging().logStart("[HabbixFishing] Ready; room="+config.roomId+", enabled="+config.enabled);}
    @Override public void onDisable(){sessions.clear();worker.shutdownNow();}
    @Override public boolean hasPermission(Habbo h,String key){return "cmd_habbix_fishing".equals(key);}
    private boolean staff(Habbo h){
        if(h==null)return false;int minimum=Math.max(7,config.staffRank);
        try(var c=Emulator.getDatabase().getDataSource().getConnection()){
            // The website adapter is optional. Its configured rank applies to commands too.
            try(var p=c.prepareStatement("SELECT config_json FROM habbix_event_administration WHERE id=1");var r=p.executeQuery()){if(r.next()){JsonObject s=JsonParser.parseString(r.getString(1)).getAsJsonObject();minimum=Math.max(minimum,Math.max(s.get("minimumRank").getAsInt(),s.get("angelRank").getAsInt()));}}catch(java.sql.SQLException e){if(!"42S02".equals(e.getSQLState()))return false;}
            try(var p=c.prepareStatement("SELECT rank FROM users WHERE id=?")){p.setInt(1,uid(h));try(var r=p.executeQuery()){return r.next()&&r.getInt(1)>=minimum;}}
        }catch(Exception e){return false;}
    }
    private int uid(Habbo h){return h.getHabboInfo().getId();}
    private boolean online(Habbo h){return h!=null&&h.isOnline()&&h.getClient()!=null&&h.getClient().getChannel()!=null&&h.getClient().getChannel().isActive();}
    @EventHandler public void enter(HabboAddedToRoomEvent e){worker.schedule(()->safe(e.habbo,()->state(e.habbo,false,"")),1,TimeUnit.SECONDS);}
    @EventHandler public void leave(UserExitRoomEvent e){cancel(e.habbo,"Du hast den Angelplatz verlassen.");}
    @EventHandler public void disconnected(UserDisconnectEvent e){cancel(e.habbo,"");}
    @EventHandler public void step(UserTakeStepEvent e){Session s=sessions.get(uid(e.habbo));if(s!=null&&(e.toLocation.x!=s.habbo.getRoomUnit().getX()||e.toLocation.y!=s.habbo.getRoomUnit().getY()))cancel(e.habbo,"Angeln beendet, weil du dich bewegt hast.");}
    @EventHandler public void toggle(FurnitureToggleEvent e){if(e.habbo==null||!config.enabled)return;if(config.water.stream().anyMatch(w->w.itemId()==e.furniture.getId())&&e.furniture.getRoomId()==config.roomId){e.setCancelled(true);worker.execute(()->safe(e.habbo,()->start(e.habbo,e.furniture.getX(),e.furniture.getY(),e.furniture.getId())));}}
    private interface Work{void run()throws Exception;}
    private void safe(Habbo h,Work work){try{if(online(h))work.run();}catch(Exception e){if(online(h)){String text=e instanceof IllegalArgumentException?e.getMessage():"Angeln ist gerade nicht verfügbar. Bitte erneut versuchen.";h.whisper(text);try{JsonObject packet=snapshot(h,false,text);packet.addProperty("notification",true);send(h,packet);}catch(Exception ignored){h.whisper(text);}}}}
    private void cancel(Habbo h,String reason){Session s=sessions.remove(uid(h));if(s!=null&&!worker.isShutdown())worker.execute(()->{scene(s.room);safe(h,()->{if(!reason.isBlank())h.whisper(reason);state(h,false,reason);});});}
    private Room room(Habbo h){return h.getHabboInfo().getCurrentRoom();}
    private void requireRoom(Habbo h){if(!config.enabled||config.roomId==0)throw new IllegalArgumentException("Der Angelpark ist noch nicht eingerichtet.");if(room(h)==null||room(h).getId()!=config.roomId)throw new IllegalArgumentException("Angeln geht nur im eingerichteten Angelpark.");}
    private List<FishingConfig.Water> water(Room r,FishingConfig c){List<FishingConfig.Water> result=new ArrayList<>();if(r==null||r.getId()!=c.roomId)return result;for(var w:c.water){if(w.itemId()==0){result.add(w);continue;}var f=r.getHabboItem(w.itemId());if(f==null||f.getRoomId()!=r.getId())continue;for(RoomTile t:r.getLayout().getTilesAt(r.getLayout().getTile(f.getX(),f.getY()),f.getBaseItem().getWidth(),f.getBaseItem().getLength(),f.getRotation()))if(t.state!=RoomTileState.INVALID)result.add(new FishingConfig.Water(t.x,t.y,f.getId()));}return result;}
    private FishingConfig.Water target(Room r,int x,int y,int item){return water(r,config).stream().filter(w->item>0?w.itemId()==item:w.x()==x&&w.y()==y).min(Comparator.comparingInt(w->Math.max(Math.abs(w.x()-x),Math.abs(w.y()-y)))).orElseThrow(()->new IllegalArgumentException("Dieses Feld ist kein eingerichtetes Angelwasser."));}
    private void start(Habbo h,int x,int y,int item)throws Exception{
        requireRoom(h);long castNow=System.currentTimeMillis();Long castLast=casts.get(uid(h));if(castLast!=null&&castNow-castLast<1200)throw new IllegalArgumentException("Bitte warte kurz, bevor du die Angel erneut auswirfst oder einziehst.");casts.put(uid(h),castNow);var water=target(room(h),x,y,item);if(!FishingRules.inReach(h.getRoomUnit().getX(),h.getRoomUnit().getY(),water.x(),water.y(),config.range))throw new IllegalArgumentException("Du musst neben dem Wasser stehen, um angeln zu können!");
        var bag=store.snapshot(uid(h));if(config.passRequired&&bag.player().passUntil()<=System.currentTimeMillis())throw new IllegalArgumentException("Deine Angel ist kaputt. Kaufe bitte einen Angelpass, um zu angeln.");if(bag.player().durability()<=0)throw new IllegalArgumentException("Bitte zuerst deine Rute reparieren.");if(bag.catches().size()>=200)throw new IllegalArgumentException("Deine Fangtasche ist voll. Verkaufe zuerst Fänge.");
        Session old=sessions.get(uid(h));if(old!=null&&old.x==water.x()&&old.y==water.y()){if(old.bite){settle(old,FishingRules.roll(ThreadLocalRandom.current(),bag.player().rod(),config));return;}cancel(h,"Angel eingeholt.");state(h,true,"Angel eingeholt.");return;}
        h.getRoomUnit().setGoalLocation(room(h).getLayout().getTile(h.getRoomUnit().getX(),h.getRoomUnit().getY()));Session s=new Session(h,config.roomId,water.x(),water.y(),water.itemId());waitForFish(s);sessions.put(uid(h),s);scene(s.room);announce(h,"wirft die Angel aus.");state(h,true,"Die Angel ist ausgeworfen.");
    }
    private void waitForFish(Session s){s.bite=false;s.roll=UUID.randomUUID().toString();s.deadline=System.currentTimeMillis()+ThreadLocalRandom.current().nextInt(config.minWait,config.maxWait+1)*1000L;}
    private void tick()throws Exception{
        long now=System.currentTimeMillis();for(Session s:new ArrayList<>(sessions.values())){if(!online(s.habbo)){sessions.remove(uid(s.habbo),s);scene(s.room);continue;}safe(s.habbo,()->{
            Habbo h=s.habbo;if(!online(h)||!config.enabled||room(h)==null||room(h).getId()!=s.room||s.room!=config.roomId){sessions.remove(uid(h),s);scene(s.room);return;}
            var p=store.snapshot(uid(h)).player();
            try{var w=target(room(h),s.x,s.y,s.item);if(!FishingRules.inReach(h.getRoomUnit().getX(),h.getRoomUnit().getY(),w.x(),w.y(),config.range)){if(now/1000%config.waterCheck==0&&++s.warnings>=config.maxWarnings)cancel(h,"Du bist zu weit vom Wasser entfernt.");return;}s.warnings=0;}catch(IllegalArgumentException e){cancel(h,"Das Angelwasser wurde entfernt.");return;}
            if(config.passRequired&&p.passUntil()<=now){cancel(h,"Dein Angelpass ist abgelaufen.");return;}
            if(config.passRequired&&!s.warned&&p.passUntil()-now<=config.passWarning*1000L){s.warned=true;h.whisper("Dein Angelpass läuft bald ab.");state(h,false,"Dein Angelpass läuft bald ab.");}
            if(p.durability()<=0){cancel(h,"Deine Rute muss repariert werden.");return;}
            if(now<s.deadline)return;
            if(config.manualHook&&!s.bite){s.bite=true;s.deadline=now+5000;state(h,true,"Ein Fisch beißt! Jetzt ziehen.");scene(s.room);return;}
            settle(s,config.manualHook?null:FishingRules.roll(ThreadLocalRandom.current(),p.rod(),config));
        });}
        for(var it=requests.entrySet().iterator();it.hasNext();)if(now-it.next().getValue()>600000)it.remove();casts.entrySet().removeIf(e->now-e.getValue()>600000);
    }
    private void settle(Session s,FishingRules.Species fish)throws Exception{
        if(sessions.get(uid(s.habbo))!=s)return;int grams=fish==null?0:FishingRules.grams(fish,ThreadLocalRandom.current());
        if(!store.settle(uid(s.habbo),fish,grams,s.roll,config)){cancel(s.habbo,"Die Fangtasche ist voll oder die Rute beschädigt.");return;}
        String text=fish==null?"der Fisch ist entwischt …":"zieht "+fish.name()+" ("+grams+" g) aus dem Wasser";announce(s.habbo,text);if(fish==null)s.habbo.whisper("Der Fisch ist dir entwischt. Versuche es erneut!");waitForFish(s);JsonObject result=snapshot(s.habbo,false,text);result.addProperty("notification",true);result.addProperty("notice",fish==null?"Der Fisch ist dir entwischt. Versuche es erneut!":"Du hast "+fish.name()+" gefangen! ("+config.price(fish.key())+" Taler"+(config.fish(fish.key()).diamonds>0?" / "+config.fish(fish.key()).diamonds+" Diamanten":"")+" wert) +"+config.xpPerCatch+" EP.");if(fish!=null)result.addProperty("noticeIcon",config.fish(fish.key()).iconUrl);send(s.habbo,result);
    }
    private void announce(Habbo h,String text)throws Exception{if(store.snapshot(uid(h)).player().broadcast()&&room(h)!=null)room(h).sendComposer(new RoomUserTalkComposer(new RoomChatMessage(text,h,RoomChatMessageBubbles.NORMAL)).compose());else h.whisper(text);}
    private JsonObject snapshot(Habbo h,boolean open,String notice)throws Exception{
        JsonObject o=new JsonObject();o.addProperty("open",open&&config.enabled&&room(h)!=null&&room(h).getId()==config.roomId);o.addProperty("notice",notice);o.addProperty("configuredRoom",config.roomId);o.addProperty("enabled",config.enabled);o.addProperty("staff",staff(h));o.addProperty("range",config.range);o.addProperty("passRequired",config.passRequired);o.addProperty("manualHook",config.manualHook);o.add("water",FishingStore.JSON.toJsonTree(water(room(h),config)));o.add("fish",FishingStore.JSON.toJsonTree(config.fish));o.add("rods",FishingStore.JSON.toJsonTree(FishingRules.RODS));var b=store.snapshot(uid(h));o.add("player",FishingStore.JSON.toJsonTree(b.player()));o.add("bag",FishingStore.JSON.toJsonTree(b.catches()));o.addProperty("repairCost",config.repairCost(b.player().rod(),b.player().durability()));o.addProperty("upgradeXp",(b.player().rod()+1)*config.upgradeXp);o.addProperty("maxRod",config.maxRod);o.add("passPrices",FishingStore.JSON.toJsonTree(Map.of("1",config.pass1,"3",config.pass3,"6",config.pass6)));Session s=sessions.get(uid(h));o.addProperty("phase",s==null?"ready":s.bite?"bite":"waiting");o.addProperty("deadline",s==null?0:s.deadline);o.add("anglers",anglers(room(h)==null?0:room(h).getId()));return o;
    }
    private JsonArray anglers(int room){JsonArray result=new JsonArray();for(Session s:sessions.values())if(s.room==room){JsonObject a=new JsonObject();a.addProperty("unitId",s.habbo.getRoomUnit().getId());a.addProperty("x",s.x);a.addProperty("y",s.y);a.addProperty("bite",s.bite);result.add(a);}return result;}
    private void send(Habbo h,JsonObject o){if(online(h))h.getClient().sendResponse(new BubbleAlertComposer("habbix_fishing",Map.of("state",o.toString())));}
    private void state(Habbo h,boolean open,String text)throws Exception{send(h,snapshot(h,open,text));}
    private void scene(int roomId){Room r=Emulator.getGameEnvironment().getRoomManager().getRoom(roomId);if(r!=null)for(Habbo h:r.getHabbos()){JsonObject o=new JsonObject();o.addProperty("sceneOnly",true);o.add("anglers",anglers(roomId));send(h,o);}}
    public JsonObject admin(int user,JsonObject q)throws Exception{
        return worker.submit(()->{
            Habbo h=Emulator.getGameEnvironment().getHabboManager().getHabbo(user);if(!online(h)||!staff(h))throw new IllegalArgumentException("Die Angelverwaltung ist ab Rang 7 verfügbar.");
            Room inspected=null;boolean checked=false;String action=q.has("operation")?q.get("operation").getAsString():"read";
            FishingConfig next=FishingStore.JSON.fromJson(FishingStore.JSON.toJson(config),FishingConfig.class);
            if(action.equals("setupInspect")){int id=q.has("roomId")?q.get("roomId").getAsInt():0;inspected=id==0?room(h):Emulator.getGameEnvironment().getRoomManager().loadRoom(id,true);if(inspected==null)throw new IllegalArgumentException("Betritt zuerst einen Raum oder lade eine gültige Raum-ID.");}
            else if(action.equals("setupValidate")||action.equals("setupSave")){if(!q.has("revision")||!revision().equals(q.get("revision").getAsString()))throw new IllegalArgumentException("Die Konfiguration wurde inzwischen geändert. Bitte neu laden.");next.roomId=q.get("roomId").getAsInt();next.water=new ArrayList<>();for(JsonElement entry:q.getAsJsonArray("water")){var w=FishingStore.JSON.fromJson(entry,FishingConfig.Water.class);next.water.add(w);}next.water=new ArrayList<>(new LinkedHashSet<>(next.water));next.range=q.get("range").getAsInt();if(next.roomId!=config.roomId){next.merchantX=-1;next.merchantY=-1;}next.enabled=action.equals("setupValidate")||q.get("enabled").getAsBoolean();inspected=validateWater(next);checked=true;}
            else if(action.equals("config")){FishingConfig incoming=FishingStore.JSON.fromJson(q.get("config"),FishingConfig.class);incoming.water=incoming.roomId==next.roomId?next.water:new ArrayList<>();if(incoming.roomId!=next.roomId){incoming.enabled=false;incoming.merchantX=-1;incoming.merchantY=-1;}incoming.fish=next.fish;incoming.staffRank=Math.max(7,incoming.staffRank);incoming.passRequired=true;next=incoming;}
            else if(action.equals("fishSave")){var fish=FishingStore.JSON.fromJson(q.get("fish"),FishingRules.Fish.class);fish.validate();String key=fish.key;next.fish.removeIf(f->f.key.equals(key));next.fish.add(fish);next.fish.sort(Comparator.comparingInt(f->f.sortOrder));}
            else if(action.equals("fishDelete")){next.fish(q.get("key").getAsString()).enabled=false;}
            else if(!action.equals("read"))throw new IllegalArgumentException("Unbekannte Angelverwaltung.");
            if(!List.of("read","setupInspect","setupValidate").contains(action)){next.validate();if(next.roomId>0){try(var c=Emulator.getDatabase().getDataSource().getConnection();var p=c.prepareStatement("SELECT id FROM rooms WHERE id=?")){p.setInt(1,next.roomId);try(var r=p.executeQuery()){if(!r.next())throw new IllegalArgumentException("Angelraum nicht gefunden.");}}}if(next.roomId>0&&!next.water.isEmpty())validateWater(next);store.config(next,user);config=next;refreshRooms(h);for(Session s:new ArrayList<>(sessions.values()))cancel(s.habbo,"Die Angelkonfiguration wurde aktualisiert.");}
            JsonObject out=new JsonObject();out.add("config",FishingStore.JSON.toJsonTree(config));out.addProperty("revision",revision());if(inspected==null)inspected=room(h);if(inspected!=null)out.add("setupRoom",roomMap(inspected));out.addProperty("setupChecked",checked);if(q.has("setupToken"))out.add("setupToken",q.get("setupToken"));out.addProperty("notice",action.equals("setupValidate")?"Raum, Wasser und Fangregeln erfolgreich geprüft.":List.of("read","setupInspect").contains(action)?"":action.equals("setupSave")?"Einrichtung gespeichert"+(config.enabled?" und aktiviert.":" – Angelpark bleibt inaktiv."):"Gespeichert.");return out;
        }).get(20,TimeUnit.SECONDS);
    }
    private String revision(){return Integer.toHexString(FishingStore.JSON.toJson(config).hashCode());}
    private Room validateWater(FishingConfig c){
        c.validate();Room r=Emulator.getGameEnvironment().getRoomManager().loadRoom(c.roomId,true);if(r==null)throw new IllegalArgumentException("Angelraum nicht gefunden.");
        for(var w:c.water){RoomTile t=r.getLayout().getTile((short)w.x(),(short)w.y());if(t==null||t.state==RoomTileState.INVALID)throw new IllegalArgumentException("Wasserfeld "+w.x()+", "+w.y()+" liegt außerhalb des Raumbodens.");if(w.itemId()>0){var f=r.getHabboItem(w.itemId());if(f==null||f.getRoomId()!=r.getId())throw new IllegalArgumentException("Wassermöbel wurde entfernt. Bitte Auswahl neu laden.");}}
        if(c.enabled&&water(r,c).isEmpty())throw new IllegalArgumentException("Keine gültigen Wasserstellen gefunden.");return r;
    }
    private JsonObject roomMap(Room r){
        JsonObject o=new JsonObject();o.addProperty("id",r.getId());o.addProperty("name",r.getName());var l=r.getLayout();o.addProperty("width",l.getMapSizeX());o.addProperty("height",l.getMapSizeY());JsonArray tiles=new JsonArray(),items=new JsonArray();
        for(short y=0;y<l.getMapSizeY();y++)for(short x=0;x<l.getMapSizeX();x++){var t=l.getTile(x,y);if(t!=null&&t.state!=RoomTileState.INVALID){JsonObject v=new JsonObject();v.addProperty("x",x);v.addProperty("y",y);tiles.add(v);}}
        for(var f:r.getFloorItems()){JsonObject v=new JsonObject();v.addProperty("id",f.getId());v.addProperty("name",f.getBaseItem().getName());v.addProperty("x",f.getX());v.addProperty("y",f.getY());JsonArray area=new JsonArray();for(var t:l.getTilesAt(l.getTile(f.getX(),f.getY()),f.getBaseItem().getWidth(),f.getBaseItem().getLength(),f.getRotation()))if(t.state!=RoomTileState.INVALID){JsonObject point=new JsonObject();point.addProperty("x",t.x);point.addProperty("y",t.y);area.add(point);}v.add("tiles",area);items.add(v);}
        o.add("tiles",tiles);o.add("furniture",items);return o;
    }
    private void refreshRooms(Habbo administrator){Set<Habbo> users=new HashSet<>();Room configured=Emulator.getGameEnvironment().getRoomManager().getRoom(config.roomId);if(configured!=null)users.addAll(configured.getHabbos());Room current=room(administrator);if(current!=null)users.addAll(current.getHabbos());for(var h:users)safe(h,()->state(h,false,""));}
    private final class FishingCommand extends Command {
        FishingCommand(){super("cmd_habbix_fishing",new String[]{"angeln","angelsetup","angelhilfe","angelstopp","fischverkauf"});}
        @Override public boolean handle(GameClient client,String[] args){Habbo h=client.getHabbo();worker.execute(()->safe(h,()->command(h,args)));return true;}
    }
    private void command(Habbo h,String[] a)throws Exception{
        if(a[0].equals("angelsetup")){setup(h,a);return;}
        String action=a[0].equals("angelhilfe")?"hilfe":a[0].equals("angelstopp")?"stopp":a[0].equals("fischverkauf")?"verkaufen":a.length<2?"status":a[1].toLowerCase(Locale.ROOT);
        long now=System.currentTimeMillis();Long last=requests.put(uid(h),now);if(last!=null&&now-last<(List.of("start","moebel","ziehen","stopp").contains(action)?1200:200))throw new IllegalArgumentException("Bitte warte kurz, bevor du die Angel erneut auswirfst oder einziehst.");
        switch(action){
            case "start"->{if(a.length<4){requireRoom(h);var w=config.water.stream().filter(t->FishingRules.inReach(h.getRoomUnit().getX(),h.getRoomUnit().getY(),t.x(),t.y(),config.range)).findFirst().orElseThrow(()->new IllegalArgumentException("Kein Wasser in Reichweite."));start(h,w.x(),w.y(),w.itemId());}else start(h,FishingRules.bounded(a[2],0,255),FishingRules.bounded(a[3],0,255),0);}
            case "moebel"->{requireRoom(h);if(a.length<3)throw new IllegalArgumentException("Möbel-ID fehlt.");int id=FishingRules.bounded(a[2],1,Integer.MAX_VALUE);var f=room(h).getHabboItem(id);if(f==null)throw new IllegalArgumentException("Wasser-Möbel nicht gefunden.");start(h,h.getRoomUnit().getX(),h.getRoomUnit().getY(),id);}
            case "stopp"->{cancel(h,"Angel eingeholt.");state(h,true,"");}
            case "ziehen"->{Session s=sessions.get(uid(h));if(s==null||!s.bite)throw new IllegalArgumentException("Es beißt gerade kein Fisch.");if(now>s.deadline)settle(s,null);else settle(s,FishingRules.roll(ThreadLocalRandom.current(),store.snapshot(uid(h)).player().rod(),config));}
            case "verkaufen","reparieren","rute","pass"->{requireRoom(h);if(config.merchantX>=0&&!FishingRules.inReach(h.getRoomUnit().getX(),h.getRoomUnit().getY(),config.merchantX,config.merchantY,config.range))throw new IllegalArgumentException("Gehe näher zum Fischhändler.");String value=a[0].equals("fischverkauf")?(a.length>1?a[1]:"alle"):(a.length>2?a[2]:"alle");var result=store.exchange(h,config,switch(action){case "verkaufen"->"sell";case "reparieren"->"repair";case "rute"->"upgrade";default->"pass";},value);if(action.equals("verkaufen"))announce(h,result.message());else h.whisper(result.message());state(h,true,result.message());}
            case "meldungen"->{store.broadcast(uid(h),a.length>2&&a[2].equalsIgnoreCase("an"));state(h,true,"");}
            case "status","tasche"->{requireRoom(h);state(h,true,"");}
            case "hilfe"->{requireRoom(h);state(h,true,"");h.whisper("Doppelklicke auf Wasser in deiner Nähe. Fänge, Pässe, Ruten und Verkäufe findest du oben in der Angelübersicht.");}
            default->throw new IllegalArgumentException("Unbekannte Aktion. :angelhilfe");
        }
    }
    private void setup(Habbo h,String[] a)throws Exception{
        if(!staff(h))throw new IllegalArgumentException("Angel-Einrichtung ist ab Rang 7 verfügbar.");
        FishingConfig n=FishingStore.JSON.fromJson(FishingStore.JSON.toJson(config),FishingConfig.class);String action=a.length>1?a[1]:"hilfe";
        switch(action){
            case "raum"->{if(room(h)==null)throw new IllegalArgumentException("Betritt zuerst den Angelraum.");n.roomId=room(h).getId();n.water.clear();n.enabled=false;}
            case "wasser","haendler"->{if(room(h)==null||room(h).getId()!=n.roomId)throw new IllegalArgumentException("Betritt den festgelegten Angelraum.");int x=a.length>2?FishingRules.bounded(a[2],0,255):h.getRoomUnit().getX(),y=a.length>3?FishingRules.bounded(a[3],0,255):h.getRoomUnit().getY();if(room(h).getLayout().getTile((short)x,(short)y)==null)throw new IllegalArgumentException("Feld liegt außerhalb des Raums.");if(action.equals("wasser"))n.water.add(new FishingConfig.Water(x,y,0));else{n.merchantX=x;n.merchantY=y;}}
            case "flaeche"->{if(a.length!=6||room(h)==null||room(h).getId()!=n.roomId)throw new IllegalArgumentException(":angelsetup flaeche X1 Y1 X2 Y2 im Angelraum.");int x1=FishingRules.bounded(a[2],0,255),y1=FishingRules.bounded(a[3],0,255),x2=FishingRules.bounded(a[4],x1,255),y2=FishingRules.bounded(a[5],y1,255);if((x2-x1+1)*(y2-y1+1)+n.water.size()>2048)throw new IllegalArgumentException("Höchstens 2048 Wasserfelder.");for(int x=x1;x<=x2;x++)for(int y=y1;y<=y2;y++){if(room(h).getLayout().getTile((short)x,(short)y)==null)throw new IllegalArgumentException("Fläche liegt außerhalb des Raums.");n.water.add(new FishingConfig.Water(x,y,0));}}
            case "moebel"->{if(a.length<3||room(h)==null||room(h).getId()!=n.roomId)throw new IllegalArgumentException(":angelsetup moebel ID im Angelraum.");int id=FishingRules.bounded(a[2],1,Integer.MAX_VALUE);var f=room(h).getHabboItem(id);if(f==null)throw new IllegalArgumentException("Möbel nicht gefunden.");n.water.add(new FishingConfig.Water(f.getX(),f.getY(),id));}
            case "wasserleeren"->n.water.clear();
            case "entfernen"->{if(a.length<4)throw new IllegalArgumentException(":angelsetup entfernen X Y");int x=FishingRules.bounded(a[2],0,255),y=FishingRules.bounded(a[3],0,255);n.water.removeIf(w->w.x()==x&&w.y()==y);}
            case "abstand"->{if(a.length<3)throw new IllegalArgumentException(":angelsetup abstand 1–4");n.range=FishingRules.bounded(a[2],1,4);}
            case "zeit"->{if(a.length<4)throw new IllegalArgumentException(":angelsetup zeit MIN MAX");n.minWait=FishingRules.bounded(a[2],5,120);n.maxWait=FishingRules.bounded(a[3],n.minWait,120);}
            case "passpflicht","manuell"->{if(a.length<3||!List.of("an","aus").contains(a[2]))throw new IllegalArgumentException("Bitte an oder aus angeben.");if(action.equals("manuell"))n.manualHook=a[2].equals("an");else n.passRequired=a[2].equals("an");}
            case "an"->{if(n.roomId==0||n.water.isEmpty())throw new IllegalArgumentException("Erst Raum und Wasser einrichten.");n.enabled=true;}
            case "aus"->n.enabled=false;
            case "pruefen"->{h.whisper("Angelpark: Raum "+n.roomId+", "+n.water.size()+" Wasserfelder, Abstand "+n.range+", aktiv: "+n.enabled);return;}
            default->{h.whisper(":angelsetup raum · wasser X Y · flaeche X1 Y1 X2 Y2 · moebel ID · haendler X Y · abstand 1–4 · zeit MIN MAX · passpflicht an|aus · manuell an|aus · an|aus · pruefen · wasserleeren");return;}
        }
        n.water=new ArrayList<>(new LinkedHashSet<>(n.water));n.passRequired=true;n.validate();if(n.roomId>0&&!n.water.isEmpty())validateWater(n);store.config(n,uid(h));config=n;refreshRooms(h);for(Session s:new ArrayList<>(sessions.values()))cancel(s.habbo,"Angelpark neu eingerichtet.");h.whisper("Angel-Einstellung gespeichert: "+action);state(h,true,"");
    }
}
