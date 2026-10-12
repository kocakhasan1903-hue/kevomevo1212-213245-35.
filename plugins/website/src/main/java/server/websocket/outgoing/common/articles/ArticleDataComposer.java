package server.websocket.outgoing.common.articles;

import com.google.gson.JsonPrimitive;
import server.data.classes.article.Article;
import server.data.classes.article.Comments;
import server.utils.JsonFactory;
import server.websocket.outgoing.OutgoingWebMessage;

import java.util.List;

public class ArticleDataComposer extends OutgoingWebMessage {
    public ArticleDataComposer(Article article, List<Comments> comments) {
        super("newdata");

        this.data.add("new" , new JsonPrimitive(JsonFactory.getInstance().toJson(article)));
        this.data.add("comments", new JsonPrimitive(JsonFactory.getInstance().toJson(comments)));

    }
}
