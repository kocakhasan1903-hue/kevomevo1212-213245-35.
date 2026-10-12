package server.websocket.outgoing.common.community;

import com.google.gson.JsonPrimitive;
import server.data.classes.community.data.Ranks;
import server.data.classes.community.data.Staffs;
import server.utils.JsonFactory;
import server.websocket.outgoing.OutgoingWebMessage;

import java.util.List;

public class StaffsComposer extends OutgoingWebMessage {
    public StaffsComposer(List<Staffs> staffs, List<Ranks> ranks) {
        super("staff");
        this.data.add("staffs", new JsonPrimitive(JsonFactory.getInstance().toJson(staffs)));
        this.data.add("ranks", new JsonPrimitive(JsonFactory.getInstance().toJson(ranks)));
    }
}
