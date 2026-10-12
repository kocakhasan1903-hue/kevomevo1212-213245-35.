package server.websocket.incoming.common.catalog;

import server.data.queries.MiscDao;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.misc.DataComposer;

public class UpdatePriceItemEvent extends IncomingWebMessage<UpdatePriceItemEvent.JSONUpdatePriceItemEvent> {

    public UpdatePriceItemEvent(){
        super(JSONUpdatePriceItemEvent.class);
    }

    @Override
    public void handle(WebSocketClient client, JSONUpdatePriceItemEvent message) throws InterruptedException {
        if(client.getAccount() != null){

            if(!client.getAccount().getEditCatalogPrice()){
                client.sendMessage(new DataComposer("updateCatalogPriceResponse", "NoPermissions"));
                return;
            }

            boolean update = MiscDao.updateRareCatalogPrice(message.id, message.credits, message.diamonds);

            if(update){
                client.sendMessage(new DataComposer("updateCatalogPriceResponse", "Ok"));
            }else {
                client.sendMessage(new DataComposer("updateCatalogPriceResponse", "Error"));
            }
        }
    }

    static class JSONUpdatePriceItemEvent {
        int id;
        int credits;
        int diamonds;
    }
}
