package server.data.classes.article;

import server.Main;
import server.data.queries.ArticleDao;


import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ArticleManager {

    long millis = System.currentTimeMillis();
    protected List<Article> articles = new ArrayList<>();

    protected Map<Integer, String> category = new HashMap<>();

    public ArticleManager(){
        this.reload();
    }

    public void reload(){
        this.category.clear();
        this.articles.clear();


        this.category = ArticleDao.loadCategories();
        this.articles = ArticleDao.loadArticles();
        Main.getLogger().info("Articles loaded! (" + (System.currentTimeMillis() - millis) + " MS)");
    }

    public synchronized void dispose() {
        Main.getLogger().info("Article Manager -> Disposed!");
    }

    public Article getArticle(int id){
        Article article = this.articles.stream()
                .filter(data -> id == data.getId())
                .findAny()
                .orElse(null);

        return  article;
    }

    public List<Article> getArticles() {
        return articles;
    }

    public List<Article> lastArticles(){
        /*List<Article> news = new ArrayList<>();

        for(int i = 0; i < 5; i++){
            news.add(this.articles.get(i));
        }
        return news*/

        return new ArrayList<>(this.articles.subList(0, (Math.min(this.articles.size(), 5))));
    }

    public String getCategory(int id) {
        return category.getOrDefault(id, "Sin categoria");
    }
}
