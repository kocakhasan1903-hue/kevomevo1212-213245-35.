package server.data.classes.community;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.guilds.Guild;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.rooms.RoomManager;
import server.Main;
import server.data.classes.account.Account;
import server.data.classes.community.data.*;
import server.data.classes.misc.GroupData;
import server.data.classes.misc.RoomData;
import server.data.classes.misc.StatsType;
import server.data.queries.CommunityDao;

import java.util.*;
import java.util.stream.Collectors;


public class CommunityManager {
    long millis = System.currentTimeMillis();
    public List<Photos> photos =  new ArrayList<>();
    public List<TopsCurrency> lastUsers = new ArrayList<>();
    public List<Staffs> staffs = new ArrayList<>();
    public List<Ranks> ranks = new ArrayList<>();
    public List<Vips> vips = new ArrayList<>();

    //TOPS
    public List<TopsCurrency> topsCredits = new ArrayList<>();
    public List<TopsCurrency> topsDuckets = new ArrayList<>();
    public List<TopsCurrency> topsDiamonds = new ArrayList<>();
    public List<TopsCurrency> topsCurrency = new ArrayList<>();
    public List<TopsCurrency> topsGamePoints = new ArrayList<>();
    public List<TopsStats> topsStats = new ArrayList<>();
    public List<RoomData> topsRoomScore = new ArrayList<>();

    private boolean load = false;

    public static final Comparator SORT_MEMBERS = (o1, o2) -> {
        return o1 instanceof GroupData && o2 instanceof GroupData ? ((GroupData)o2).getMemberCount() - ((GroupData)o1).getMemberCount() : 0;
    };

    public CommunityManager(){
        this.loadCommunity();
        this.runReloadThread();
    }

    public void loadCommunity(){
        //Load Photos
        this.loadPhotos();

        //Load lastUsers
        this.lastUsers.clear();
        this.lastUsers = CommunityDao.lastUsers();

        //Load Staffs
        this.loadStaffs();

        //Load Vips
        this.loadVips();

        //Load Tops
        this.loadTopsCurrency();
        this.loadTopsRooms();

        this.load = true;
        Main.getLogger().info("Community loaded! (" + (System.currentTimeMillis() - millis) + " MS)");
    }

    public void loadPhotos(){
        this.photos.clear();

        this.photos = CommunityDao.loadPhotos();
        Main.getLogger().info("Photos loaded! (" + (System.currentTimeMillis() - millis) + " MS)");
    }

    public void loadStaffs(){
        this.staffs.clear();
        this.ranks.clear();

        this.staffs = CommunityDao.loadStaffs();
        this.ranks = CommunityDao.loadRanks();
        Main.getLogger().info("Staffs loaded! (" + (System.currentTimeMillis() - millis) + " MS)");
    }

    public void loadVips(){
        this.vips.clear();

        this.vips = CommunityDao.loadVips();
        Main.getLogger().info("Vips loaded! (" + (System.currentTimeMillis() - millis) + " MS)");
    }

    public void loadTopsCurrency(){
        this.topsDuckets.clear();
        this.topsCurrency.clear();
        this.topsCredits.clear();
        this.topsDiamonds.clear();
        this.topsGamePoints.clear();

        this.topsDuckets = CommunityDao.loadTopsByCurrency(0);
        this.topsDiamonds = CommunityDao.loadTopsByCurrency(5);
        this.topsCurrency = CommunityDao.loadTopsByCurrency(104);
        this.topsGamePoints = CommunityDao.loadTopsByCurrency(101);
        this.topsCredits = CommunityDao.loadTopsByCredits();
        Main.getLogger().info("Tops loaded! (" + (System.currentTimeMillis() - millis) + " MS)");
    }

    public void loadTopsRooms(){
        this.topsStats.clear();
        this.topsRoomScore.clear();

        this.topsStats = CommunityDao.loadStats();
        this.topsRoomScore = CommunityDao.loadTopsRoomsScore();
        Main.getLogger().info("Tops Rooms loaded! (" + (System.currentTimeMillis() - millis) + " MS)");
    }

    public void dispose(){
        this.photos = null;
    }

    public ArrayList<RoomData> getPopularRooms(int count) {
        ArrayList<RoomData> rooms = new ArrayList<>();

        for (Room room : Emulator.getGameEnvironment().getRoomManager().getActiveRooms()) {
            if (room.getUserCount() > 0) {
                if (!room.isPublicRoom() || RoomManager.SHOW_PUBLIC_IN_POPULAR_TAB){
                    try{
                        rooms.add(new RoomData(room.getId(), room.getName(), room.getUserCount(), room.getUsersMax(), room.getScore()));
                    } catch (Exception e) {
                        Main.getLogger().error(e.getMessage());
                    }
                }
            }
        }

        if (rooms.isEmpty()) {
            return rooms;
        }

        rooms.sort(RoomData.SORT_ID);

        return new ArrayList<>(rooms.subList(0, (rooms.size() < count ? rooms.size() : count)));
    }

    public ArrayList<GroupData> getGuildMembersCount(int count) {
        ArrayList<GroupData> groups = new ArrayList<>();
        for (Guild data : Emulator.getGameEnvironment().getGuildManager().getAllGuilds()){

            Guild guild = Emulator.getGameEnvironment().getGuildManager().getGuild(data.getId());
            if (guild.getMemberCount() > 0) {
                groups.add(new GroupData(guild));
            }
        }

        if (groups.isEmpty()) {
            return groups;
        }

        groups.sort(GroupData.SORT_MEMBERS);

        return new ArrayList<>(groups.subList(0, (Math.min(groups.size(), count))));
    }


    public void updateLastUsers(Account account) {
        int i;
        TopsCurrency aux = this.lastUsers.get(this.lastUsers.size() - 1); //guardar el último elemento en una variable

        for (i = this.lastUsers.size() - 1; i > 0; i--) { //desplazar los elementos
            this.lastUsers.set(i, this.lastUsers.get(i - 1)); //a cada elemento se le asigna el anterior
        }


        this.lastUsers.remove(aux);
        this.lastUsers.set(0, new TopsCurrency(account.getUsername(), account.getLook(), 0, Emulator.getIntUnixTimestamp())); //asignar al primero el último que se guardó al principio
    }

    public List<TopsStats> getTopsStats(StatsType type){
       return this.topsStats.stream()
                .filter(data -> type.getType().equalsIgnoreCase(data.getStatsType().getType()))
                .collect(Collectors.toList());
    }
    public List<Photos> getPhotos() {
        return photos;
    }

    public List<TopsCurrency> getLastUsers(){ return lastUsers;}

    public List<TopsCurrency> getTopsCredits() {
        return topsCredits;
    }

    public List<TopsCurrency> getTopsDuckets() {
        return topsDuckets;
    }

    public List<TopsCurrency> getTopsCurrency() {
        return topsCurrency;
    }

    public List<TopsCurrency> getTopsDiamonds() {
        return topsDiamonds;
    }

    public void runReloadThread(){
        Thread thread = new Thread(this::run, "Community Reload");
        thread.start();
    }

    private void run() {
        while (true) {

            if (this.load){
                this.load = false;
                this.loadCommunity();
            }

            try {
                Thread.sleep(1800000);
            } catch (InterruptedException ex) {
                System.out.println(ex.getMessage());
                Thread.currentThread().interrupt();
            }
        }
    }
}
