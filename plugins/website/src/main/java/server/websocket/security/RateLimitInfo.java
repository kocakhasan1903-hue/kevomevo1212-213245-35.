package server.websocket.security;

public class RateLimitInfo {
    public String ip;
    public int date;

    public RateLimitInfo(String ip, int date){
        this.ip = ip;
        this.date = date;
    }

    public String getIp() {
        return ip;
    }

    public int getDate() {
        return date;
    }
}
