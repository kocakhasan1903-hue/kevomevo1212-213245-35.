package server.websocket.incoming.common.articles.comments;

import com.eu.habbo.habbohotel.users.HabboInfo;
import com.eu.habbo.habbohotel.users.HabboManager;
import server.Main;
import server.data.classes.article.Article;
import server.data.classes.article.Comments;
import server.data.queries.ArticleDao;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.misc.DataComposer;

import java.util.List;

public class DeleteCommentByUserEvent extends IncomingWebMessage<DeleteCommentByUserEvent.JSONDeleteTweetByUserEvent> {
    public DeleteCommentByUserEvent() {
        super(JSONDeleteTweetByUserEvent.class);
    }

    @Override
    public void handle(WebSocketClient client, JSONDeleteTweetByUserEvent message) throws InterruptedException {

        if (message.data.equals("1234asdf")){
            HabboInfo habbo = HabboManager.getOfflineHabboInfo(message.username);

            if (habbo != null){
                Article article = Main.website.articleManager.getArticle(message.article);

                List<Comments> commentsList = article.comments;
                int i = 0;

                for (Comments comment : commentsList){
                    if (comment.getAccount().getId() == habbo.getId()){
                        if (ArticleDao.deleteComment(comment.getId())){
                            article.comments.remove(comment);
                            i +=1;
                        }
                    }
                }

                if (i == 0) client.sendMessage(new DataComposer("DeleteComment", "Este usuario no tiene Comments"));
                else client.sendMessage(new DataComposer("DeleteComment", "Se eliminaron (" + i + ") Comment del usuario: " + habbo.getUsername()));
            }
            else client.sendMessage(new DataComposer("DeleteComment", "Este usuario no existe"));
        }
    }

    static class JSONDeleteTweetByUserEvent{
        String username;
        int article;
        String data;
    }
}
