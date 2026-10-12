package server.websocket.outgoing.common.misc;

import com.google.gson.JsonPrimitive;
import server.websocket.outgoing.OutgoingWebMessage;

public class DataComposer extends OutgoingWebMessage {
    public DataComposer(String type, Object data) {
        super(type);
        this.data.add("data", new JsonPrimitive(data.toString()));
    }
}
