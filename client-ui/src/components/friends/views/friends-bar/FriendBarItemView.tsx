import { useFriendsWindowVisible, useFriendsSelectedSlot } from '../../friendsWindowVisibility';
import { FindNewFriendsMessageComposer, MouseEventType } from '@octane/renderer';
import { AnimatePresence, motion } from 'framer-motion';
import { FC, useEffect, useId, useRef, useState } from 'react';
import { CreateLinkEvent, GetUserProfile, LocalizeText, MessengerFriend, OpenMessengerChat, SendMessageComposer } from '../../../../api';
import staffChatFrankIcon from '../../../../assets/images/friends/staff-chat-frank.svg';
import addFriendsIcon from '../../../../assets/images/friends/swf/add_friends_icon.png';
import chatIcon from '../../../../assets/images/friends/swf/friendlist_chat.png';
import profileIcon from '../../../../assets/images/friends/swf/friendlist_eye.png';
import visitIcon from '../../../../assets/images/friends/swf/friendlist_go_room.png';
import searchFriendsIcon from '../../../../assets/images/friends/swf/search_friends_icon.png';
import { LayoutAvatarImageView, LayoutBadgeImageView } from '../../../../common';
import { useFriends, useMessenger } from '../../../../hooks';
import { isStaffChatIdentity } from '../../staffChatIdentity';
import { StaffChatFrankIconView } from '../../StaffChatFrankIconView';
import { HabbixActionIcon } from '../../../../common/HabbixActionIcon';

export const FriendBarItemView: FC<{ friend: MessengerFriend }> = (props) => {
    const { friend = null } = props;
    const friendsWindowVisible = useFriendsWindowVisible();
    const slotId = useId();
    const selectedSlot = useFriendsSelectedSlot();
    const [isVisible, setVisible] = useState(false);
    const { followFriend = null } = useFriends();
    const { activeThread, visibleThreads = [] } = useMessenger();
    const elementRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onClick = (event: MouseEvent) => {
            const element = elementRef.current;
            if (!element) return;
            if (event.target !== element && !element.contains(event.target as Node)) {
                setVisible(false);
            }
        };
        document.addEventListener(MouseEventType.MOUSE_CLICK, onClick);
        return () => document.removeEventListener(MouseEventType.MOUSE_CLICK, onClick);
    }, []);

    if (!friend) {
        return (
            <div ref={elementRef} className={`friend-bar-find-friends ${friendsWindowVisible && selectedSlot === slotId ? 'is-selected' : ''}`}>
                <button
                    type="button"
                    className="friend-bar-item friend-bar-search find-friends"
                    aria-label="Freunde öffnen"
                    aria-pressed={friendsWindowVisible && selectedSlot === slotId}
                    onClick={() => CreateLinkEvent(`friends/list/${slotId}`)}
                >
                    <span className="friend-bar-item-head" aria-hidden="true" />
                    <span className="friend-bar-text">Freunde</span>
                </button>

                <AnimatePresence>
                    {isVisible && (
                        <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 6 }}
                            transition={{ duration: 0.12 }}
                            className="friend-bar-find-friends-panel"
                        >
                            <div className="friend-bar-find-friends-header">
                                <img src={addFriendsIcon} alt="" />
                                <span>{LocalizeText('friend.bar.find.title')}</span>
                            </div>
                            <div className="friend-bar-find-friends-copy">{LocalizeText('friend.bar.find.text')}</div>
                            <button
                                className="friend-bar-find-friends-button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    SendMessageComposer(new FindNewFriendsMessageComposer());
                                    setVisible(false);
                                }}
                            >
                                {LocalizeText('friend.bar.find.button')}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    const isStaffChat = isStaffChatIdentity(friend);
    const chatOpen = activeThread?.participant?.id === friend.id;
    const unread = visibleThreads.some(thread => thread?.participant?.id === friend.id && thread.unread);

    return (
        <div ref={elementRef} className={`friend-bar-friend relative ${isVisible ? 'is-selected' : ''} ${chatOpen ? 'is-chat-open' : ''} ${unread ? 'has-unread-chat' : ''}`}>
            {isStaffChat ? (
                <div className="friend-bar-item-head avatar staff-chat absolute left-[-3px] bottom-[-2px] z-10 h-[40px] w-[40px] overflow-hidden pointer-events-none">
                    <StaffChatFrankIconView size={40} className="friend-bar-staff-chat-frank" />
                </div>
            ) : friend.id > 0 ? (
                <div className="friend-bar-item-head avatar friend-bar-item-head-avatar absolute left-[-3px] bottom-[-2px] z-10 h-[40px] w-[40px] overflow-hidden pointer-events-none">
                    <LayoutAvatarImageView
                        direction={2}
                        figure={friend.figure}
                        headOnly={true}
                        style={{ backgroundPosition: '50% 42%', backgroundSize: '80px auto' }}
                        className="block h-auto w-auto pointer-events-none"
                    />
                </div>
            ) : (
                <div className="friend-bar-item-head group friend-bar-item-head-group absolute left-[6px] top-1/2 -translate-y-1/2 z-10 flex h-[28px] w-[28px] items-center justify-center pointer-events-none">
                    <LayoutBadgeImageView badgeCode="ADM" isGroup={false} className="block pointer-events-none drop-shadow-[1px_1px_0_rgba(0,0,0,0.6)]" />
                </div>
            )}
            <motion.button
                type="button"
                className={`friend-bar-item friend-bar-tab find-friends-active ${friend.id <= 0 ? 'group' : ''}`}
                aria-expanded={isVisible}
                onClick={() => setVisible((prev) => !prev)}
            >
                <div className="friend-bar-text">{friend.name}</div>
            </motion.button>

            <AnimatePresence>
                    {isVisible && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.12 }}
                            className="friend-bar-actions"
                            role="group"
                            aria-label={`Aktionen für ${friend.name}`}
                        >
                        <div className="friend-bar-actions-buttons">
                            <button type="button" aria-label={`Nachricht an ${friend.name}`}
                                className="cursor-pointer friend-bar-action-icon"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    OpenMessengerChat(friend.id);
                                    setVisible(false);
                                }}
                            ><HabbixActionIcon kind="chat"/></button>
                            {!isStaffChat && friend.online && (
                                <button type="button" aria-label={`${friend.name} folgen`}
                                    className="cursor-pointer friend-bar-action-icon"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        followFriend(friend);
                                        setVisible(false);
                                    }}
                                ><img src={visitIcon} alt="" /></button>
                            )}
                            {!isStaffChat && (
                                <button type="button" aria-label={`Profil von ${friend.name}`}
                                    className="cursor-pointer friend-bar-action-icon"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        GetUserProfile(friend.id);
                                        setVisible(false);
                                    }}
                                ><img src={profileIcon} alt="" /></button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
