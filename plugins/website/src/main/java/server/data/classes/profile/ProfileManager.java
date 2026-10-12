package server.data.classes.profile;

import java.util.ArrayList;
import java.util.List;

public class ProfileManager {
    private final List<Profile> profiles;

    public ProfileManager(){
        this.profiles = new ArrayList<>();
    }

    public Profile getProfile(String username){
        return this.profiles.stream()
                .filter(data -> data.getAccount().getUsername().equalsIgnoreCase(username))
                .findFirst()
                .orElse(null);
    }

    public List<Profile> getProfiles(){
        return this.profiles;
    }

    public void insertProfile(Profile profile){
        this.profiles.add(profile);
    }

    public void removeProfile(Profile profile){
        this.profiles.remove(profile);
    }
}
