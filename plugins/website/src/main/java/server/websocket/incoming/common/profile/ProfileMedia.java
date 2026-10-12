package server.websocket.incoming.common.profile;

import com.google.gson.*;
import java.sql.*;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.io.*;
import java.util.*;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

/** Bounded, authenticated chunk uploads; original GIF bytes retain animation. */
public final class ProfileMedia {
 private static final int MAX=10*1024*1024;
 private static final Map<Integer,Upload> uploads=new HashMap<>();
 private static final Path ROOT=Paths.get("/var/www/habboje/profile-media");
 private static final class Upload {
  final String token=UUID.randomUUID().toString(),kind;
  final int size; final long created=System.currentTimeMillis();
  final ByteArrayOutputStream bytes=new ByteArrayOutputStream();
  Upload(String k,int s){kind=k;size=s;}
 }
 public static synchronized JsonObject handle(Connection c,int actor,int owner,String action,String text)throws Exception{
  if(actor!=owner)throw new IllegalArgumentException("Du kannst nur deine eigenen Profilbilder verwalten.");
  uploads.entrySet().removeIf(e->System.currentTimeMillis()-e.getValue().created>300000);
  JsonObject result=new JsonObject();result.addProperty("ownerId",owner);result.addProperty("action",action);
  JsonObject input=text==null||text.isEmpty()?new JsonObject():new JsonParser().parse(text).getAsJsonObject();
  if("mediaStart".equals(action)){
   String kind=input.get("kind").getAsString();int size=input.get("size").getAsInt();
   if(!Arrays.asList("banner","avatar").contains(kind)||size<1||size>MAX)throw new IllegalArgumentException("PNG, JPG oder GIF mit maximal 10 MB verwenden.");
   if(uploads.size()>=20&&!uploads.containsKey(actor))throw new IllegalArgumentException("Der Upload ist gerade ausgelastet. Bitte später versuchen.");
   try(PreparedStatement p=c.prepareStatement("SELECT COUNT(*) FROM website_profile_media WHERE user_id=?")){p.setInt(1,actor);try(ResultSet r=p.executeQuery()){r.next();if(r.getInt(1)>=20)throw new IllegalArgumentException("Maximal 20 gespeicherte Profilbilder.");}}
   Upload u=new Upload(kind,size);uploads.put(actor,u);result.addProperty("token",u.token);
  }else if("mediaChunk".equals(action)||"mediaFinish".equals(action)){
   Upload u=uploads.get(actor);
   if(u==null||!u.token.equals(input.get("token").getAsString()))throw new IllegalArgumentException("Upload abgelaufen. Bitte erneut hochladen.");
   if("mediaChunk".equals(action)){
    String encoded=input.get("content").getAsString();if(encoded.length()>270000)throw new IllegalArgumentException("Upload-Teil zu groß.");
    byte[] part=Base64.getDecoder().decode(encoded);
    if(input.get("offset").getAsInt()!=u.bytes.size()||u.bytes.size()+part.length>u.size)throw new IllegalArgumentException("Ungültige Upload-Reihenfolge.");
    u.bytes.write(part);result.addProperty("received",u.bytes.size());
   }else{
    uploads.remove(actor);if(u.bytes.size()!=u.size)throw new IllegalArgumentException("Bild nicht vollständig übertragen.");
    byte[] bytes=u.bytes.toByteArray();String ext;
    try(ImageInputStream stream=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))){
     Iterator<ImageReader> readers=ImageIO.getImageReaders(stream);if(!readers.hasNext())throw new IllegalArgumentException("Keine gültige Bilddatei.");
     ImageReader reader=readers.next();try{reader.setInput(stream);ext=reader.getFormatName().toLowerCase(Locale.ROOT);if(!Arrays.asList("png","gif","jpeg","jpg").contains(ext))throw new IllegalArgumentException("Nur PNG, JPG und GIF sind erlaubt.");if(reader.getWidth(0)>8192||reader.getHeight(0)>8192||(long)reader.getWidth(0)*reader.getHeight(0)>24000000)throw new IllegalArgumentException("Bildabmessungen zu groß.");}finally{reader.dispose();}
    }
    String filename=UUID.randomUUID().toString()+"."+ext;Path directory=ROOT.resolve(Integer.toString(actor));Files.createDirectories(directory);Path target=directory.resolve(filename);
    Files.setPosixFilePermissions(directory,PosixFilePermissions.fromString("rwxr-xr-x"));
    Files.write(target,bytes,StandardOpenOption.CREATE_NEW);
    Files.setPosixFilePermissions(target,PosixFilePermissions.fromString("rw-r--r--"));
    try(PreparedStatement p=c.prepareStatement("INSERT INTO website_profile_media(user_id,kind,filename,created_at) VALUES(?,?,?,?)")){p.setInt(1,actor);p.setString(2,u.kind);p.setString(3,filename);p.setLong(4,System.currentTimeMillis()/1000);p.executeUpdate();}catch(Exception e){Files.deleteIfExists(target);throw e;}
    result.addProperty("url","/profile-media/"+actor+"/"+filename);result.addProperty("kind",u.kind);
   }
  }else if(!"mediaList".equals(action))throw new IllegalArgumentException("Unbekannte Bildaktion.");
  if("mediaList".equals(action)||"mediaFinish".equals(action)){
   JsonArray images=new JsonArray();try(PreparedStatement p=c.prepareStatement("SELECT id,kind,filename FROM website_profile_media WHERE user_id=? ORDER BY id DESC LIMIT 20")){p.setInt(1,actor);try(ResultSet r=p.executeQuery()){while(r.next()){JsonObject image=new JsonObject();image.addProperty("id",r.getInt(1));image.addProperty("kind",r.getString(2));image.addProperty("url","/profile-media/"+actor+"/"+r.getString(3));images.add(image);}}}result.add("images",images);
  }
  return result;
 }
}
