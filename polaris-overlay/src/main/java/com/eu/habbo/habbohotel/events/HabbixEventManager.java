package com.eu.habbo.habbohotel.events;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.economy.EconomyLedger;
import com.eu.habbo.habbohotel.economy.EconomyOperation;
import com.google.gson.*;
import java.sql.*;
import java.text.Normalizer;
import java.util.*;
import java.util.function.LongSupplier;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Polaris-owned event engine. The web UI is an optional adapter, never the source of rewards. */
public final class HabbixEventManager implements Runnable {
    private static final Logger LOGGER = LoggerFactory.getLogger(HabbixEventManager.class);
    private static volatile HabbixEventManager instance;
    private final DataSource source;
    private final Runtime runtime;
    private final LongSupplier clock;
    private final Random random;
    private volatile boolean disposed;
    private int privateNoticeCursor;

    public interface Runtime {
        int room(int user);
        boolean canTalk(int user);
        int minimumRank();
        default boolean rewardAllowed(int base) { return true; }
        int createItem(Connection db, int user, int base) throws Exception;
        <T> T coordinated(List<Integer> users, Work<T> work) throws Exception;
        void refresh(List<Integer> users, Map<Integer, List<Integer>> rewards) throws Exception;
        boolean announce(int user, int room, String text);
        default boolean announceEvent(int user, int room, String text, String kind) { return announce(user, room, text); }
    }
    @FunctionalInterface public interface Work<T> { T run() throws Exception; }

