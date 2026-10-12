package server.websocket.incoming.common.community;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.bots.Bot;
import com.eu.habbo.habbohotel.rooms.*;
import com.eu.habbo.habbohotel.users.HabboGender;
import com.eu.habbo.messages.outgoing.rooms.users.RoomUsersComposer;
import com.eu.habbo.messages.outgoing.rooms.users.RoomUserStatusComposer;
import com.eu.habbo.plugin.*;
import com.eu.habbo.plugin.events.bots.BotPickUpEvent;
import java.sql.*;
import java.util.*;
import org.slf4j.LoggerFactory;

/** Persistent, stationary avatar copies; never logs the copied account into the hotel. */
public final class PhantomRooms implements com.eu.habbo.plugin.EventListener {
    private static Timer timer;
    private static final Map<Integer,State> states=new HashMap<>();
    private static final class State {
        final Room room;final String signature;final List<Bot> avatars;
        State(Room r,String s,List<Bot> a){room=r;signature=s;avatars=a;}
    }
    private static final class PhantomBot extends Bot {
        PhantomBot(int id,String name,String motto,String look,HabboGender gender,int owner){super(-id,name,motto,look,gender,owner,name);setCanWalk(false);}
    }
    public static synchronized void start(HabboPlugin plugin){
        if(timer!=null)return;
        Emulator.getPluginManager().registerEvents(plugin,new PhantomRooms());
        timer=new Timer("CMS phantom rooms",true);
        timer.schedule(new TimerTask(){public void run(){try{refresh();}catch(Exception e){LoggerFactory.getLogger(PhantomRooms.class).error("Phantom room refresh failed",e);}}},2000,10000);
    }
    @EventHandler public static void pickup(BotPickUpEvent event){if(event.bot instanceof PhantomBot)event.setCancelled(true);}
    private static void runtime(int id,String status,String message) throws SQLException {
        try(Connection db=Emulator.getDatabase().getDataSource().getConnection();PreparedStatement q=db.prepareStatement("INSERT INTO habboje_shop.phantom_runtime(phantom_id,status,message) VALUES(?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),message=VALUES(message),checked_at=CURRENT_TIMESTAMP")){
            q.setInt(1,id);q.setString(2,status);q.setString(3,message);q.executeUpdate();
        }
    }
    private static void remove(State state){for(Bot bot:state.avatars)if(bot.getRoom()==state.room)state.room.removeBot(bot);}
    public static synchronized void stop(){if(timer!=null)timer.cancel();timer=null;for(State state:states.values())remove(state);states.clear();}
    public static synchronized void refresh() throws SQLException {
        PluginRuntime.touch("phantom", "Raumfiguren-Synchronisation aktiv.");
        Map<Integer,List<Map<String,Object>>> entries=new HashMap<>();
        // Finish the query before changing room state: a failed query never clears existing avatars.
        try(Connection db=Emulator.getDatabase().getDataSource().getConnection();PreparedStatement q=db.prepareStatement("SELECT p.*,u.username,u.motto,u.look,u.gender FROM habboje_shop.phantom_rooms p JOIN users u ON u.id=p.user_id WHERE p.enabled=1 ORDER BY p.id");ResultSet r=q.executeQuery()){
            while(r.next()){
                Map<String,Object> row=new LinkedHashMap<>();
                for(String field:new String[]{"id","user_id","room_id","x","y","rotation"})row.put(field,r.getInt(field));
                row.put("z",r.getDouble("z"));
                for(String field:new String[]{"username","motto","look","gender"})row.put(field,r.getString(field));
                entries.computeIfAbsent(r.getInt("room_id"),k->new ArrayList<>()).add(row);
            }
        }
        Set<Integer> active=new HashSet<>();
        for(Room room:Emulator.getGameEnvironment().getRoomManager().getActiveRooms()){
            active.add(room.getId());List<Map<String,Object>> found=entries.getOrDefault(room.getId(),Collections.emptyList());String signature=found.toString();State old=states.get(room.getId());
            if(old!=null&&old.room==room&&old.signature.equals(signature)){
                boolean attached=true;
                for(Bot bot:old.avatars){
                    if(bot.getRoom()!=room||room.getBot(bot.getId())!=bot){attached=false;continue;}
                    runtime(-bot.getId(),"visible","Im geladenen Raum eingebunden.");
                }
                if(attached&&old.avatars.size()==found.size())continue;
            }
            if(old!=null)remove(old);
            List<Bot> avatars=new ArrayList<>();
            for(Map<String,Object> row:found){
                RoomTile tile=room.getLayout().getTile((short)(int)row.get("x"),(short)(int)row.get("y"));
                if(tile==null||tile.state==RoomTileState.INVALID){runtime((int)row.get("id"),"invalid_position","X/Y liegt außerhalb der begehbaren Raumfläche.");continue;}
                HabboGender gender="F".equals(row.get("gender"))?HabboGender.F:HabboGender.M;
                Bot bot=new PhantomBot((int)row.get("id"),(String)row.get("username"),(String)row.get("motto"),(String)row.get("look"),gender,(int)row.get("user_id"));
                RoomUnit unit=new RoomUnit();unit.setRotation(RoomUserRotation.fromValue((int)row.get("rotation")));unit.setLocation(tile);unit.setZ((double)row.get("z"));unit.setPreviousLocationZ((double)row.get("z"));unit.setPathFinderRoom(room);unit.setRoomUnitType(RoomUnitType.BOT);unit.setCanWalk(false);
                bot.setRoomUnit(unit);bot.setRoom(room);room.addBot(bot);avatars.add(bot);
                room.sendComposer(new RoomUsersComposer(bot).compose());room.sendComposer(new RoomUserStatusComposer(unit).compose());
                runtime((int)row.get("id"),"visible","Im geladenen Raum eingebunden.");
            }
            states.put(room.getId(),new State(room,signature,avatars));
        }
        for(Map.Entry<Integer,List<Map<String,Object>>> entry:entries.entrySet()){
            if(!active.contains(entry.getKey()))for(Map<String,Object> row:entry.getValue())runtime((int)row.get("id"),"waiting_room","Raum betreten, damit er geladen wird.");
        }
        Iterator<Map.Entry<Integer,State>> iterator=states.entrySet().iterator();
        while(iterator.hasNext()){Map.Entry<Integer,State> entry=iterator.next();if(!active.contains(entry.getKey())){remove(entry.getValue());iterator.remove();}}
    }
}
