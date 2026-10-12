package com.eu.habbo.habbohotel.rooms;

import com.eu.habbo.Emulator;
import com.eu.habbo.core.ConfigurationManager;
import com.eu.habbo.habbohotel.users.DanceType;
import com.eu.habbo.habbohotel.users.Habbo;
import java.util.ArrayList;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

class RoomIdleBehaviorTest {
    private void tick(Room room, Habbo habbo, ArrayList<Habbo> kicked) throws Exception {
        var method = RoomCycleManager.class.getDeclaredMethod("processHabboIdle", Habbo.class, ArrayList.class);
        method.setAccessible(true);
        method.invoke(new RoomCycleManager(room), habbo, kicked);
    }

    @Test void disabledIdleDoesNotSleepOrKickEvenWhenRoomFlagsAreEnabled() throws Exception {
        var config = mock(ConfigurationManager.class);
        var room = mock(Room.class);
        var habbo = mock(Habbo.class);
        when(room.isIdleSleepEnabled()).thenReturn(true);
        when(room.isIdleAutokickEnabled()).thenReturn(true);
        when(config.getBoolean("hotel.rooms.idle.enabled", true)).thenReturn(false);
        try (var emulator = mockStatic(Emulator.class)) {
            emulator.when(Emulator::getConfig).thenReturn(config);
            var kicked = new ArrayList<Habbo>(); tick(room, habbo, kicked);
            assertTrue(kicked.isEmpty()); verifyNoInteractions(habbo);
        }
    }

    @Test void sleepOnlyRoomNeverInheritsTheFallbackAfkKick() throws Exception {
        var config = mock(ConfigurationManager.class);
        when(config.getBoolean("hotel.rooms.idle.enabled", true)).thenReturn(true);
        var room = mock(Room.class);
        when(room.isIdleSleepEnabled()).thenReturn(true);
        when(room.getIdleSleepTimeoutSeconds()).thenReturn(1);
        var units = mock(RoomUnitManager.class); when(room.getUnitManager()).thenReturn(units);
        var habbo = mock(Habbo.class); var unit = mock(RoomUnit.class);
        when(habbo.getRoomUnit()).thenReturn(unit);
        when(unit.getIdleTimer()).thenReturn(Room.IDLE_CYCLES_KICK + 5);
        when(unit.getDanceType()).thenReturn(DanceType.NONE);
        try (var emulator = mockStatic(Emulator.class)) {
            emulator.when(Emulator::getConfig).thenReturn(config);
            var kicked = new ArrayList<Habbo>(); tick(room, habbo, kicked);
            assertTrue(kicked.isEmpty()); verify(unit).increaseIdleTimer();
            emulator.verify(Emulator::getPluginManager, never());
        }
    }
}
