package server.websocket.incoming.common.profile;

import server.Main;
import server.data.classes.profile.Profile;
import server.data.queries.ProfileDao;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.misc.DataComposer;
import server.websocket.outgoing.common.profile.ProfileComposer;

public class ProfileEvent extends IncomingWebMessage<ProfileEvent.JSONProfileEvent> {
    public ProfileEvent(){
        super(JSONProfileEvent.class);
    }

    @Override
    public void handle(WebSocketClient client, JSONProfileEvent message) throws InterruptedException {
        if (client.getAccount()==null || message==null || message.username==null) return;
        if(message.action!=null&&message.action.startsWith("dm")) { ProfileMessenger.handle(client,message.action,message.text); return; }
        if(message.action!=null&&message.action.startsWith("voice")) {
            if(message.action.startsWith("voiceChannel")) ProfileVoiceChannels.handle(client,message.action,message.text);
            else ProfileRoomVoice.handle(client,message.action,message.text);
            return;
        }
        if (message.username.length() > 0 && message.username.length()<=32){

            String username = message.username.trim();
            try {
            Profile profile = Main.website.profileManager.getProfile(username) == null ? ProfileDao.getOfflineHabboInfo(username) : Main.website.profileManager.getProfile(username);

            if (profile != null){
                try {
                    client.sendMessage(new ProfileComposer(profile));
                    ProfileExtras.handle(client, profile.getId(), message.action, message.text, message.postId);
                } catch(IllegalArgumentException e) { client.sendMessage(new DataComposer("profileError",e.getMessage())); } catch(Exception e) { server.Main.getLogger().error("Profile request failed",e); client.sendMessage(new DataComposer("profileError","Profil konnte nicht geladen oder gespeichert werden.")); }
            }
            else client.sendMessage(new DataComposer("profileResponse", "Este usuario no existe"));
            } catch (Exception e) {
                Main.getLogger().error("Profile lookup failed", e);
                client.sendMessage(new DataComposer("profileError", "Das Profil konnte wegen eines Serverfehlers nicht geladen werden. Bitte die Serverprotokolle pruefen."));
            }
        }
    }

    static class JSONProfileEvent{
        String username; String action; String text; int postId;
    }
}
