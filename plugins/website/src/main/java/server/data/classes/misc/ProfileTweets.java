package server.data.classes.misc;

public class ProfileTweets {
    public int id;
    public String tweetText;
    public int date;

    public ProfileTweets(int id, String tweetText, int date){
        this.id = id;
        this.tweetText = tweetText;
        this.date = date;
    }
}
