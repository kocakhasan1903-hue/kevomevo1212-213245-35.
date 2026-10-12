package com.eu.habbo.habbohotel.commands;
import com.eu.habbo.habbohotel.events.HabbixEventManager;
import com.eu.habbo.habbohotel.gameclients.GameClient;
import com.eu.habbo.habbohotel.rooms.RoomChatMessageBubbles;
import com.google.gson.*;
import java.util.Arrays;

/** Emulator-local management works without any CMS/client changes. */
public final class EventManagerCommand extends Command {
    public EventManagerCommand(){super(null,new String[]{"eventmanager"});}
    @Override public boolean handle(GameClient client,String[] params){
        try{
            var manager=HabbixEventManager.getInstance();int user=client.getHabbo().getHabboInfo().getId();
            if(!manager.canManage(user))throw new IllegalArgumentException("Eventverwaltung ist für deinen Rang nicht freigeschaltet.");
            if(params.length<2)throw new IllegalArgumentException(":eventmanager create {JSON} | cancel ID | list. Beispiel: create {\"kind\":\"giveaway\",\"itemId\":1,\"durationSeconds\":60,\"scope\":\"room\"}");
            JsonObject request=new JsonObject();String action="eventState";
            if(params[1].equalsIgnoreCase("create")||params[1].equalsIgnoreCase("collection")){action=params[1].equalsIgnoreCase("collection")?"eventCollectionSave":"eventCreate";request=new JsonParser().parse(String.join(" ",Arrays.copyOfRange(params,2,params.length))).getAsJsonObject();}
            else if(params[1].equalsIgnoreCase("deletecollection")&&params.length==3){action="eventCollectionDelete";request.addProperty("id",Integer.parseInt(params[2]));}
            else if(params[1].equalsIgnoreCase("startcollection")&&params.length>=3){action="eventCollectionStart";request.addProperty("id",Integer.parseInt(params[2]));request.addProperty("scope",params.length>3?params[3]:"hotel");}
            else if(params[1].equalsIgnoreCase("stopcollection")&&params.length==3){action="eventCollectionStop";request.addProperty("id",Integer.parseInt(params[2]));}
            else if(params[1].equalsIgnoreCase("cancel")&&params.length==3){action="eventCancel";request.addProperty("id",Integer.parseInt(params[2]));}
            else if(!params[1].equalsIgnoreCase("list"))throw new IllegalArgumentException("Unbekannte Event-Aktion.");
            JsonObject state=manager.request(user,action,request);
            if(action.equals("eventState")){StringBuilder list=new StringBuilder("Events:\n");for(JsonElement entry:state.getAsJsonArray("activities")){JsonObject e=entry.getAsJsonObject();list.append('#').append(e.get("id").getAsInt()).append(" · ").append(e.get("title").getAsString()).append(" · ").append(e.get("status").getAsString()).append('\n');}client.getHabbo().alert(list.toString());}
            else client.getHabbo().whisper(state.get("notice").getAsString(),RoomChatMessageBubbles.ALERT);
        }catch(Exception e){client.getHabbo().whisper(e instanceof IllegalArgumentException?e.getMessage():"Event-Anfrage fehlgeschlagen. Bitte Emulatorlog prüfen.",RoomChatMessageBubbles.ALERT);}
        return true;
    }
}
