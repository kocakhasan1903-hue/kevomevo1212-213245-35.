package server.websocket.incoming.common.articles.comments;

import server.Main;
import server.data.classes.article.Article;
import server.data.queries.ArticleDao;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.misc.DataComposer;

public class RemoveCommentEvent extends IncomingWebMessage<RemoveCommentEvent.JSONRemoveCommentEvent> {
    public RemoveCommentEvent(){
        super(JSONRemoveCommentEvent.class);
    }

    @Override
    public void handle(WebSocketClient client, JSONRemoveCommentEvent message) throws InterruptedException {
        if (client.getAccount() != null){
            Article article = Main.website.getArticleManager().getArticle(message.newId);

            if (article != null) {
                if (article.deleteMyComment(message.commentId, client.getAccount().getId())){
                    if(ArticleDao.deleteComment(message.commentId)){
                        client.sendMessage(new DataComposer("removeCommentResponse", "Comentario borrado con exito"));
                    }
                    else client.sendMessage(new DataComposer("removeCommentResponse", "Algo salio mal"));
                }
            }
            else client.sendMessage(new DataComposer("removeCommentResponse", "Esta noticia no existe"));
        }
    }

    static class JSONRemoveCommentEvent{
        int newId;
        int commentId;
    }
}
