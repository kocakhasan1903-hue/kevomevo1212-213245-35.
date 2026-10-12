import { ReactNode, useMemo, useState } from 'react';
import { FiSearch, FiEdit, FiArrowLeft } from 'react-icons/fi';
import './MessengerConversationList.css';
import { chatRelationship, compareRelationshipPriority, relationshipLabel } from './conversationRelationships';

export type ConversationRow = { id: number; name: string; avatar: ReactNode; online?: boolean; relationship?: number; preview: string; time?: string; unread: number; status?: { ticks: string; isRead: boolean; label: string }; failed?: boolean; active?: boolean };
export function MessengerConversationList({ conversations, contacts, onOpen }: { conversations: ConversationRow[]; contacts: ConversationRow[]; onOpen: (id: number) => void }) {
    const [query, setQuery] = useState(''), [filter, setFilter] = useState<'all' | 'unread' | 'contacts'>('all');
    const rows = useMemo(() => (filter === 'contacts' ? contacts : conversations).filter(row => (filter !== 'unread' || row.unread > 0) && row.name.toLocaleLowerCase('de').includes(query.trim().toLocaleLowerCase('de'))).sort((a,b)=>compareRelationshipPriority(a.relationship,b.relationship)), [conversations, contacts, query, filter]);
    const unread = conversations.reduce((sum, row) => sum + row.unread, 0);
    const newChat = filter === 'contacts';
    const startNewChat = () => { setQuery(''); setFilter('contacts'); };
    return <aside className="hmx-chat-list" aria-label="Unterhaltungen">
        <header className="hmx-list-title"><div><strong>{newChat ? 'Neue Nachricht' : 'Nachrichten'}</strong><small>{newChat ? 'An einen Freund schreiben' : unread ? `${unread} ungelesen` : `${conversations.length} ${conversations.length === 1 ? 'Unterhaltung' : 'Unterhaltungen'}`}</small></div>{newChat ? <button type="button" aria-label="Zurück zu Nachrichten" onClick={() => { setQuery(''); setFilter('all'); }}><FiArrowLeft/></button> : <button type="button" aria-label="Neuen Chat starten" title="Neuer Chat" onClick={startNewChat}><FiEdit/></button>}</header>
        <label className="hmx-list-search"><FiSearch/><input aria-label="Unterhaltungen suchen" placeholder="Suchen …" value={query} onChange={event => setQuery(event.target.value)}/></label>
        {!newChat && <nav className="hmx-list-filters" aria-label="Chats filtern">{([['all', 'Alle'], ['unread', 'Ungelesen']] as const).map(([id, label]) => <button type="button" key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</nav>}
        <div className="hmx-list-rows">{rows.map(row => <button type="button" className="hmx-list-row" key={row.id} aria-pressed={!!row.active} onClick={() => onOpen(row.id)}>
            <span className="hmx-list-avatar">{row.avatar}{row.online && <i aria-label="Online"/>}</span>
            <span className="hmx-list-copy"><strong className="hmx-list-name">{!!chatRelationship(row.relationship)&&<i className={`octane-friends-spritesheet icon-${['','heart','smile','bobba'][chatRelationship(row.relationship)]} hmx-relationship-icon`} role="img" aria-label={`Beziehung: ${relationshipLabel(chatRelationship(row.relationship))}`} title={`${relationshipLabel(chatRelationship(row.relationship))} · Priorität`}/>}<span>{row.name}</span></strong><small>{row.status && <span className={row.status.isRead ? 'hmx-read' : 'hmx-sent'} aria-label={row.status.label}>{row.status.ticks} </span>}{row.failed ? 'Nicht gesendet' : row.preview}</small></span>
            <span className="hmx-list-meta">{row.time && <time>{row.time}</time>}{row.unread > 0 && <b className="hmx-unread" aria-label={`${row.unread} ungelesene Nachrichten`}>{row.unread}</b>}</span>
        </button>)}{!rows.length && <div className="hmx-list-empty-state"><strong>{query ? 'Keine Treffer' : filter === 'unread' ? 'Alles gelesen' : newChat ? 'Noch keine Freunde' : 'Deine Nachrichten'}</strong><p>{query ? 'Versuche einen anderen Namen.' : filter === 'unread' ? 'Du hast keine ungelesenen Nachrichten.' : newChat ? 'Füge Freunde hinzu, um ihnen zu schreiben.' : 'Starte eine Unterhaltung mit deinen Freunden.'}</p>{!query && filter === 'all' && <button type="button" onClick={startNewChat}>Neue Nachricht</button>}</div>}</div>
    </aside>;
}
