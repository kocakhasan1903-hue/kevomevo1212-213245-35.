package server.data.classes.tweet;

import server.Main;
import server.data.classes.account.Account;
import server.data.classes.article.Article;
import server.data.classes.misc.ProfileTweets;
import server.data.queries.TweetDao;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

public class TweetManager {
    long millis = System.currentTimeMillis();
    List<Tweet> tweets = new ArrayList<>();


    public TweetManager(){
        this.load();
    }

    public void load(){
        this.tweets.clear();

        this.tweets = TweetDao.loadTweets();
        Main.getLogger().info("Tweets loaded! (" + (System.currentTimeMillis() - millis) + " MS)");
    }

    public Tweet getTweet(int tweetId, int userId){
        Tweet tweet = this.tweets.stream()
                .filter(data -> tweetId == data.getId() && userId == data.getUserId())
                .findFirst()
                .orElse(null);

        return  tweet;
    }

    public List<ProfileTweets> getTweetsByAccount(int accountId){
        List<ProfileTweets> tweetsUser = new ArrayList<>();
        int limit = 30;

        for (Tweet tweet : this.getAllTweets()){
            if (tweet.getUserId() == accountId){
                if (tweetsUser.size() <= limit){
                    tweetsUser.add(new ProfileTweets(tweet.getId(), tweet.getTweetText(), tweet.getDate()));
                }
            }
        }

        return tweetsUser;
    }

    public ArrayList<Tweet> getTweets(){
        return new ArrayList<>(this.tweets.subList(0, (this.tweets.size() < 30 ? this.tweets.size() : 30)));
    }

    public List<Tweet> getAllTweets(){
        return this.tweets;
    }

    public void createTweet(Account account, String tweetTxt){
        if (account != null){
            this.tweets.add(TweetDao.createTweet(account.getId(), tweetTxt));
            this.tweets.sort(Tweet.SORT_ID);
        }
    }

    public boolean deleteMyTweet(int tweetId, int userId) {
        Tweet tweetDelete = getTweet(tweetId, userId);

        if (tweetDelete != null) return this.tweets.remove(tweetDelete);
        else return false;
    }

}
