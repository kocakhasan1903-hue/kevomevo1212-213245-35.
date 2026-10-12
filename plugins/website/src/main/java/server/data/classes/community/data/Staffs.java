package server.data.classes.community.data;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.permissions.Rank;
import server.data.classes.account.AccountInfo;

import java.sql.ResultSet;
import java.sql.SQLException;

public class Staffs {
    private final AccountInfo account;
    private final int rankId;
    private final String rankName;

    public Staffs(ResultSet set) throws SQLException {
        this.account = new AccountInfo(set.getInt("id"));
        Rank r =  Emulator.getGameEnvironment().getPermissionsManager().getRank(set.getInt("rank"));

        this.rankId = r.getId();
        this.rankName = r.getName();
    }

    public AccountInfo getAccount() {
        return account;
    }

    public int getRankId() {
        return rankId;
    }

    public String getRankName() {
        return rankName;
    }
}
