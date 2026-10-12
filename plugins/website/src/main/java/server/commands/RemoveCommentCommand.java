package server.commands;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.commands.Command;
import com.eu.habbo.habbohotel.gameclients.GameClient;
import com.eu.habbo.habbohotel.rooms.RoomChatMessageBubbles;
import com.eu.habbo.habbohotel.users.HabboInfo;
import server.Main;
import server.data.classes.article.Article;
import server.data.classes.article.Comments;
import server.data.classes.tweet.Tweet;
import server.data.queries.ArticleDao;
import server.data.queries.TweetDao;

import java.util.List;

public class RemoveCommentCommand extends Command {
    public RemoveCommentCommand(String permission, String[] keys) {
        super(permission, keys);
    }

    @Override
    public boolean handle(GameClient gameClient, String[] params) throws Exception {
        if (params.length < 3) {
            gameClient.getHabbo().whisper("Debes asignar el nombre de usuario y id de la noticia para eliminar los comentarios");
            return true;
        }

        HabboInfo habbo = Emulator.getGameEnvironment().getHabboManager().getHabbo(params[1]).getHabboInfo() != null ? Emulator.getGameEnvironment().getHabboManager().getHabbo(params[1]).getHabboInfo() : Emulator.getGameEnvironment().getHabboManager().getOfflineHabboInfo(params[1]);

        if (habbo == null){
            gameClient.getHabbo().whisper("Este usuario no existe!", RoomChatMessageBubbles.ALERT);
            return true;
        }

        Article article = Main.website.articleManager.getArticle(Integer.parseInt(params[2]));

        if (article == null){
            gameClient.getHabbo().whisper("Esta noticia no existe!", RoomChatMessageBubbles.ALERT);
            return true;
        }

        List<Comments> commentsList = article.comments;
        int i = 0;

        for (Comments comment : commentsList){
            if (comment.getAccount().getId() == habbo.getId()){
                if (ArticleDao.deleteComment(comment.getId())){
                    article.comments.remove(comment);
                    i++;
                }
            }
        }

        if (i == 0) gameClient.getHabbo().whisper("este usuario no tiene comentarios ene ste articulo");
        else gameClient.getHabbo().whisper("Se eliminaron (" + i + ") comentarios del usuario: " + habbo.getUsername());

        return true;
    }
}
