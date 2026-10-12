package server.data.classes.community.data;

public class TopsCurrency {
    public String username;
    public String look;

    public int currencyType;
    public int amount;

    public TopsCurrency(String username, String look, int currencyType, int amount ){
        this.username = username;
        this.look = look;
        this.currencyType = currencyType;
        this.amount = amount;
    }
}
