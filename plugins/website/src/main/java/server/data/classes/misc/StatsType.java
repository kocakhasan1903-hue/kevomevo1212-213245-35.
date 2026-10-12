package server.data.classes.misc;

public enum StatsType {

    SCORE("AchievementScore"),
    RESPECTS("RespectEarned"),
    RESPECTS_PAID("RespectGiven"),
    ONLINE("AllTimeHotelPresence"),
    ROOM_VISIT("RoomEntry"),
    PLACED_FURNIS("RoomDecoFurniCount"),
    BATTLE_BALL_WINNER("BattleBallWinner"),
    FREEZE_WINNER("FreezeWinner"),
    FuTBOL_GOL_SCORE("FootballGoalScored");

    public final String type;

    StatsType(String type){
        this.type = type;
    }

    public String getType() {
        return type;
    }
}
