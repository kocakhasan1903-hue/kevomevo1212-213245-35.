package server.websocket.outgoing.common.community;

import com.google.gson.Gson;
import server.data.classes.community.data.Vips;
import server.websocket.outgoing.OutgoingWebMessage;

import java.util.List;

public class VipsComposer extends OutgoingWebMessage {
    public VipsComposer(List<Vips> vips) {
        super("usersVips");
        this.data.add("vips", new Gson().toJsonTree(vips));
    }
}
