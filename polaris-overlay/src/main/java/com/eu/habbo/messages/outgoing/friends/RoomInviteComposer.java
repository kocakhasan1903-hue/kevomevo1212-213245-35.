package com.eu.habbo.messages.outgoing.friends;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.outgoing.MessageComposer;
import com.eu.habbo.messages.outgoing.Outgoing;

public class RoomInviteComposer extends MessageComposer {
    private final int userId;
    private final String message;
    private final int roomId;

    public RoomInviteComposer(int userId, String message) {
        this.userId = userId;
        this.message = message;
        // Optional trailing field: legacy clients still read the unchanged prefix.
        var sender = com.eu.habbo.Emulator.getGameEnvironment().getHabboManager().getHabbo(userId);
        this.roomId = sender != null && sender.getHabboInfo().getCurrentRoom() != null
                ? sender.getHabboInfo().getCurrentRoom().getId() : 0;
    }

    @Override
    protected ServerMessage composeInternal() {
        this.response.init(Outgoing.RoomInviteComposer);
        this.response.appendInt(this.userId);
        this.response.appendString(this.message);
        this.response.appendInt(this.roomId);
        return this.response;
    }

    public int getUserId() {
        return userId;
    }

    public String getMessage() {
        return message;
    }
}
