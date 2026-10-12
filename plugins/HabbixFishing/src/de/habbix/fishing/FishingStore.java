package de.habbix.fishing;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.economy.*;
import com.eu.habbo.habbohotel.users.*;
import com.eu.habbo.messages.outgoing.users.UserCreditsComposer;
import com.eu.habbo.messages.outgoing.users.UserCurrencyComposer;
import com.google.gson.Gson;
import java.sql.*;
import java.util.*;

/** Plugin-owned tables. Wallet and inventory changes commit in the same transaction. */
public final class FishingStore {
    static final Gson JSON=new Gson();
    public record Player(int xp,int rod,double durability,long passUntil,boolean broadcast,int caught,int missed) {}
    public record Catch(long id,String species,int grams,long caughtAt) {}
    public record Bag(Player player,List<Catch> catches) {}
    public record Exchange(String message,int credits,Integer creditBalance,Integer diamondBalance) {}
    public interface Connections{Connection open()throws SQLException;}
    private final Connections connections;
    public FishingStore(){this(()->Emulator.getDatabase().getDataSource().getConnection());}
    public FishingStore(Connections connections){this.connections=connections;}
    private Connection open() throws SQLException {return connections.open();}
    public void migrate() throws SQLException {
        try(Connection c=open();Statement s=c.createStatement()){
            s.executeUpdate("CREATE TABLE IF NOT EXISTS habbix_fishing_settings (id INT NOT NULL PRIMARY KEY, version INT NOT NULL DEFAULT 1, config_json TEXT NOT NULL) ENGINE=InnoDB");
            s.executeUpdate("CREATE TABLE IF NOT EXISTS habbix_fishing_players (user_id INT NOT NULL PRIMARY KEY,xp INT NOT NULL DEFAULT 0,rod INT NOT NULL DEFAULT 0,durability DECIMAL(7,2) NOT NULL DEFAULT 100,pass_until BIGINT NOT NULL DEFAULT 0,broadcast TINYINT NOT NULL DEFAULT 1,caught INT NOT NULL DEFAULT 0,missed INT NOT NULL DEFAULT 0) ENGINE=InnoDB");
            s.executeUpdate("CREATE TABLE IF NOT EXISTS habbix_fishing_rolls (event_key VARCHAR(96) NOT NULL PRIMARY KEY,user_id INT NOT NULL,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB");
            s.executeUpdate("CREATE TABLE IF NOT EXISTS habbix_fishing_catches (id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,user_id INT NOT NULL,species VARCHAR(32) NOT NULL,grams INT NOT NULL,caught_at BIGINT NOT NULL,event_key VARCHAR(96) NOT NULL UNIQUE,sold_at BIGINT NULL,sale_key VARCHAR(96) NULL,INDEX bag(user_id,sold_at,id)) ENGINE=InnoDB");
            s.executeUpdate("CREATE TABLE IF NOT EXISTS habbix_fishing_audit (id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,user_id INT NOT NULL,action VARCHAR(32) NOT NULL,details TEXT NOT NULL,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,INDEX player(user_id,id)) ENGINE=InnoDB");
            try(PreparedStatement q=c.prepareStatement("INSERT IGNORE INTO habbix_fishing_settings(id,config_json) VALUES(1,?)")){q.setString(1,JSON.toJson(new FishingConfig()));q.executeUpdate();}
        }
    }
    public FishingConfig config() throws SQLException {try(Connection c=open();PreparedStatement q=c.prepareStatement("SELECT config_json FROM habbix_fishing_settings WHERE id=1");ResultSet r=q.executeQuery()){if(!r.next())throw new SQLException("Fishing settings missing");FishingConfig value=JSON.fromJson(r.getString(1),FishingConfig.class);value.validate();return value;}}
    public void config(FishingConfig config,int actor) throws SQLException {config.validate();try(Connection c=open()){c.setAutoCommit(false);try(PreparedStatement q=c.prepareStatement("UPDATE habbix_fishing_settings SET config_json=? WHERE id=1")){q.setString(1,JSON.toJson(config));q.executeUpdate();audit(c,actor,"setup",JSON.toJson(config));c.commit();}catch(Exception e){c.rollback();throw e;}}}
    private void ensure(Connection c,int user) throws SQLException {try(PreparedStatement q=c.prepareStatement("INSERT IGNORE INTO habbix_fishing_players(user_id) VALUES(?)")){q.setInt(1,user);q.executeUpdate();}}
    private Player player(Connection c,int user,boolean lock) throws SQLException {ensure(c,user);try(PreparedStatement q=c.prepareStatement("SELECT * FROM habbix_fishing_players WHERE user_id=?"+(lock?" FOR UPDATE":""))){q.setInt(1,user);try(ResultSet r=q.executeQuery()){r.next();return new Player(r.getInt("xp"),r.getInt("rod"),r.getDouble("durability"),r.getLong("pass_until"),r.getBoolean("broadcast"),r.getInt("caught"),r.getInt("missed"));}}}
    private List<Catch> bag(Connection c,int user,boolean lock) throws SQLException {try(PreparedStatement q=c.prepareStatement("SELECT id,species,grams,caught_at FROM habbix_fishing_catches WHERE user_id=? AND sold_at IS NULL ORDER BY id LIMIT 201"+(lock?" FOR UPDATE":""))){q.setInt(1,user);try(ResultSet r=q.executeQuery()){List<Catch> list=new ArrayList<>();while(r.next())list.add(new Catch(r.getLong(1),r.getString(2),r.getInt(3),r.getLong(4)));return list;}}}
    public Bag snapshot(int user) throws SQLException {try(Connection c=open()){return new Bag(player(c,user,false),bag(c,user,false));}}
    public void broadcast(int user,boolean value) throws SQLException {try(Connection c=open()){ensure(c,user);try(PreparedStatement q=c.prepareStatement("UPDATE habbix_fishing_players SET broadcast=? WHERE user_id=?")){q.setBoolean(1,value);q.setInt(2,user);q.executeUpdate();}}}
    public boolean settle(int user,FishingRules.Species fish,int grams,String eventKey,FishingConfig config) throws SQLException {
        try(Connection c=open()){c.setAutoCommit(false);try{
            Player p=player(c,user,true);if(p.durability<=0||bag(c,user,true).size()>=200){c.rollback();return false;}
            try(PreparedStatement q=c.prepareStatement("INSERT IGNORE INTO habbix_fishing_rolls(event_key,user_id) VALUES(?,?)")){q.setString(1,eventKey);q.setInt(2,user);if(q.executeUpdate()!=1){c.rollback();return false;}}
            if(fish!=null)try(PreparedStatement q=c.prepareStatement("INSERT INTO habbix_fishing_catches(user_id,species,grams,caught_at,event_key) VALUES(?,?,?,?,?)")){q.setInt(1,user);q.setString(2,fish.key());q.setInt(3,grams);q.setLong(4,System.currentTimeMillis());q.setString(5,eventKey);q.executeUpdate();}
            double wear=fish!=null?config.wearCatch:p.rod<=0?config.wearBaseMiss:config.wearMiss;
            try(PreparedStatement q=c.prepareStatement("UPDATE habbix_fishing_players SET xp=LEAST(2000000000,xp+?),durability=GREATEST(0,durability-?),caught=caught+?,missed=missed+? WHERE user_id=?")){q.setInt(1,fish==null?0:config.xpPerCatch);q.setDouble(2,wear);q.setInt(3,fish==null?0:1);q.setInt(4,fish==null?1:0);q.setInt(5,user);q.executeUpdate();}
            audit(c,user,fish==null?"miss":"catch",eventKey+":"+(fish==null?"escaped":fish.key()));c.commit();return true;
        }catch(Exception e){c.rollback();throw e;}}
    }
    public Exchange exchange(Habbo habbo,FishingConfig config,String action,String selection) throws Exception {
        return LedgerWalletMutation.coordinated(habbo,()->{
            Exchange result=transact(habbo.getHabboInfo().getId(),config,action,selection);
            if(result.creditBalance()!=null)LedgerWalletMutation.applyCommitted(habbo,-1,result.creditBalance());
            if(result.diamondBalance()!=null)LedgerWalletMutation.applyCommitted(habbo,5,result.diamondBalance());
            habbo.getClient().sendResponse(new UserCreditsComposer(habbo));habbo.getClient().sendResponse(new UserCurrencyComposer(habbo));return result;
        });
    }
    public Exchange transact(int user,FishingConfig config,String action,String selection)throws Exception{
            int delta=0;Integer creditBalance=null,diamondBalance=null;String message;String operation="fishing:"+UUID.randomUUID();
            try(Connection c=open()){c.setAutoCommit(false);try{
                // Keep wallet lock order consistent with other Polaris economy operations.
                try(PreparedStatement q=c.prepareStatement("SELECT credits FROM users WHERE id=? FOR UPDATE")){q.setInt(1,user);try(ResultSet r=q.executeQuery()){if(!r.next())throw new SQLException("Player missing");}}
                Player p=player(c,user,true);
                switch(action){
                    case "sell" -> {
                        List<Catch> all=bag(c,user,true);List<Catch> sold=new ArrayList<>();long sum=0;int diamonds=0;
                        for(Catch item:all)if(selection.equals("alle")||selection.equals(Long.toString(item.id))||selection.equals(item.species)){sold.add(item);sum+=config.price(item.species);diamonds+=config.fish(item.species).diamonds;}
                        if(sold.isEmpty())throw new IllegalArgumentException("Keine passenden Fänge in deiner Tasche.");
                        delta=Math.toIntExact(sum);if(delta<=0&&diamonds<=0)throw new IllegalArgumentException("Diese Fänge haben aktuell keinen Verkaufspreis.");
                        if(diamonds>0){EconomyMutationResult d=EconomyLedger.apply(c,new EconomyOperation(operation+":diamonds",user,user,"fishing_sell","habbix.fishing.sell",5,diamonds,null,selection));diamondBalance=d.balanceAfter();}
                        try(PreparedStatement q=c.prepareStatement("UPDATE habbix_fishing_catches SET sold_at=?,sale_key=? WHERE id=? AND user_id=? AND sold_at IS NULL")){for(Catch item:sold){q.setLong(1,System.currentTimeMillis());q.setString(2,operation);q.setLong(3,item.id);q.setInt(4,user);if(q.executeUpdate()!=1)throw new SQLException("Catch already sold");}}
                        try(PreparedStatement q=c.prepareStatement("UPDATE habbix_fishing_players SET xp=LEAST(2000000000,xp+?) WHERE user_id=?")){q.setInt(1,sold.size()*config.xpPerSale);q.setInt(2,user);q.executeUpdate();}
                        message=sold.size()+" Fänge für "+delta+" Taler und "+diamonds+" Diamanten verkauft. +"+(sold.size()*config.xpPerSale)+" EP.";
                    }
                    case "repair" -> {if(p.durability>=100)throw new IllegalArgumentException("Deine Rute ist bereits in Ordnung.");delta=-config.repairCost(p.rod,p.durability);try(PreparedStatement q=c.prepareStatement("UPDATE habbix_fishing_players SET durability=100 WHERE user_id=?")){q.setInt(1,user);q.executeUpdate();}message="Rute repariert: "+(-delta)+" Taler.";}
                    case "upgrade" -> {if(p.rod>=config.maxRod)throw new IllegalArgumentException("Du hast bereits die beste Rute.");var next=FishingRules.rod(p.rod+1);if(p.xp<(p.rod+1)*config.upgradeXp)throw new IllegalArgumentException("Du hast nicht genug Erfahrungspunkte! Benötigt: "+((p.rod+1)*config.upgradeXp)+" EP (aktuell: "+p.xp+" EP).");delta=-next.price();if(next.level()>=2){EconomyMutationResult d=EconomyLedger.apply(c,new EconomyOperation(operation+":diamonds",user,user,"fishing_upgrade","habbix.fishing.upgrade",5,-(next.level()-1)*5,null,selection));diamondBalance=d.balanceAfter();}try(PreparedStatement q=c.prepareStatement("UPDATE habbix_fishing_players SET rod=?,durability=100 WHERE user_id=?")){q.setInt(1,next.level());q.setInt(2,user);q.executeUpdate();}message=next.name()+" freigeschaltet.";}
                    case "pass" -> {int hours=FishingRules.bounded(selection,1,6);if(hours!=1&&hours!=3&&hours!=6)throw new IllegalArgumentException("Pässe: 1, 3 oder 6 Stunden.");delta=-config.passPrice(hours);long until=Math.max(System.currentTimeMillis(),p.passUntil)+hours*3600000L;if(until>System.currentTimeMillis()+7*86400000L)throw new IllegalArgumentException("Maximal sieben Tage Passzeit im Voraus.");try(PreparedStatement q=c.prepareStatement("UPDATE habbix_fishing_players SET pass_until=? WHERE user_id=?")){q.setLong(1,until);q.setInt(2,user);q.executeUpdate();}message=hours+" Stunden Angelpass hinzugefügt.";}
                    default -> throw new IllegalArgumentException("Unbekannte Händleraktion.");
                }
                EconomyMutationResult result=delta==0?null:EconomyLedger.apply(c,new EconomyOperation(operation,user,user,"fishing_"+action,"habbix.fishing."+action,-1,delta,null,selection));
                audit(c,user,action,operation+":"+delta+":"+selection);c.commit();if(result!=null)creditBalance=result.balanceAfter();
            }catch(Exception e){c.rollback();if(e instanceof IllegalArgumentException&&"economy mutation would produce an invalid balance".equals(e.getMessage()))throw new IllegalArgumentException("Nicht genügend Guthaben oder das Guthabenlimit ist erreicht.");throw e;}}
            return new Exchange(message,delta,creditBalance,diamondBalance);
    }
    private void audit(Connection c,int user,String action,String details) throws SQLException {try(PreparedStatement q=c.prepareStatement("INSERT INTO habbix_fishing_audit(user_id,action,details) VALUES(?,?,?)")){q.setInt(1,user);q.setString(2,action);q.setString(3,details);q.executeUpdate();}}
}
