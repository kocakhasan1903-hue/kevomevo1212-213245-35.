package server.websocket.incoming.common.community;
import com.google.gson.*;
import java.sql.*;
import java.util.*;
public final class HousekeepingData {
 private static final Map<String,Integer> LEVELS=new LinkedHashMap<>();
 static{LEVELS.put("users",6);LEVELS.put("bans",5);LEVELS.put("rooms",6);LEVELS.put("catalog_pages",6);LEVELS.put("catalog_items",6);LEVELS.put("items_base",6);LEVELS.put("emulator_settings",7);LEVELS.put("permissions",7);LEVELS.put("permissions_commands",7);LEVELS.put("permissions_ranks",7);LEVELS.put("users_currency",6);}
 public static int rank(Connection db,int id)throws SQLException{try(PreparedStatement q=db.prepareStatement("SELECT rank FROM users WHERE id=?")){q.setInt(1,id);try(ResultSet r=q.executeQuery()){return r.next()?r.getInt(1):0;}}}
 private static boolean secret(String column){return column.matches("(?i).*(password|auth_ticket|mail|ip_|machine_id|token|secret).*");}
 public static JsonArray modules(Connection db,int rank)throws SQLException{JsonArray out=new JsonArray();for(Map.Entry<String,Integer> e:LEVELS.entrySet()){try(ResultSet r=db.getMetaData().getTables(db.getCatalog(),null,e.getKey(),new String[]{"TABLE"})){boolean found=false;while(r.next())if(e.getKey().equals(r.getString("TABLE_NAME")))found=true;if(found){JsonObject m=new JsonObject();m.addProperty("table",e.getKey());m.addProperty("rank",e.getValue());m.addProperty("allowed",rank>=e.getValue());out.add(m);}}}return out;}
 public static void handle(Connection db,int user,CmsStudioEvent.Request req,JsonObject out)throws Exception{
  int rank=rank(db,user);Integer level=LEVELS.get(req.table);if(level==null||rank<level)throw new IllegalArgumentException("Keine Berechtigung fuer diesen Bereich.");
  List<String> keys=new ArrayList<>();String table=req.table,pk=null;DatabaseMetaData meta=db.getMetaData();try(ResultSet r=meta.getPrimaryKeys(db.getCatalog(),null,table)){while(r.next()){keys.add(r.getString("COLUMN_NAME"));pk=keys.get(0);}}
  if(pk==null)throw new IllegalArgumentException("Dieser Bereich besitzt keinen eindeutigen Schluessel.");
  LinkedHashMap<String,Boolean> columns=new LinkedHashMap<>();JsonArray fields=new JsonArray();
  try(ResultSet r=meta.getColumns(db.getCatalog(),null,table,null)){while(r.next()){
   String name=r.getString("COLUMN_NAME");if(secret(name))continue;int type=r.getInt("DATA_TYPE");if(type==Types.BLOB||type==Types.BINARY||type==Types.VARBINARY||type==Types.LONGVARBINARY)continue;
   boolean editable=!keys.contains(name)&&!"online".equals(name)&&(!"users".equals(table)||!name.equals("rank")||rank>=7);
   columns.put(name,editable);JsonObject f=new JsonObject();f.addProperty("name",name);f.addProperty("type",r.getString("TYPE_NAME"));f.addProperty("editable",editable);f.addProperty("nullable",r.getInt("NULLABLE")!=0);fields.add(f);
  }}
  if(!columns.containsKey(pk))throw new IllegalArgumentException("Schluessel nicht freigegeben.");
  String identity="";for(String key:keys)identity+=(identity.isEmpty()?"":" AND ")+"`"+key+"`=?";
  if("dbSave".equals(req.action)){
   if(req.values==null||req.original==null||req.key==null)throw new IllegalArgumentException("Datensatz fehlt.");
   db.setAutoCommit(false);try{
    JsonObject current=null;try(PreparedStatement q=db.prepareStatement("SELECT * FROM `"+table+"` WHERE "+identity+" FOR UPDATE")){int k=1;for(String key:keys){if(!req.original.has(key)||req.original.get(key).isJsonNull())throw new IllegalArgumentException("Schluessel fehlt.");q.setString(k++,req.original.get(key).getAsString());}try(ResultSet r=q.executeQuery()){if(r.next()){current=new JsonObject();for(String c:columns.keySet()){String v=r.getString(c);if(v==null)current.add(c,JsonNull.INSTANCE);else current.addProperty(c,v);}}}}
    if(current==null)throw new IllegalArgumentException("Datensatz nicht gefunden.");
    if("users_currency".equals(table)&&rank<7&&current.has("user_id")&&rank(db,current.get("user_id").getAsInt())>=rank)throw new IllegalArgumentException("Waehrungen gleichrangiger und hoeherer Mitarbeiter koennen nicht bearbeitet werden.");
    if("users".equals(table)&&rank<7&&Integer.parseInt(current.get("rank").getAsString())>=rank)throw new IllegalArgumentException("Gleichrangige und hoehere Mitarbeiter koennen nicht bearbeitet werden.");
    List<String> edits=new ArrayList<>();for(Map.Entry<String,JsonElement> e:req.values.entrySet()){
     String c=e.getKey();if(!columns.containsKey(c))throw new IllegalArgumentException("Feld nicht freigegeben.");
     if(!e.getValue().equals(current.get(c))){if(!columns.get(c))throw new IllegalArgumentException("Feld ist schreibgeschuetzt: "+c);if(!req.original.has(c)||!req.original.get(c).equals(current.get(c)))throw new IllegalArgumentException("Datensatz wurde inzwischen geaendert. Bitte neu laden.");edits.add(c);}
    }
    if("users".equals(table)&&edits.contains("rank")){
     int target=req.values.get("rank").getAsInt();if(Integer.parseInt(req.key)==user&&target<7)throw new IllegalArgumentException("Der eigene Vollzugriff darf hier nicht entfernt werden.");
     try(PreparedStatement q=db.prepareStatement("SELECT id FROM permissions WHERE id=?")){q.setInt(1,target);try(ResultSet r=q.executeQuery()){if(!r.next())throw new IllegalArgumentException("Rang existiert nicht.");}}
    }
    if(!edits.isEmpty()){
     String sql="UPDATE `"+table+"` SET ";for(int i=0;i<edits.size();i++)sql+=(i==0?"":",")+"`"+edits.get(i)+"`=?";sql+=" WHERE "+identity;
     try(PreparedStatement q=db.prepareStatement(sql)){int i=1;for(String c:edits){JsonElement v=req.values.get(c);if(v.isJsonNull())q.setNull(i++,Types.NULL);else{String text=v.getAsString();if(text.length()>20000)throw new IllegalArgumentException("Feldwert zu lang.");q.setString(i++,text);}}for(String key:keys)q.setString(i++,req.original.get(key).getAsString());q.executeUpdate();}
     try(PreparedStatement q=db.prepareStatement("INSERT INTO website_cms_audit(user_id,action,target) VALUES(?,'dbSave',?)")){q.setInt(1,user);q.setString(2,table+":"+req.key);q.executeUpdate();}
    }db.commit();out.addProperty("saved",true);out.addProperty("runtimeNotice","Gespeichert. Online-Spielerdaten und Emulator-Einstellungen koennen einen erneuten Login bzw. Emulator-Neustart benoetigen.");
   }catch(Exception e){db.rollback();throw e;}finally{db.setAutoCommit(true);}
  }
  int page=Math.max(0,req.page);String names="";for(String c:columns.keySet())names+=(names.isEmpty()?"":",")+"`"+c+"`";
  String search=req.search==null?"":req.search.trim();if(search.length()>80)throw new IllegalArgumentException("Suche zu lang.");String where="";List<String> searchable=new ArrayList<>(columns.keySet());if(!search.isEmpty()){where=" WHERE ";for(String c:searchable)where+=(where.equals(" WHERE ")?"":" OR ")+"CAST(`"+c+"` AS CHAR) LIKE ?";}
  JsonArray rows=new JsonArray();try(PreparedStatement q=db.prepareStatement("SELECT "+names+" FROM `"+table+"`"+where+" ORDER BY `"+pk+"` LIMIT 51 OFFSET ?")){int i=1;if(!search.isEmpty())for(String c:searchable)q.setString(i++,"%"+search+"%");q.setInt(i,Math.min(page,10000)*50);try(ResultSet r=q.executeQuery()){while(r.next()){JsonObject row=new JsonObject();for(String c:columns.keySet()){String v=r.getString(c);if(v==null)row.add(c,JsonNull.INSTANCE);else row.addProperty(c,v);}rows.add(row);}}}
  boolean more=rows.size()>50;if(more)rows.remove(50);out.addProperty("table",table);out.addProperty("primaryKey",pk);out.add("fields",fields);out.add("records",rows);out.addProperty("page",page);out.addProperty("hasMore",more);
 }
}
