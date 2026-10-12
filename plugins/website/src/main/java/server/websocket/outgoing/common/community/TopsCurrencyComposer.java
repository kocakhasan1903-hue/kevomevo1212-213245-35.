package server.websocket.outgoing.common.community;

import com.google.gson.*;
import server.data.classes.community.data.TopsCurrency;
import server.utils.JsonFactory;
import server.websocket.outgoing.OutgoingWebMessage;

import java.util.List;

public class TopsCurrencyComposer extends OutgoingWebMessage {
    public TopsCurrencyComposer(List<TopsCurrency> topsCurrencyCredits, List<TopsCurrency> topsCurrencyDuckets, List<TopsCurrency> topsCurrency, List<TopsCurrency> topsCurrencyDiamonds, List<TopsCurrency> lastUsers) {
        super("usersTops");
        this.data.add("credits", new JsonPrimitive(JsonFactory.getInstance().toJson(topsCurrencyCredits)));
        this.data.add("duckets", new JsonPrimitive(JsonFactory.getInstance().toJson(topsCurrencyDuckets)));
        this.data.add("currency", new JsonPrimitive(JsonFactory.getInstance().toJson(topsCurrency)));
        this.data.add("diamonds", new JsonPrimitive(JsonFactory.getInstance().toJson(topsCurrencyDiamonds)));
        this.data.add("lastUsers", new JsonPrimitive(JsonFactory.getInstance().toJson(lastUsers)));
    }
}
