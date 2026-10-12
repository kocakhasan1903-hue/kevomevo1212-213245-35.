package server.websocket;

import server.data.classes.article.ArticleManager;
import server.data.classes.community.CommunityManager;
import server.data.classes.cooldown.CooldownManager;
import server.data.classes.profile.ProfileManager;
import server.data.classes.tweet.TweetManager;
import server.utils.Config;

public class Website {

    public Config configManager;
    public ArticleManager articleManager;
    public CommunityManager communityManager;
    public TweetManager tweetManager;
    public CooldownManager cooldownManager;
    public ProfileManager profileManager;
    boolean start = false;

    public void load(){
        this.configManager = new Config();
        this.articleManager = new ArticleManager();
        this.communityManager = new CommunityManager();
        this.tweetManager = new TweetManager();
        this.cooldownManager = new CooldownManager();
        this.profileManager = new ProfileManager();
        this.start = true;
    }

    public void dispose(){
        this.articleManager.dispose();
        this.communityManager.dispose();
    }

    public Config getConfigManager() {
        return configManager;
    }

    public ArticleManager getArticleManager() {
        return articleManager;
    }

    public CommunityManager getCommunityManager() {
        return communityManager;
    }

    public TweetManager getTweetManager() {
        return tweetManager;
    }

    public CooldownManager getCooldownManager() {
        return cooldownManager;
    }

    public ProfileManager getProfileManager() {
        return profileManager;
    }

    public boolean isStart() {
        return start;
    }
}
