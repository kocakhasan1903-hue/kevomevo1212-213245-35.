package de.habbix.fishing;
import java.sql.*;
import java.util.*;
import java.nio.file.*;
import java.util.concurrent.*;

/** Runs against a newly created disposable schema, never production player data. */
public final class FishingIntegrationTest {
 static int checks;static void check(boolean test,String name){if(!test)throw new AssertionError(name);checks++;}
 interface Checked{void run()throws Exception;}static void denied(Checked r,String name)throws Exception{try{r.run();throw new AssertionError("Accepted: "+name);}catch(IllegalArgumentException expected){checks++;}}
 static void sql(FishingStore.Connections db,String statement)throws Exception{try(var c=db.open();var s=c.createStatement()){s.executeUpdate(statement);}}
 static long number(FishingStore.Connections db,String query)throws Exception{try(var c=db.open();var s=c.createStatement();var r=s.executeQuery(query)){r.next();return r.getLong(1);}}
 public static void main(String[] args)throws Exception{
  FishingConfig c=new FishingConfig();c.validate();check(!c.enabled&&c.roomId==0,"initially disabled");
  check(FishingRules.inReach(3,4,5,6,2),"diagonal reachable");check(!FishingRules.inReach(3,4,6,6,2),"too far rejected");check(!FishingRules.inReach(Integer.MIN_VALUE,0,Integer.MAX_VALUE,0,2),"distance overflow rejected");
  c.staffRank=6;denied(c::validate,"rank below 7");c.staffRank=7;c.enabled=true;denied(c::validate,"enable without water");c.enabled=false;
  c.catchChance=1;c.junkChance=0;Random random=new Random(42);for(int i=0;i<1000;i++)check(!FishingRules.roll(random,0,c).junk(),"fish pool");c.junkChance=1;for(int i=0;i<100;i++)check(FishingRules.roll(random,0,c).junk(),"trash pool");c.catchChance=0;for(int i=0;i<100;i++)check(FishingRules.roll(random,0,c)==null,"zero chance");
  c=new FishingConfig();c.fish("barsch").enabled=false;c.catchChance=1;c.junkChance=0;for(int i=0;i<100;i++)check(!FishingRules.roll(random,0,c).key().equals("barsch"),"disabled fish excluded");
  var fish=c.fish("barsch");fish.iconUrl="javascript:alert(1)";denied(fish::validate,"unsafe icon");fish.iconUrl="/assets/fishing/barsch.svg";fish.enabled=true;c.catchChance=.35;c.junkChance=.25;
  Properties p=new Properties();try(var reader=Files.newBufferedReader(Path.of(args[0]))){p.load(reader);}Class.forName("org.mariadb.jdbc.Driver");
  String host=p.getProperty("db.hostname","127.0.0.1"),port=p.getProperty("db.port","3306"),user=p.getProperty("db.username"),password=p.getProperty("db.password","");
  String url="jdbc:mariadb://"+host+":"+port+"/",schema=p.getProperty("db.test_schema","habbix_fishing_test_"+System.currentTimeMillis());
  if(!schema.matches("habbix_fishing_test_[0-9]+"))throw new IllegalArgumentException("Unsafe test schema");
  try(Connection control=DriverManager.getConnection(url,user,password);Statement statement=control.createStatement()){
   statement.executeUpdate("CREATE DATABASE `"+schema+"`");
   try{
    FishingStore.Connections db=()->DriverManager.getConnection(url+schema,user,password);FishingStore store=new FishingStore(db);store.migrate();store.migrate();check(store.config().roomId==0,"migration repeat");
    sql(db,"CREATE TABLE users(id INT PRIMARY KEY,credits INT NOT NULL) ENGINE=InnoDB");sql(db,"CREATE TABLE users_currency(user_id INT,type INT,amount INT,PRIMARY KEY(user_id,type)) ENGINE=InnoDB");sql(db,"CREATE TABLE logs_economy(operation_id VARCHAR(96) PRIMARY KEY,user_id INT,actor_id INT,operation VARCHAR(64),reason VARCHAR(96),currency_type INT,amount INT,balance_before INT,balance_after INT,item_id INT NULL,context VARCHAR(255)) ENGINE=InnoDB");sql(db,"INSERT INTO users VALUES(1,10000),(2,0)");
    var species=c.fish("barsch").species(c.xpPerCatch);check(store.settle(1,species,500,"catch-1",c),"catch committed");check(!store.settle(1,species,500,"catch-1",c),"duplicate catch blocked");check(store.snapshot(1).catches().size()==1,"catch persisted");check(store.settle(1,null,0,"miss-1",c),"miss committed");check(!store.settle(1,null,0,"miss-1",c),"duplicate miss blocked");check(store.snapshot(1).player().durability()==97,"durability exact");
    store.transact(1,c,"sell","alle");check(number(db,"SELECT credits FROM users WHERE id=1")==10150,"sale credited");check(store.snapshot(1).catches().isEmpty(),"sale removed catch");check(store.snapshot(1).player().xp()==c.xpPerCatch+c.xpPerSale,"sale XP committed once");final FishingConfig config=c;denied(()->store.transact(1,config,"sell","alle"),"second sale");
    store.snapshot(2);denied(()->store.transact(2,config,"pass","1"),"insufficient pass credits");check(store.snapshot(2).player().passUntil()==0,"pass rollback");sql(db,"UPDATE habbix_fishing_players SET durability=50 WHERE user_id=2");denied(()->store.transact(2,config,"repair","alle"),"insufficient repair credits");check(store.snapshot(2).player().durability()==50,"repair rollback");
    sql(db,"UPDATE habbix_fishing_players SET xp=1000 WHERE user_id=1");store.transact(1,c,"upgrade","alle");check(store.snapshot(1).player().rod()==1,"upgrade committed");long credits=number(db,"SELECT credits FROM users WHERE id=1");denied(()->store.transact(1,config,"upgrade","alle"),"insufficient diamonds");check(store.snapshot(1).player().rod()==1&&number(db,"SELECT credits FROM users WHERE id=1")==credits,"upgrade rollback");sql(db,"INSERT INTO users_currency VALUES(1,5,20)");store.transact(1,c,"upgrade","alle");check(store.snapshot(1).player().rod()==2,"diamond upgrade");check(number(db,"SELECT amount FROM users_currency WHERE user_id=1 AND type=5")==15,"diamond debit");
    var valuable=c.fish("lachs").species(c.xpPerCatch);store.settle(1,valuable,700,"catch-2",c);store.transact(1,c,"sell","alle");check(number(db,"SELECT amount FROM users_currency WHERE user_id=1 AND type=5")==16,"diamond sale");
    store.settle(1,species,500,"catch-race",c);int beforeXp=store.snapshot(1).player().xp();long before=number(db,"SELECT credits FROM users WHERE id=1");ExecutorService threads=Executors.newFixedThreadPool(2);CountDownLatch ready=new CountDownLatch(1);List<Future<Boolean>> jobs=new ArrayList<>();for(int i=0;i<2;i++)jobs.add(threads.submit(()->{ready.await();try{store.transact(1,config,"sell","alle");return true;}catch(IllegalArgumentException expected){return false;}}));ready.countDown();int success=0;for(var job:jobs)if(job.get(10,TimeUnit.SECONDS))success++;threads.shutdownNow();check(success==1,"concurrent sale once");check(number(db,"SELECT credits FROM users WHERE id=1")==before+150,"concurrent credit once");check(store.snapshot(1).player().xp()==beforeXp+c.xpPerSale,"concurrent sale XP once");
    c.pass1=0;store.transact(1,c,"pass","1");check(store.snapshot(1).player().passUntil()>System.currentTimeMillis(),"free pass supported");store.config(c,1);check(new FishingStore(db).config().pass1==0,"configuration survives new store");
    sql(db,"UPDATE habbix_fishing_players SET durability=0 WHERE user_id=2");check(!store.settle(2,species,500,"broken-rod",c),"broken rod blocked");check(number(db,"SELECT COUNT(*) FROM habbix_fishing_rolls WHERE event_key='broken-rod'")==0,"invalid roll not stored");
    System.out.println("FISHING_INTEGRATION_PASS checks="+checks+" isolated_schema=true");
   }finally{if(!schema.matches("habbix_fishing_test_[0-9]+"))throw new AssertionError("Schema cleanup guard");statement.executeUpdate("DROP DATABASE `"+schema+"`");}
  }
 }
}
