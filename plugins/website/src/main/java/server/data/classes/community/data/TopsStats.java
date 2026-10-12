package server.data.classes.community.data;

import server.data.classes.account.AccountInfo;
import server.data.classes.misc.StatsType;

public class TopsStats {
    private AccountInfo account;
    private StatsType type;
    private int stats;

    public TopsStats(AccountInfo account, StatsType type, int stats){
          this.account = account;
          this.type = type;
          this.stats = stats;
    }

    public AccountInfo getAccount() {
        return account;
    }

    public StatsType getStatsType() {
        return type;
    }

    public int getStats() {
        return stats;
    }
}
