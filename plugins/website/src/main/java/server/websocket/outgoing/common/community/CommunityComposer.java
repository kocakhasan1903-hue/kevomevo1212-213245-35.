package server.websocket.outgoing.common.community;

import com.google.gson.JsonPrimitive;
import server.Main;
import server.data.classes.community.CommunityManager;
import server.data.classes.misc.StatsType;
import server.utils.JsonFactory;
import server.websocket.outgoing.OutgoingWebMessage;

public class CommunityComposer extends OutgoingWebMessage {
    public CommunityComposer() {
        super("topsStats");

        CommunityManager community = Main.website.communityManager;

        //Tops Stats
        for (StatsType stats : StatsType.values()){
            this.data.add(stats.getType(), new JsonPrimitive(JsonFactory.getInstance().toJson(community.getTopsStats(stats))));
        }

        //Tops Rooms
        try{
            this.data.add("roomsPopulars", new JsonPrimitive(JsonFactory.getInstance().toJson(community.getPopularRooms(10))));
        } catch (Exception e) {
            this.data.add("roomsPopulars", new JsonPrimitive(""));
        }

        this.data.add("roomsScores", new JsonPrimitive(JsonFactory.getInstance().toJson(community.topsRoomScore)));

        //Photos
        this.data.add("photos", new JsonPrimitive(JsonFactory.getInstance().toJson(community.photos)));

        this.data.add("credits", new JsonPrimitive(JsonFactory.getInstance().toJson(community.topsCredits)));
        this.data.add("duckets", new JsonPrimitive(JsonFactory.getInstance().toJson(community.topsDuckets)));
        this.data.add("currency", new JsonPrimitive(JsonFactory.getInstance().toJson(community.topsCurrency)));
        this.data.add("diamonds", new JsonPrimitive(JsonFactory.getInstance().toJson(community.topsDiamonds)));
        this.data.add("points", new JsonPrimitive(JsonFactory.getInstance().toJson(community.topsGamePoints)));

        //Groups
        try{
            this.data.add("groups", new JsonPrimitive(JsonFactory.getInstance().toJson(community.getGuildMembersCount(10))));
        } catch (Exception e) {
            Main.getLogger().error(e.getMessage());
        }


    }
}
