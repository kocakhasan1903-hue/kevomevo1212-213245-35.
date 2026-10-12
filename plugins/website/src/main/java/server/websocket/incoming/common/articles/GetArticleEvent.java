package server.websocket.incoming.common.articles;

import server.Main;
import server.data.classes.article.Article;
import server.data.classes.article.Comments;
import server.websocket.client.WebSocketClient;
import server.websocket.incoming.IncomingWebMessage;
import server.websocket.outgoing.common.articles.ArticleDataComposer;

import java.util.List;

public class GetArticleEvent extends IncomingWebMessage<GetArticleEvent.JSONGetArticleEvent> {
    public GetArticleEvent(){
        super(JSONGetArticleEvent.class);
    }

    @Override
    public void handle(WebSocketClient client, JSONGetArticleEvent message) throws InterruptedException {

        Article article = Main.website.articleManager.getArticle(message.id);
        List<Comments> comments = article.comments;

        client.sendMessage(new ArticleDataComposer(article, comments));
    }

    static class JSONGetArticleEvent {
        int id;
    }
}
