package server.data.classes.account;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.HabboGender;
import com.eu.habbo.habbohotel.users.HabboInfo;
import com.eu.habbo.habbohotel.users.HabboManager;
import server.data.queries.AccountDao;

public class AccountInfo {
    public int id;
    public String username;
    public String motto;
    public String look;
    public HabboGender gender;
    private int diamonds;
    private int currency;

    public AccountInfo(int id){
        Account info = AccountDao.getAccountById(id);
        
        if (info != null) {
            this.id = info.getId();
            this.username = info.getUsername();
            this.motto = info.getMotto();
            this.look = info.getLook();
            this.gender = HabboGender.valueOf(info.gender.toUpperCase());

            //PURSE
            this.diamonds = info.getCurrencyAmount(5);
            this.currency = info.getCurrencyAmount(104);

        }
    }

    public int getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getLook() {
        return look;
    }

    public HabboGender getGender() {
        return gender;
    }

    public int getCurrency() {
        return currency;
    }

    public int getDiamonds() {
        return diamonds;
    }
}
