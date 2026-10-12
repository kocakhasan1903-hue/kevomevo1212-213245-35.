import { ReactNode } from 'react';
import { HabbixActionIcon } from '../../../../common/HabbixActionIcon';

/** Shared room composer chrome; message delivery remains owned by ChatInputView. */
export function RoomChatBar({ children, input, voice, options, gif, recording, canSend, onSend }: {
    children?: ReactNode; input: ReactNode; voice: ReactNode; options: ReactNode; gif?: ReactNode;
    recording: boolean; canSend: boolean; onSend: () => void;
}) {
    return <div className={'octane-chat-input-container swf-chat-input habbix-room-composer' + (recording ? ' is-recording' : '')}>
        {children}
        <div className="habbix-room-field" hidden={recording}>{input}</div>
        {recording && <span className="habbix-room-recording-label">Sprachnachricht</span>}
        <div className="habbix-composer-actions">
            {!recording && gif}
            {!recording && options}
            {voice}
            {!recording && canSend && <button type="button" className="habbix-room-send" aria-label="Nachricht senden" title="Senden (Enter)" onClick={onSend}><HabbixActionIcon kind="send"/></button>}
        </div>
    </div>;
}
