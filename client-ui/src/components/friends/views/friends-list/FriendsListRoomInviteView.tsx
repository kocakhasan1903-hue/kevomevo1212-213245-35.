import { FC, useRef, useState } from 'react';
import { DraggableWindow, LayoutAvatarImageView } from '../../../../common';
import { useFriends, useRoom } from '../../../../hooks';
import { resolveAvatarFigure } from './resolveAvatarFigure';

interface FriendsRoomInviteViewProps {
    selectedFriendsIds: number[];
    onCloseClick: () => void;
    removeRecipient: (userId: number) => void;
    sendRoomInvite: (message: string) => void;
}

export const FriendsRoomInviteView: FC<FriendsRoomInviteViewProps> = ({ selectedFriendsIds = [], onCloseClick, removeRecipient, sendRoomInvite }) => {
    const [message, setMessage] = useState('');
    const submitted = useRef(false);
    const { getFriend } = useFriends();
    const { roomSession } = useRoom();
    const recipients = selectedFriendsIds.map(id => getFriend(id)).filter(friend => friend?.id > 0);
    const canSend = !!roomSession && recipients.length > 0 && recipients.length <= 100 && !!message.trim() && message.length <= 255;

    return <DraggableWindow uniqueKey="octane-friends-room-invite" handleSelector=".hri-titlebar">
        <section className="hri-dialog" role="dialog" aria-label="Einladung">
            <header className="hri-titlebar"><strong>Einladung</strong><button type="button" aria-label="Einladung schließen" onClick={onCloseClick}>×</button></header>
            <div className="hri-body">
                <strong>{recipients.length} {recipients.length === 1 ? 'Person' : 'Leute'} in diesen Raum einladen.</strong>
                <div className="hri-recipients">{recipients.length ? recipients.map(friend => <div className="hri-recipient" key={friend.id}>
                    <span className="hri-avatar"><LayoutAvatarImageView figure={resolveAvatarFigure(friend.figure, friend.gender)} headOnly nativeCroppedHead direction={2}/></span>
                    <span>{friend.name}{!friend.online && <small>Offline</small>}</span>
                    <button type="button" aria-label={`${friend.name} aus der Einladung entfernen`} onClick={() => removeRecipient(friend.id)}>×</button>
                </div>) : <p className="hri-hint">Wähle zuerst Freunde in der Freundesliste aus.</p>}</div>
                <label htmlFor="hri-message">Nachricht</label>
                <textarea id="hri-message" maxLength={255} placeholder="Lade deine Freunde in diesen Raum ein …" value={message} onChange={event => setMessage(event.target.value)} />
                <small className="hri-counter">{message.length} / 255</small>
                <p className="hri-hint">{recipients.length > 100 ? 'Du kannst höchstens 100 Freunde gleichzeitig einladen.' : roomSession ? 'Stelle sicher, dass man dir folgen kann.' : 'Betritt zuerst einen Raum, um Freunde einzuladen.'}</p>
                <footer className="hri-actions"><button type="button" className="hri-primary" disabled={!canSend} onClick={() => { if (!canSend || submitted.current) return; submitted.current = true; sendRoomInvite(message.trim()); }}>Absenden</button><button type="button" onClick={onCloseClick}>Abbrechen</button></footer>
            </div>
        </section>
    </DraggableWindow>;
};
