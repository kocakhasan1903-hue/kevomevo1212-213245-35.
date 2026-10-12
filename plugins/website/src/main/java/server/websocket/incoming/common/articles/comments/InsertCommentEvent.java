package server.websocket.incoming.common.articles.comments;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.modtool.WordFilter;
import server.Main;
import server.data.classes.article.Article;
import server.data.classes.article.Comments;
import server.data.classes.cooldown.CooldownManager;
import server.data.classes.cooldown.CooldownType;
import server.data.queries.ArticleDao;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.misc.DataComposer;

public class InsertCommentEvent extends IncomingWebMessage<InsertCommentEvent.JSONInsertCommentEvent> {
    public InsertCommentEvent(){
        super(JSONInsertCommentEvent.class);
    }

    @Override
    public void handle(WebSocketClient client, JSONInsertCommentEvent message) throws InterruptedException {
        if (client.getAccount() != null){

            CooldownManager cm = Main.website.getCooldownManager();

            if (cm.isOnCooldown(client, CooldownType.ANTISPAM)) {
                client.sendMessage(new DataComposer("CommentResponse", "cooldown"));
            } else {
                Article article = Main.website.articleManager.getArticle(message.id);
                String text = message.message.replace("\n", "");

                if (article != null) {
                    if (text.length() > 5){
                        WordFilter word = Emulator.getGameEnvironment().getWordFilter();
                        String messageFilter = word.filter(text, null);

                        if (text.equals(messageFilter)){
                            Comments comment = ArticleDao.insertComment(article, text, client.getAccount());

                            if (comment != null){
                                cm.setCooldown(client, CooldownType.ANTISPAM, 15);
                                article.addComment(comment);
                                client.sendMessage(new DataComposer("CommentResponse", "Comentario creado con exito"));
                            }
                            else client.sendMessage(new DataComposer("CommentResponse", "Algo salio mal"));
                        }
                        else  client.sendMessage(new DataComposer("CommentResponse", "No intentes hacer publicidad"));
                    }
                    else  client.sendMessage(new DataComposer("CommentResponse", "Comentario no valido"));
                }
                else client.sendMessage(new DataComposer("CommentResponse", "Esta noticia no existe"));
            }
        }
    }

    static class JSONInsertCommentEvent{
        int id;
        String message;
    }
}