    public HabbixEventManager(DataSource source, Runtime runtime, LongSupplier clock, Random random) throws SQLException {
        this.source = source; this.runtime = runtime; this.clock = clock; this.random = random;
        initialize();
    }
    public static synchronized void start() {
        if (instance != null) return;
        try {
            instance = new HabbixEventManager(Emulator.getDatabase().getDataSource(), new PolarisEventRuntime(),
                    () -> System.currentTimeMillis() / 1000, new java.security.SecureRandom());
            Emulator.getThreading().run(instance, 1000);
        } catch (Exception exception) { LOGGER.error("Event engine could not start; existing hotel services remain available", exception); }
    }
    public static HabbixEventManager getInstance() {
        HabbixEventManager current = instance;
        if (current == null) throw new IllegalArgumentException("Der Eventmanager ist derzeit nicht verfügbar. Bitte den Emulatorlog prüfen.");
        return current;
    }
    public static synchronized void stop() { if (instance != null) instance.disposed = true; instance = null; }
    private void initialize() throws SQLException {
        try (Connection db = source.getConnection(); Statement s = db.createStatement()) {
            s.execute("CREATE TABLE IF NOT EXISTS polaris_events (id INT AUTO_INCREMENT PRIMARY KEY,kind VARCHAR(16) NOT NULL,title VARCHAR(120) NOT NULL,creator_id INT NOT NULL,request_key VARCHAR(80) NOT NULL,scope VARCHAR(8) NOT NULL,room_id INT NOT NULL DEFAULT 0,item_id INT NOT NULL DEFAULT 0,amount INT NOT NULL DEFAULT 1,currency VARCHAR(12) NOT NULL DEFAULT 'credits',reward_credits INT NOT NULL DEFAULT 0,reward_diamonds INT NOT NULL DEFAULT 0,start_price INT NOT NULL DEFAULT 1,highest_bid INT NOT NULL DEFAULT 0,highest_user INT NOT NULL DEFAULT 0,bid_version INT NOT NULL DEFAULT 0,winner_count INT NOT NULL DEFAULT 1,question VARCHAR(250) NOT NULL DEFAULT '',secret VARCHAR(100) NOT NULL DEFAULT '',starts_at BIGINT NOT NULL,ends_at BIGINT NOT NULL,status VARCHAR(12) NOT NULL DEFAULT 'active',UNIQUE KEY request_once(creator_id,request_key)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            s.execute("CREATE TABLE IF NOT EXISTS polaris_event_currency_rewards (event_id INT NOT NULL,type INT NOT NULL,amount INT NOT NULL,PRIMARY KEY(event_id,type)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            s.execute("CREATE TABLE IF NOT EXISTS polaris_event_entries (event_id INT NOT NULL,user_id INT NOT NULL,joined_at BIGINT NOT NULL,PRIMARY KEY(event_id,user_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            s.execute("CREATE TABLE IF NOT EXISTS polaris_event_results (event_id INT NOT NULL,user_id INT NOT NULL,won_at BIGINT NOT NULL,PRIMARY KEY(event_id,user_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            s.execute("CREATE TABLE IF NOT EXISTS polaris_event_notices (id INT AUTO_INCREMENT PRIMARY KEY,event_id INT NOT NULL,user_id INT NOT NULL DEFAULT 0,room_id INT NOT NULL DEFAULT 0,message VARCHAR(1000) NOT NULL,delivered INT NOT NULL DEFAULT 0) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            s.execute("CREATE TABLE IF NOT EXISTS polaris_event_word_collections (id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(80) NOT NULL,words TEXT NOT NULL,creator_id INT NOT NULL,updated_at BIGINT NOT NULL,interval_seconds INT NOT NULL DEFAULT 120,uniform_reward INT NOT NULL DEFAULT 1,reward_credits INT NOT NULL DEFAULT 50,reward_diamonds INT NOT NULL DEFAULT 0,rewards TEXT,auto_play INT NOT NULL DEFAULT 0,next_at BIGINT NOT NULL DEFAULT 0,auto_index INT NOT NULL DEFAULT 0,auto_run INT NOT NULL DEFAULT 0,current_event INT NOT NULL DEFAULT 0,scope VARCHAR(8) NOT NULL DEFAULT 'hotel',room_id INT NOT NULL DEFAULT 0) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        }
    }
    @Override public void run() {
        if (disposed) return;
        try { if (Emulator.isReady) tick(); } catch (Exception exception) { LOGGER.error("Event settlement failed; durable events will retry", exception); }
        if (!disposed) Emulator.getThreading().run(this, 1000);
    }
    public synchronized void tick() throws Exception {
        List<Integer> due = new ArrayList<>();
        try (Connection db = source.getConnection(); PreparedStatement p = db.prepareStatement("SELECT id FROM polaris_events WHERE status='active' AND ends_at<=? ORDER BY id")) {
            p.setLong(1, clock.getAsLong()); try (ResultSet rows = p.executeQuery()) { while (rows.next()) due.add(rows.getInt(1)); }
        }
        for (int id : due) try { settle(id, false, 0); } catch (Exception failure) { LOGGER.error("Event {} awaits settlement retry", id, failure); }
        tickCollections();
        deliverNotices();
    }
    public synchronized JsonObject request(int user, String action, JsonObject q) throws Exception {
        if (user <= 0) throw new IllegalArgumentException("Bitte anmelden.");
        String notice = "";
        switch (action) {
            case "eventState" -> { }
            case "eventCatalog" -> { JsonObject state = state(user); state.add("catalog", catalog(string(q,"search",""))); return state; }
            case "eventCreate" -> { create(user, q); notice = "Event gestartet. Der Emulator übernimmt Ablauf und Belohnung."; }
            case "eventBid" -> { bid(user, number(q,"id",0), number(q,"bid",0)); notice = "Gebot gespeichert. Dein Höchstgebot ist bis zum Ende reserviert."; }
            case "eventJoin" -> { join(user, number(q,"id",0)); notice = "Du nimmst am Giveaway teil."; }
            case "eventCancel" -> { requireManager(user); settle(number(q,"id",0), true, 0); notice = "Event beendet; reservierte Gebote wurden zurückgegeben."; }
            case "eventCollectionSave" -> { saveCollection(user,q); notice = "Wortsammlung gespeichert."; }
            case "eventCollectionDelete" -> { deleteCollection(user,number(q,"id",0)); notice = "Wortsammlung gelöscht."; }
            case "eventCollectionStart" -> { startCollection(user,q); notice = "AutoPlay gestartet. Die gespeicherten Wörter laufen einmal automatisch durch."; }
            case "eventCollectionStop" -> { stopCollection(user,number(q,"id",0)); notice = "AutoPlay gestoppt."; }
            default -> throw new IllegalArgumentException("Unbekannte Event-Aktion.");
        }
        JsonObject result = state(user); result.addProperty("notice",notice); return result;
    }
    public boolean canManage(int user) throws SQLException {
        try (Connection db = source.getConnection(); PreparedStatement p = db.prepareStatement("SELECT rank FROM users WHERE id=?")) {
            p.setInt(1,user); try(ResultSet row=p.executeQuery()){return row.next() && row.getInt(1)>=Math.max(6,runtime.minimumRank());}
        }
    }
    private void requireManager(int user) throws SQLException { if (!canManage(user)) throw new IllegalArgumentException("Eventverwaltung ist für deinen Rang nicht freigeschaltet."); }
    private void requirePlayer(int user, Event event) {
        if (!runtime.canTalk(user)) throw new IllegalArgumentException("Bitte im Hotel einchecken. Gesperrte Konten können nicht teilnehmen.");
        if (event.scope.equals("room") && runtime.room(user)!=event.room) throw new IllegalArgumentException("Bitte zuerst den Eventraum betreten.");
    }
    public synchronized int create(int user, JsonObject q) throws Exception {
        requireManager(user);
        String kind = string(q,"kind",""); if (!Set.of("auction","giveaway","riddle").contains(kind)) throw new IllegalArgumentException("Ungültiger Eventtyp.");
        String scope = string(q,"scope","room"); if (!Set.of("hotel","room").contains(scope)) throw new IllegalArgumentException("Ungültiger Geltungsbereich.");
        int room = number(q,"roomId",runtime.room(user)), item = number(q,"itemId",0), amount = number(q,"amount",1);
        int seconds = q.has("durationSeconds") ? number(q,"durationSeconds",0) : Math.multiplyExact(number(q,"durationMinutes",5),60);
        if (seconds<30 || seconds>604800 || amount<1 || amount>100) throw new IllegalArgumentException("Laufzeit: 30 Sekunden bis 7 Tage; Möbelmenge: 1 bis 100.");
        int winners=number(q,"winners",1), price=number(q,"startPrice",1), credits=number(q,"rewardCredits",kind.equals("riddle")?50:0), diamonds=number(q,"rewardDiamonds",0);
        int stars=number(q,"rewardEventstars",0), flames=number(q,"rewardFlames",0);
        if(stars<0||stars>1000000||flames<0||flames>1000000)throw new IllegalArgumentException("Ungültige Belohnung.");
        if(winners<1||winners>20||price<1||price>1000000000||credits<0||credits>1000000||diamonds<0||diamonds>1000000) throw new IllegalArgumentException("Ungültige Gebote oder Belohnungen.");
        if(kind.equals("auction") && item<=0) throw new IllegalArgumentException("Bitte ein Katalogmöbel auswählen.");
        if(item<0 || (kind.equals("giveaway")&&item==0&&credits==0&&diamonds==0&&stars==0&&flames==0))throw new IllegalArgumentException("Bitte ein Katalogmöbel oder eine Belohnung auswählen.");
        if(kind.equals("auction")) { winners=1; credits=0; diamonds=0; }
        if(kind.equals("riddle")) { winners=1; if(item==0 && credits==0 && diamonds==0 && stars==0 && flames==0) throw new IllegalArgumentException("Bitte eine Belohnung festlegen."); }
        String currency=string(q,"currency","credits"); if(!Set.of("credits","diamonds","eventstars","flames").contains(currency))throw new IllegalArgumentException("Ungültige Währung.");
        String secret=kind.equals("riddle")?normalize(string(q,"answer","")):"";
        int collection=number(q,"collectionId",0);
        if(kind.equals("riddle") && collection>0) {
            try(Connection db=source.getConnection();PreparedStatement p=db.prepareStatement("SELECT words FROM polaris_event_word_collections WHERE id=?")){p.setInt(1,collection);try(ResultSet r=p.executeQuery()){
                if(!r.next())throw new IllegalArgumentException("Wortsammlung nicht gefunden.");
                JsonArray words=new JsonParser().parse(r.getString(1)).getAsJsonArray();if(words.isEmpty())throw new IllegalArgumentException("Wortsammlung ist leer.");
                secret=normalize(words.get(random.nextInt(words.size())).getAsString());
            }}
        }
        if(kind.equals("riddle") && (secret.length()<3||secret.length()>40||!secret.matches("[\\p{L}\\p{N} ]+")))throw new IllegalArgumentException("Lösungswort: 3 bis 40 Buchstaben/Ziffern.");
        String question=kind.equals("riddle")?"Sortiere die Buchstaben: "+scramble(secret):string(q,"question","").trim(); if(question.length()>250)throw new IllegalArgumentException("Die Frage ist zu lang.");
        String title=string(q,"title",kind.equals("riddle")?"Worträtsel":kind.equals("auction")?"Raumauktion":"Giveaway").trim();
        if(title.isEmpty()||title.length()>120||title.indexOf('\0')>=0)throw new IllegalArgumentException("Eventtitel: 1 bis 120 Zeichen.");
        String key=string(q,"requestId",UUID.randomUUID().toString()); if(key.isEmpty()||key.length()>80)throw new IllegalArgumentException("Ungültige Anfrage-ID.");
        try(Connection db=source.getConnection()){
            if(scope.equals("room") && !exists(db,"SELECT id FROM rooms WHERE id=?",room))throw new IllegalArgumentException("Eventraum nicht gefunden.");
            if(item>0 && !validCatalogItem(db,item))throw new IllegalArgumentException("Dieses Möbel ist kein normales, verfügbares Katalogmöbel.");
            db.setAutoCommit(false);
            try {
                try(PreparedStatement p=db.prepareStatement("SELECT id FROM polaris_events WHERE creator_id=? AND request_key=?")){p.setInt(1,user);p.setString(2,key);try(ResultSet r=p.executeQuery()){if(r.next()){db.rollback();return r.getInt(1);}}}
                try(PreparedStatement p=db.prepareStatement("SELECT id FROM polaris_events WHERE kind=? AND scope=? AND room_id=? AND status='active' AND ends_at>? FOR UPDATE")){p.setString(1,kind);p.setString(2,scope);p.setInt(3,scope.equals("room")?room:0);p.setLong(4,clock.getAsLong());try(ResultSet r=p.executeQuery()){if(r.next())throw new IllegalArgumentException("In diesem Bereich läuft bereits ein Event dieses Typs.");}}
                int id;
                try(PreparedStatement p=db.prepareStatement("INSERT INTO polaris_events(kind,title,creator_id,request_key,scope,room_id,item_id,amount,currency,reward_credits,reward_diamonds,start_price,winner_count,question,secret,starts_at,ends_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",Statement.RETURN_GENERATED_KEYS)){
                    int n=1;p.setString(n++,kind);p.setString(n++,title);p.setInt(n++,user);p.setString(n++,key);p.setString(n++,scope);p.setInt(n++,scope.equals("room")?room:0);p.setInt(n++,item);p.setInt(n++,amount);p.setString(n++,currency);p.setInt(n++,credits);p.setInt(n++,diamonds);p.setInt(n++,price);p.setInt(n++,winners);p.setString(n++,question);p.setString(n++,secret);p.setLong(n++,clock.getAsLong());p.setLong(n,clock.getAsLong()+seconds);p.executeUpdate();try(ResultSet keys=p.getGeneratedKeys()){if(!keys.next())throw new SQLException("Event ID missing");id=keys.getInt(1);}
                }
                if(!kind.equals("auction"))for(var reward:Map.of(104,stars,105,flames).entrySet())if(reward.getValue()>0)try(PreparedStatement p=db.prepareStatement("INSERT INTO polaris_event_currency_rewards(event_id,type,amount) VALUES(?,?,?)")){p.setInt(1,id);p.setInt(2,reward.getKey());p.setInt(3,reward.getValue());p.executeUpdate();}
                String message=title+" startet! "+(kind.equals("giveaway")?"Mit :giveaway teilnehmen.":kind.equals("riddle")?question+". Schreibe das Lösungswort in den Raumchat.":"Gebote im Eventmanager abgeben. Das Höchstgebot wird reserviert.");
                notice(db,id,0,scope.equals("room")?room:0,message);db.commit();deliverNotices();return id;
            }catch(Exception e){db.rollback();throw e;}
        }
    }
    private boolean exists(Connection db,String sql,int id)throws SQLException{try(PreparedStatement p=db.prepareStatement(sql)){p.setInt(1,id);try(ResultSet r=p.executeQuery()){return r.next();}}}
    private void saveCollection(int user,JsonObject q)throws Exception{
        requireManager(user);int id=number(q,"id",0);String name=string(q,"name","").trim();
        if(name.isEmpty()||name.length()>80||!q.has("words")||!q.get("words").isJsonArray())throw new IllegalArgumentException("Bitte einen Namen und eine Wortliste angeben.");
        Set<String> unique=new LinkedHashSet<>();JsonArray input=q.getAsJsonArray("words");if(input.size()>200)throw new IllegalArgumentException("Maximal 200 Wörter je Sammlung.");
        for(JsonElement word:input){String normalized=normalize(word.getAsString());if(normalized.length()<3||normalized.length()>40||!normalized.matches("[\\p{L}\\p{N} ]+"))throw new IllegalArgumentException("Wörter: 3 bis 40 Buchstaben/Ziffern.");unique.add(normalized);}
        if(unique.isEmpty())throw new IllegalArgumentException("Bitte mindestens ein Lösungswort eingeben.");JsonArray words=new JsonArray();unique.forEach(words::add);
        int interval=number(q,"intervalSeconds",120),credits=number(q,"rewardCredits",50),diamonds=number(q,"rewardDiamonds",0);
        int stars=number(q,"rewardEventstars",0),flames=number(q,"rewardFlames",0);
        if(stars<0||stars>1000000||flames<0||flames>1000000)throw new IllegalArgumentException("Ungültige Belohnung.");
        boolean uniform=!q.has("uniformReward")||q.get("uniformReward").getAsBoolean();
        if(interval<30||interval>86400||credits<0||credits>1000000||diamonds<0||diamonds>1000000)throw new IllegalArgumentException("Intervall: 30 bis 86.400 Sekunden; gültige Belohnungen eingeben.");
        JsonArray rewards=new JsonArray();Map<String,JsonObject> custom=new HashMap<>();
        if(q.has("rewards")&&q.get("rewards").isJsonArray())for(JsonElement raw:q.getAsJsonArray("rewards")){JsonObject reward=raw.getAsJsonObject();String word=normalize(string(reward,"word",""));int c=number(reward,"credits",0),d=number(reward,"diamonds",0),s=number(reward,"eventstars",0),f=number(reward,"flames",0);if(!unique.contains(word)||c<0||c>1000000||d<0||d>1000000||s<0||s>1000000||f<0||f>1000000||(c==0&&d==0&&s==0&&f==0))throw new IllegalArgumentException("Ungültige Belohnung für ein Sammlungswort.");JsonObject normalized=new JsonObject();normalized.addProperty("word",word);normalized.addProperty("credits",c);normalized.addProperty("diamonds",d);normalized.addProperty("eventstars",s);normalized.addProperty("flames",f);custom.put(word,normalized);}
        for(String word:unique){if(!uniform){if(!custom.containsKey(word))throw new IllegalArgumentException("Für jedes Wort eine Belohnung angeben.");rewards.add(custom.get(word));}else{JsonObject reward=new JsonObject();reward.addProperty("word",word);reward.addProperty("credits",credits);reward.addProperty("diamonds",diamonds);reward.addProperty("eventstars",stars);reward.addProperty("flames",flames);rewards.add(reward);}}
        if(uniform&&credits==0&&diamonds==0&&stars==0&&flames==0)throw new IllegalArgumentException("Bitte eine Belohnung festlegen.");
        try(Connection db=source.getConnection()){
            if(id>0)try(PreparedStatement p=db.prepareStatement("SELECT auto_play FROM polaris_event_word_collections WHERE id=?")){p.setInt(1,id);try(ResultSet r=p.executeQuery()){if(r.next()&&r.getInt(1)!=0)throw new IllegalArgumentException("AutoPlay vor dem Bearbeiten stoppen.");}}
            if(id<=0)try(Statement p=db.createStatement();ResultSet r=p.executeQuery("SELECT COUNT(*) FROM polaris_event_word_collections")){r.next();if(r.getInt(1)>=100)throw new IllegalArgumentException("Maximal 100 Wortsammlungen.");}
            String sql=id>0?"UPDATE polaris_event_word_collections SET name=?,words=?,creator_id=?,updated_at=?,interval_seconds=?,uniform_reward=?,reward_credits=?,reward_diamonds=?,rewards=? WHERE id=?":"INSERT INTO polaris_event_word_collections(name,words,creator_id,updated_at,interval_seconds,uniform_reward,reward_credits,reward_diamonds,rewards) VALUES(?,?,?,?,?,?,?,?,?)";
            try(PreparedStatement p=db.prepareStatement(sql)){p.setString(1,name);p.setString(2,words.toString());p.setInt(3,user);p.setLong(4,clock.getAsLong());p.setInt(5,interval);p.setInt(6,uniform?1:0);p.setInt(7,credits);p.setInt(8,diamonds);p.setString(9,rewards.toString());if(id>0)p.setInt(10,id);if(p.executeUpdate()==0)throw new IllegalArgumentException("Wortsammlung nicht gefunden oder unverändert.");}
        }
    }
    private void deleteCollection(int user,int id)throws Exception{
        requireManager(user);stopCollection(user,id);try(Connection db=source.getConnection();PreparedStatement p=db.prepareStatement("DELETE FROM polaris_event_word_collections WHERE id=?")){p.setInt(1,id);if(p.executeUpdate()!=1)throw new IllegalArgumentException("Wortsammlung nicht gefunden.");}
    }
    private void startCollection(int user,JsonObject q)throws Exception{
        requireManager(user);int id=number(q,"id",0),room=number(q,"roomId",runtime.room(user));String scope=string(q,"scope","hotel");if(!Set.of("room","hotel").contains(scope))throw new IllegalArgumentException("Ungültiger Geltungsbereich.");
        try(Connection db=source.getConnection()){
            if(scope.equals("room")&&!exists(db,"SELECT id FROM rooms WHERE id=?",room))throw new IllegalArgumentException("Eventraum nicht gefunden.");
            try(PreparedStatement p=db.prepareStatement("UPDATE polaris_event_word_collections SET auto_play=1,auto_run=auto_run+1,auto_index=0,current_event=0,next_at=?,scope=?,room_id=?,creator_id=? WHERE id=? AND auto_play=0")){p.setLong(1,clock.getAsLong());p.setString(2,scope);p.setInt(3,scope.equals("room")?room:0);p.setInt(4,user);p.setInt(5,id);if(p.executeUpdate()!=1)throw new IllegalArgumentException("Sammlung nicht gefunden oder AutoPlay läuft bereits.");}
        }tickCollections();
    }
    private void stopCollection(int user,int id)throws Exception{
        requireManager(user);int event=0;try(Connection db=source.getConnection()){
            try(PreparedStatement p=db.prepareStatement("SELECT current_event FROM polaris_event_word_collections WHERE id=?")){p.setInt(1,id);try(ResultSet r=p.executeQuery()){if(!r.next())throw new IllegalArgumentException("Wortsammlung nicht gefunden.");event=r.getInt(1);}}
            try(PreparedStatement p=db.prepareStatement("UPDATE polaris_event_word_collections SET auto_play=0,next_at=0 WHERE id=?")){p.setInt(1,id);p.executeUpdate();}
        }if(event>0)settle(event,true,0);
    }
    private void tickCollections()throws Exception{
        List<Integer> ids=new ArrayList<>();try(Connection db=source.getConnection();PreparedStatement p=db.prepareStatement("SELECT id FROM polaris_event_word_collections WHERE auto_play=1 AND next_at<=? ORDER BY id")){p.setLong(1,clock.getAsLong());try(ResultSet r=p.executeQuery()){while(r.next())ids.add(r.getInt(1));}}
        for(int id:ids)try{
            int creator,run,index,interval,room,credits,diamonds,stars=0,flames=0;String scope,name,word;boolean uniform;JsonArray words,rewards;
            try(Connection db=source.getConnection();PreparedStatement p=db.prepareStatement("SELECT * FROM polaris_event_word_collections WHERE id=? AND auto_play=1")){p.setInt(1,id);try(ResultSet r=p.executeQuery()){
                if(!r.next())continue;int current=r.getInt("current_event");if(current>0&&read(db,current,false).status.equals("active"))continue;
                words=new JsonParser().parse(r.getString("words")).getAsJsonArray();index=r.getInt("auto_index");creator=r.getInt("creator_id");run=r.getInt("auto_run");
                if(index>=words.size()){try(PreparedStatement done=db.prepareStatement("UPDATE polaris_event_word_collections SET auto_play=0,next_at=0 WHERE id=?")){done.setInt(1,id);done.executeUpdate();}notice(db,current,creator,0,"AutoPlay der Wortsammlung "+r.getString("name")+" ist abgeschlossen.");continue;}
                word=words.get(index).getAsString();interval=r.getInt("interval_seconds");room=r.getInt("room_id");scope=r.getString("scope");name=r.getString("name");credits=r.getInt("reward_credits");diamonds=r.getInt("reward_diamonds");uniform=r.getInt("uniform_reward")!=0;rewards=new JsonParser().parse(r.getString("rewards")==null?"[]":r.getString("rewards")).getAsJsonArray();
            }}
            {for(JsonElement raw:rewards){JsonObject reward=raw.getAsJsonObject();if(reward.get("word").getAsString().equals(word)){credits=reward.get("credits").getAsInt();diamonds=reward.get("diamonds").getAsInt();stars=number(reward,"eventstars",0);flames=number(reward,"flames",0);break;}}}
            JsonObject q=new JsonObject();q.addProperty("kind","riddle");q.addProperty("title",name+" · Wort "+(index+1));q.addProperty("answer",word);q.addProperty("scope",scope);q.addProperty("roomId",room);q.addProperty("durationSeconds",Math.min(interval,600));q.addProperty("rewardCredits",credits);q.addProperty("rewardDiamonds",diamonds);q.addProperty("rewardEventstars",stars);q.addProperty("rewardFlames",flames);q.addProperty("requestId","collection:"+id+":run:"+run+":word:"+index);
            int event=create(creator,q);
            try(Connection db=source.getConnection();PreparedStatement p=db.prepareStatement("UPDATE polaris_event_word_collections SET current_event=?,auto_index=?,next_at=? WHERE id=? AND auto_play=1 AND auto_run=?")){p.setInt(1,event);p.setInt(2,index+1);p.setLong(3,clock.getAsLong()+interval);p.setInt(4,id);p.setInt(5,run);p.executeUpdate();}
        }catch(Exception failure){
            LOGGER.error("AutoPlay collection {} stopped after failure",id,failure);
            try(Connection db=source.getConnection();PreparedStatement p=db.prepareStatement("UPDATE polaris_event_word_collections SET auto_play=0,next_at=0 WHERE id=?")){p.setInt(1,id);p.executeUpdate();}
        }
    }
    public boolean validCatalogItem(Connection db,int item)throws SQLException{
        if(!runtime.rewardAllowed(item))return false;
        try(PreparedStatement p=db.prepareStatement("SELECT b.id FROM items_base b JOIN catalog_items c ON c.item_ids=CONCAT('',b.id) JOIN catalog_pages p ON p.id=c.page_id WHERE b.id=? AND b.type IN ('s','i') AND c.limited_stack=0 AND p.enabled='1' LIMIT 1")){p.setInt(1,item);try(ResultSet r=p.executeQuery()){return r.next();}}
    }
    private JsonArray catalog(String search)throws SQLException{
        if(search.length()>100)throw new IllegalArgumentException("Suchbegriff zu lang."); JsonArray items=new JsonArray();
        int itemId=0;try{itemId=Integer.parseInt(search.trim());}catch(NumberFormatException ignored){}
        try(Connection db=source.getConnection();PreparedStatement p=db.prepareStatement("SELECT DISTINCT b.id,b.item_name,b.public_name,b.sprite_id,b.type FROM items_base b JOIN catalog_items c ON c.item_ids=CONCAT('',b.id) JOIN catalog_pages p ON p.id=c.page_id WHERE b.type IN ('s','i') AND c.limited_stack=0 AND p.enabled='1' AND (b.id=? OR b.public_name LIKE ? OR b.item_name LIKE ?) ORDER BY b.id DESC LIMIT 60")){
            p.setInt(1,itemId);p.setString(2,"%"+search+"%");p.setString(3,"%"+search+"%");try(ResultSet r=p.executeQuery()){while(r.next()){if(!runtime.rewardAllowed(r.getInt(1)))continue;JsonObject item=new JsonObject();item.addProperty("id",r.getInt(1));item.addProperty("asset",r.getString(2));item.addProperty("name",r.getString(3));item.addProperty("spriteId",r.getInt(4));item.addProperty("furniType",r.getString(5));items.add(item);}}
        }return items;
    }
    public synchronized void join(int user,int id)throws Exception{
        try(Connection db=source.getConnection()){
            db.setAutoCommit(false);try{
                Event event=read(db,id,true);requireActive(event);if(!event.kind.equals("giveaway"))throw new IllegalArgumentException("Dieses Event ist kein Giveaway.");requirePlayer(user,event);
                try(PreparedStatement p=db.prepareStatement("INSERT INTO polaris_event_entries(event_id,user_id,joined_at) SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM polaris_event_entries WHERE event_id=? AND user_id=?)")){p.setInt(1,id);p.setInt(2,user);p.setLong(3,clock.getAsLong());p.setInt(4,id);p.setInt(5,user);p.executeUpdate();}db.commit();
            }catch(Exception e){db.rollback();throw e;}
        }
    }
    public synchronized void joinCurrent(int user)throws Exception{
        int room=runtime.room(user);int id=0;
        try(Connection db=source.getConnection();PreparedStatement p=db.prepareStatement("SELECT id FROM polaris_events WHERE kind='giveaway' AND status='active' AND ends_at>? AND (scope='hotel' OR room_id=?) ORDER BY CASE WHEN room_id=? THEN 0 ELSE 1 END,id DESC LIMIT 1")){
            p.setLong(1,clock.getAsLong());p.setInt(2,room);p.setInt(3,room);try(ResultSet r=p.executeQuery()){if(r.next())id=r.getInt(1);}}
        if(id==0)throw new IllegalArgumentException("Momentan läuft hier kein Giveaway.");join(user,id);
    }
    public synchronized void bid(int user,int id,int amount)throws Exception{
        if(amount<1||amount>1000000000)throw new IllegalArgumentException("Gebot: 1 bis 1.000.000.000.");
        Event prior;try(Connection db=source.getConnection()){prior=read(db,id,false);}List<Integer> users=users(user,prior.highestUser);
        runtime.coordinated(users,()->{
            try(Connection db=source.getConnection()){
                db.setAutoCommit(false);try{
                    Event e=read(db,id,true);requireActive(e);requirePlayer(user,e);if(!e.kind.equals("auction"))throw new IllegalArgumentException("Dieses Event ist keine Auktion.");
                    if(amount<e.startPrice||amount<=e.highestBid)throw new IllegalArgumentException("Das Gebot muss höher als das aktuelle Höchstgebot sein.");
                    lockUsers(db,users);int delta=e.highestUser==user?amount-e.highestBid:amount;
                    mutate(db,user,e.currency,-delta,"event:auction:"+id+":"+(e.version+1)+":debit",user,id);
                    if(e.highestUser>0&&e.highestUser!=user)mutate(db,e.highestUser,e.currency,e.highestBid,"event:auction:"+id+":"+(e.version+1)+":refund",user,id);
                    try(PreparedStatement p=db.prepareStatement("UPDATE polaris_events SET highest_bid=?,highest_user=?,bid_version=bid_version+1 WHERE id=?")){p.setInt(1,amount);p.setInt(2,user);p.setInt(3,id);p.executeUpdate();}
                    db.commit();refresh(users,Map.of());return null;
                }catch(IllegalArgumentException ex){db.rollback();if(ex.getMessage().contains("invalid balance"))throw new IllegalArgumentException("Du kannst nur Guthaben bieten, das du aktuell besitzt.");throw ex;}
                catch(Exception ex){db.rollback();throw ex;}
            }
        });
    }
    /** Called only by public room talk/shout handlers, after normal command/filter processing. */
    public synchronized void answer(int user,String text)throws Exception{
        if(text==null||text.startsWith(":"))return;String answer=normalize(text);int room=runtime.room(user);List<Integer> ids=new ArrayList<>();
        try(Connection db=source.getConnection();PreparedStatement p=db.prepareStatement("SELECT id FROM polaris_events WHERE kind='riddle' AND status='active' AND ends_at>? AND (scope='hotel' OR room_id=?) AND secret=? ORDER BY id")){
            p.setLong(1,clock.getAsLong());p.setInt(2,room);p.setString(3,answer);try(ResultSet r=p.executeQuery()){while(r.next())ids.add(r.getInt(1));}}
        for(int id:ids)settle(id,false,user);
    }
    private void settle(int id,boolean cancel,int answerUser)throws Exception{
        Event snapshot;List<Integer> winners=new ArrayList<>();
        try(Connection db=source.getConnection()){
            snapshot=read(db,id,false);if(!snapshot.status.equals("active"))return;
            if(snapshot.kind.equals("auction") && snapshot.highestUser>0)winners.add(snapshot.highestUser);
            if(answerUser>0){requirePlayer(answerUser,snapshot);if(clock.getAsLong()>=snapshot.ends) return;winners.add(answerUser);}
            if(snapshot.kind.equals("giveaway")&&!cancel){
                try(PreparedStatement p=db.prepareStatement("SELECT x.user_id FROM polaris_event_entries x JOIN users u ON u.id=x.user_id WHERE x.event_id=? ORDER BY x.user_id")){p.setInt(1,id);try(ResultSet r=p.executeQuery()){while(r.next())winners.add(r.getInt(1));}}
                Collections.shuffle(winners,random);winners=new ArrayList<>(winners.subList(0,Math.min(snapshot.winners,winners.size())));
            }
        }
        if(cancel)winners.clear();List<Integer> selected=List.copyOf(winners),affected=users(selected.toArray(Integer[]::new));if(snapshot.highestUser>0&&!affected.contains(snapshot.highestUser))affected=usersWith(affected,snapshot.highestUser);
        List<Integer> coordinatedUsers=affected;
        runtime.coordinated(coordinatedUsers,()->{
            Map<Integer,List<Integer>> rewards=new HashMap<>();
            try(Connection db=source.getConnection()){
                db.setAutoCommit(false);try{
                    Event e=read(db,id,true);if(!e.status.equals("active")){db.rollback();return null;}
                    if(!cancel && answerUser==0 && clock.getAsLong()<e.ends){db.rollback();return null;}
                    if(answerUser>0 && (!e.kind.equals("riddle")||clock.getAsLong()>=e.ends)){db.rollback();return null;}
                    lockUsers(db,coordinatedUsers);
                    if(cancel&&e.kind.equals("auction")&&e.highestUser>0)mutate(db,e.highestUser,e.currency,e.highestBid,"event:auction:"+id+":cancel",e.creator,id);
                    if(!cancel){for(int user:selected){
                        try(PreparedStatement p=db.prepareStatement("INSERT INTO polaris_event_results(event_id,user_id,won_at) VALUES(?,?,?)")){p.setInt(1,id);p.setInt(2,user);p.setLong(3,clock.getAsLong());p.executeUpdate();}
                        List<Integer> items=new ArrayList<>();if(e.item>0)for(int i=0;i<e.amount;i++){int created=runtime.createItem(db,user,e.item);if(created<=0)throw new SQLException("Event reward item could not be created");items.add(created);}rewards.put(user,items);
                        if(e.credits>0)mutate(db,user,"credits",e.credits,"event:"+id+":winner:"+user+":credits",e.creator,id);
                        if(e.diamonds>0)mutate(db,user,"diamonds",e.diamonds,"event:"+id+":winner:"+user+":diamonds",e.creator,id);
                        try(PreparedStatement p=db.prepareStatement("SELECT type,amount FROM polaris_event_currency_rewards WHERE event_id=?")){p.setInt(1,id);try(ResultSet r=p.executeQuery()){while(r.next())mutate(db,user,r.getInt(1)==104?"eventstars":"flames",r.getInt(2),"event:"+id+":winner:"+user+":currency:"+r.getInt(1),e.creator,id);}}
                        notice(db,id,user,0,"Du hast "+e.title+" gewonnen! Deine Belohnung wurde deinem Konto/Inventar gutgeschrieben.");
                    }}
                    String message=e.title+(cancel?" wurde abgebrochen.":selected.isEmpty()?" ist beendet. Es gab keinen Gewinner.":" ist beendet. Gewinner: "+names(db,selected)+".");
                    if(e.kind.equals("riddle")&&!cancel)message+=" Lösung: "+e.secret+".";
                    notice(db,id,0,e.scope.equals("room")?e.room:0,message);
                    try(PreparedStatement p=db.prepareStatement("UPDATE polaris_events SET status=? WHERE id=?")){p.setString(1,cancel?"cancelled":"ended");p.setInt(2,id);p.executeUpdate();}
                    db.commit();refresh(coordinatedUsers,rewards);return null;
                }catch(Exception ex){db.rollback();throw ex;}
            }
        });deliverNotices();
    }
    private void mutate(Connection db,int user,String currency,int delta,String key,int actor,int event)throws SQLException{
        EconomyLedger.apply(db,new EconomyOperation(key,user,actor,delta<0?"event_escrow":"event_reward","polaris.events",switch(currency){case "credits"->EconomyLedger.CREDITS;case "diamonds"->5;case "eventstars"->104;case "flames"->105;default->throw new IllegalArgumentException("Ungültige Währung.");},delta,null,"event="+event));
    }
    private void refresh(List<Integer> users,Map<Integer,List<Integer>> rewards){try{runtime.refresh(users,rewards);}catch(Exception error){LOGGER.error("Event changes committed; live inventory/wallet refresh failed",error);}}
    private void lockUsers(Connection db,List<Integer> users)throws SQLException{
        for(int user:users)try(PreparedStatement p=db.prepareStatement("SELECT id FROM users WHERE id=? FOR UPDATE")){p.setInt(1,user);try(ResultSet row=p.executeQuery()){if(!row.next())throw new SQLException("Event user does not exist");}}
    }
    private static List<Integer> users(Integer... ids){return Arrays.stream(ids).filter(id->id!=null&&id>0).distinct().sorted().toList();}
    private static List<Integer> usersWith(List<Integer> list,int id){List<Integer> merged=new ArrayList<>(list);merged.add(id);return users(merged.toArray(Integer[]::new));}
    private String names(Connection db,List<Integer> users)throws SQLException{List<String> names=new ArrayList<>();for(int user:users)try(PreparedStatement p=db.prepareStatement("SELECT username FROM users WHERE id=?")){p.setInt(1,user);try(ResultSet r=p.executeQuery()){if(r.next())names.add(r.getString(1));}}return String.join(", ",names);}
    private void notice(Connection db,int event,int user,int room,String message)throws SQLException{try(PreparedStatement p=db.prepareStatement("INSERT INTO polaris_event_notices(event_id,user_id,room_id,message) VALUES(?,?,?,?)")){p.setInt(1,event);p.setInt(2,user);p.setInt(3,room);p.setString(4,message);p.executeUpdate();}}
    private void deliverNotices()throws SQLException{
        // Public announcements always advance; offline private recipients rotate across ticks.
        try(Connection db=source.getConnection()){
            try(PreparedStatement p=db.prepareStatement("SELECT id,user_id,room_id,message,(SELECT kind FROM polaris_events WHERE id=polaris_event_notices.event_id) AS event_kind FROM polaris_event_notices WHERE delivered=0 AND user_id=0 ORDER BY id LIMIT 200");ResultSet r=p.executeQuery()){
                while(r.next())deliverNotice(db,r);
            }
            boolean found=false;
            try(PreparedStatement p=db.prepareStatement("SELECT id,user_id,room_id,message,(SELECT kind FROM polaris_events WHERE id=polaris_event_notices.event_id) AS event_kind FROM polaris_event_notices WHERE delivered=0 AND user_id>0 AND id>? ORDER BY id LIMIT 200")){
                p.setInt(1,privateNoticeCursor);try(ResultSet r=p.executeQuery()){
                    while(r.next()){found=true;privateNoticeCursor=r.getInt(1);deliverNotice(db,r);}
                }
            }
            if(!found)privateNoticeCursor=0;
        }
    }
    private void deliverNotice(Connection db,ResultSet r)throws SQLException{
        boolean delivered;
        try{delivered=runtime.announceEvent(r.getInt(2),r.getInt(3),r.getString(4),r.getString(5));}
        catch(RuntimeException ex){LOGGER.error("Event notice {} awaits retry",r.getInt(1),ex);return;}
        if(delivered)try(PreparedStatement done=db.prepareStatement("UPDATE polaris_event_notices SET delivered=1 WHERE id=?")){done.setInt(1,r.getInt(1));done.executeUpdate();}
    }
    public synchronized JsonObject state(int user)throws SQLException{
        JsonObject result=new JsonObject();result.addProperty("now",clock.getAsLong());result.addProperty("canManage",canManage(user));JsonArray activities=new JsonArray();
        try(Connection db=source.getConnection()){
            JsonObject balance=new JsonObject();try(PreparedStatement p=db.prepareStatement("SELECT credits,username FROM users WHERE id=?")){p.setInt(1,user);try(ResultSet r=p.executeQuery()){if(r.next()){balance.addProperty("credits",r.getInt(1));result.addProperty("username",r.getString(2));}else balance.addProperty("credits",0);}}
            for(var currency:Map.of("diamonds",5,"eventstars",104,"flames",105).entrySet())try(PreparedStatement p=db.prepareStatement("SELECT amount FROM users_currency WHERE user_id=? AND type=?")){p.setInt(1,user);p.setInt(2,currency.getValue());try(ResultSet r=p.executeQuery()){balance.addProperty(currency.getKey(),r.next()?r.getInt(1):0);}}result.add("balance",balance);
            try(PreparedStatement p=db.prepareStatement("SELECT e.*,b.item_name,b.public_name,b.sprite_id,b.type AS furni_type,r.name AS room_name,u.username AS starter,u.look AS starter_look,h.username AS bidder,h.look AS bidder_look,(SELECT COUNT(*) FROM polaris_event_entries x WHERE x.event_id=e.id) AS participants,(SELECT COUNT(*) FROM polaris_event_entries x WHERE x.event_id=e.id AND x.user_id=?) AS joined FROM polaris_events e LEFT JOIN items_base b ON b.id=e.item_id LEFT JOIN rooms r ON r.id=e.room_id LEFT JOIN users u ON u.id=e.creator_id LEFT JOIN users h ON h.id=e.highest_user ORDER BY CASE WHEN e.status='active' THEN 0 ELSE 1 END,e.id DESC LIMIT 100")){
                p.setInt(1,user);try(ResultSet rows=p.executeQuery()){while(rows.next()){
                    JsonObject o=new JsonObject();for(String column:new String[]{"kind","title","scope","currency","question","status"})o.addProperty(column,rows.getString(column));
                    o.addProperty("id",rows.getInt("id"));o.addProperty("itemId",rows.getInt("item_id"));o.addProperty("asset",safe(rows.getString("item_name")));o.addProperty("itemName",safe(rows.getString("public_name")));o.addProperty("spriteId",rows.getInt("sprite_id"));o.addProperty("furniType",safe(rows.getString("furni_type")));o.addProperty("amount",rows.getInt("amount"));o.addProperty("roomId",rows.getInt("room_id"));o.addProperty("roomName",safe(rows.getString("room_name")));o.addProperty("startsAt",rows.getLong("starts_at"));o.addProperty("endsAt",rows.getLong("ends_at"));o.addProperty("startPrice",rows.getInt("start_price"));o.addProperty("highestBid",rows.getInt("highest_bid"));o.addProperty("minBid",Math.max(rows.getInt("start_price"),rows.getInt("highest_bid")+1));o.addProperty("highestBidder",safe(rows.getString("bidder")));o.addProperty("highestBidderLook",safe(rows.getString("bidder_look")));o.addProperty("starter",safe(rows.getString("starter")));o.addProperty("starterLook",safe(rows.getString("starter_look")));o.addProperty("participants",rows.getInt("participants"));o.addProperty("joined",rows.getInt("joined")>0);o.addProperty("rewardCredits",rows.getInt("reward_credits"));o.addProperty("rewardDiamonds",rows.getInt("reward_diamonds"));o.addProperty("winnerCount",rows.getInt("winner_count"));
                    try(PreparedStatement extra=db.prepareStatement("SELECT type,amount FROM polaris_event_currency_rewards WHERE event_id=?")){extra.setInt(1,rows.getInt("id"));try(ResultSet reward=extra.executeQuery()){while(reward.next())o.addProperty(reward.getInt(1)==104?"rewardEventstars":"rewardFlames",reward.getInt(2));}}
                    long available=balance.get(rows.getString("currency")).getAsLong()+(rows.getInt("highest_user")==user?rows.getInt("highest_bid"):0);o.addProperty("maxBid",Math.min(1000000000L,available));
                    JsonArray winners=new JsonArray();try(PreparedStatement w=db.prepareStatement("SELECT u.id,u.username,u.look FROM polaris_event_results x JOIN users u ON u.id=x.user_id WHERE x.event_id=? ORDER BY x.user_id")){w.setInt(1,rows.getInt("id"));try(ResultSet wr=w.executeQuery()){while(wr.next()){JsonObject winner=new JsonObject();winner.addProperty("id",wr.getInt(1));winner.addProperty("name",wr.getString(2));winner.addProperty("look",wr.getString(3));winners.add(winner);}}}o.add("winners",winners);o.addProperty("winner",winners.isEmpty()?"":winners.get(0).getAsJsonObject().get("name").getAsString());o.addProperty("winnerLook",winners.isEmpty()?"":winners.get(0).getAsJsonObject().get("look").getAsString());activities.add(o);
                }}
            }
            JsonObject stats=new JsonObject();try(Statement p=db.createStatement();ResultSet r=p.executeQuery("SELECT COUNT(*) AS total,SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active,SUM(CASE WHEN status='ended' THEN 1 ELSE 0 END) AS ended FROM polaris_events")){r.next();stats.addProperty("total",r.getInt("total"));stats.addProperty("active",r.getInt("active"));stats.addProperty("ended",r.getInt("ended"));}try(Statement p=db.createStatement();ResultSet r=p.executeQuery("SELECT COUNT(*) FROM polaris_event_results")){r.next();stats.addProperty("winners",r.getInt(1));}result.add("stats",stats);
            JsonArray top10=new JsonArray();try(Statement p=db.createStatement();ResultSet r=p.executeQuery("SELECT u.id,u.username,u.look,COUNT(*) AS wins FROM polaris_event_results x JOIN polaris_events e ON e.id=x.event_id JOIN users u ON u.id=x.user_id WHERE e.kind='riddle' GROUP BY u.id,u.username,u.look ORDER BY wins DESC,u.id LIMIT 10")){while(r.next()){JsonObject row=new JsonObject();row.addProperty("id",r.getInt(1));row.addProperty("name",r.getString(2));row.addProperty("look",r.getString(3));row.addProperty("count",r.getInt(4));top10.add(row);}}stats.add("top10",top10);
            if(result.get("canManage").getAsBoolean()){
                JsonArray collections=new JsonArray();try(Statement p=db.createStatement();ResultSet r=p.executeQuery("SELECT * FROM polaris_event_word_collections ORDER BY name,id LIMIT 100")){while(r.next()){JsonObject collection=new JsonObject();collection.addProperty("id",r.getInt("id"));collection.addProperty("name",r.getString("name"));collection.add("words",new JsonParser().parse(r.getString("words")).getAsJsonArray());collection.addProperty("intervalSeconds",r.getInt("interval_seconds"));collection.addProperty("uniformReward",r.getInt("uniform_reward")!=0);collection.addProperty("rewardCredits",r.getInt("reward_credits"));collection.addProperty("rewardDiamonds",r.getInt("reward_diamonds"));collection.add("rewards",new JsonParser().parse(r.getString("rewards")==null?"[]":r.getString("rewards")).getAsJsonArray());collection.addProperty("autoPlay",r.getInt("auto_play")!=0);collection.addProperty("nextAt",r.getLong("next_at"));collection.addProperty("scope",r.getString("scope"));collection.addProperty("roomId",r.getInt("room_id"));JsonArray savedRewards=collection.getAsJsonArray("rewards");if(!savedRewards.isEmpty()){JsonObject first=savedRewards.get(0).getAsJsonObject();collection.addProperty("rewardEventstars",number(first,"eventstars",0));collection.addProperty("rewardFlames",number(first,"flames",0));}collections.add(collection);}}result.add("collections",collections);
            }
        }result.add("activities",activities);result.add("statistics",result.getAsJsonObject("stats").get("top10"));return result;
    }
    private Event read(Connection db,int id,boolean lock)throws SQLException{
        try(PreparedStatement p=db.prepareStatement("SELECT * FROM polaris_events WHERE id=?"+(lock?" FOR UPDATE":""))){p.setInt(1,id);try(ResultSet r=p.executeQuery()){if(!r.next())throw new IllegalArgumentException("Event nicht gefunden.");return new Event(r.getInt("id"),r.getString("kind"),r.getString("title"),r.getString("scope"),r.getInt("room_id"),r.getInt("item_id"),r.getInt("amount"),r.getString("currency"),r.getInt("reward_credits"),r.getInt("reward_diamonds"),r.getInt("start_price"),r.getInt("highest_bid"),r.getInt("highest_user"),r.getInt("bid_version"),r.getInt("winner_count"),r.getInt("creator_id"),r.getLong("ends_at"),r.getString("status"),r.getString("secret"));}}
    }
    private void requireActive(Event e){if(!e.status.equals("active")||clock.getAsLong()>=e.ends)throw new IllegalArgumentException("Dieses Event ist bereits beendet.");}
    public static int number(JsonObject q,String key,int fallback){try{return q.has(key)?q.get(key).getAsBigDecimal().intValueExact():fallback;}catch(Exception e){throw new IllegalArgumentException("Ungültiger Zahlenwert: "+key);}}
    public static String string(JsonObject q,String key,String fallback){try{return q.has(key)&&!q.get(key).isJsonNull()?q.get(key).getAsString():fallback;}catch(Exception e){throw new IllegalArgumentException("Ungültiger Textwert: "+key);}}
    private static String safe(String value){return value==null?"":value;}
    public static String normalize(String value){return Normalizer.normalize(value,Normalizer.Form.NFKC).trim().toLowerCase(Locale.ROOT).replaceAll("\\s+"," ");}
    private String scramble(String word){List<String> letters=new ArrayList<>();word.codePoints().filter(c->c!=' ').forEach(c->letters.add(new String(Character.toChars(c))));Collections.shuffle(letters,random);return String.join(" · ",letters);}
    private record Event(int id,String kind,String title,String scope,int room,int item,int amount,String currency,int credits,int diamonds,int startPrice,int highestBid,int highestUser,int version,int winners,int creator,long ends,String status,String secret) {}
}
