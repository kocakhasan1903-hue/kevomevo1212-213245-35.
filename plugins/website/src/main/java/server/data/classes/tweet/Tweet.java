package server.data.classes.tweet;

import server.data.classes.account.Account;
import server.data.classes.account.AccountInfo;
import server.data.queries.AccountDao;
import server.data.queries.TweetDao;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public class Tweet implements Comparable<Tweet>{
    private final int id;
    private final int userId;
    private final String username;
    private final String look;
    private final String tweetText;
    private List<TweetReaction> reactions = new ArrayList<>();
    private final int reactionSlime;
    private final int reactionLike;
    private final int reactionHeart;
    private final int reactionBobba;
    private final int reactionPoop;
    private final int date;

    public static final Comparator SORT_ID = (o1, o2) -> {
        return o1 instanceof Tweet && o2 instanceof Tweet ? ((Tweet)o2).getId() - ((Tweet)o1).getId() : 0;
    };

    public  Tweet(ResultSet set) throws SQLException {
        this.id = set.getInt("id");

        Account account = AccountDao.getAccountById(set.getInt("user_id"));
        this.userId = set.getInt("user_id");
        this.username = account.getUsername();
        this.look = account.getLook();

        this.tweetText = set.getString("tweet_text");
        this.date = set.getInt("date");

        //load Reactions
        this.reactions = TweetDao.loadReactionsTweet(this.id);

        this.reactionLike = getReactions(ReactionType.LIKE);
        this.reactionSlime = getReactions(ReactionType.SLIME);
        this.reactionHeart = getReactions(ReactionType.HEART);
        this.reactionBobba = getReactions(ReactionType.BOBBA);
        this.reactionPoop = getReactions(ReactionType.POOP);

    }

    public  Tweet(ResultSet set, String username, String look) throws SQLException {
        this.id = set.getInt("id");

        this.userId = set.getInt("user_id");
        this.username = username;
        this.look = look;

        this.tweetText = set.getString("tweet_text");
        this.date = set.getInt("date");

        //load Reactions
        this.reactions = TweetDao.loadReactionsTweet(this.id);

        this.reactionLike = getReactions(ReactionType.LIKE);
        this.reactionSlime = getReactions(ReactionType.SLIME);
        this.reactionHeart = getReactions(ReactionType.HEART);
        this.reactionBobba = getReactions(ReactionType.BOBBA);
        this.reactionPoop = getReactions(ReactionType.POOP);

    }

    public int getId() {
        return id;
    }

    public int getUserId() {
        return userId;
    }

    public String getUsername() {
        return username;
    }

    public String getLook() {
        return look;
    }

    public String getTweetText() {
        return tweetText;
    }

    public int getDate() {
        return date;
    }

    public List<TweetReaction> getReactions() {
        return reactions;
    }

    public int getReactionSlime() {
        return reactionSlime;
    }

    public int getReactionLike() {
        return reactionLike;
    }

    public int getReactionHeart() {
        return reactionHeart;
    }

    public int getReactionBobba() {
        return reactionBobba;
    }

    public int getReactionPoop() {
        return reactionPoop;
    }

    public int getReactions(ReactionType type){
        int reactions = 0;
        for (TweetReaction reaction : this.reactions){
            if (reaction.getReaction().equals(type)){
                reactions++;
            }
        }
        return reactions;
    }

    public boolean addReaction(Account account, ReactionType type){
        if (!reactionExist(account, type, true)){
            //Add
            TweetReaction reaction = TweetDao.createReaction(account.getId(), this.id, type);
            if (reaction != null){
                System.out.println("nuevo");
                this.reactions.add(reaction);
            }
        }
        return true;
    }

    public boolean reactionExist(Account account, ReactionType type, boolean remove){
        for (TweetReaction reaction : this.reactions){
            if (reaction.getUserId() == account.getId() && reaction.getTweetId() == this.id && !reaction.getReaction().getType().equalsIgnoreCase(type.getType())){
                if (remove){
                    TweetDao.deleteReaction(reaction.getId());
                    this.reactions.remove(reaction);
                }
                return true;
            }
            return false;
        }
        return false;
    }

    @Override
    public int compareTo(Tweet o) {
        return 0;
    }
}
