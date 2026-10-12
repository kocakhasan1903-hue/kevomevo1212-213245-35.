import { AnimatePresence, motion, Variants } from 'framer-motion';
import { FC, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LocalizeText, localizeWithFallback, MessengerFriend } from '../../../../api';
import { AIR_RAIL_CHAT_RESERVED_HALF, AIR_RAIL_EDGE_GAP } from '../../../toolbar/bottomDockLayout';
import { isStaffChatIdentity } from '../../staffChatIdentity';
import { FriendBarItemView } from './FriendBarItemView';
import { FRIEND_BAR_GAP, FRIEND_BAR_MAX_SLOTS, resolveFriendBarCapacity, resolveFriendBarPage } from './friendBarPaging';
import './FriendsBarView.css';

const RIGHT_SAFE = 24;

const containerVariants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.05 } },
    exit: { transition: { staggerChildren: 0.03, staggerDirection: -1 } }
};

const itemVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.12 } },
    exit: { opacity: 0, transition: { duration: 0.1 } }
};

export const FriendBarView: FC<{ onlineFriends: MessengerFriend[]; requestsCount?: number }> = (props) => {
    const { onlineFriends = [], requestsCount = 0 } = props;
    const [indexOffset, setIndexOffset] = useState(0);
    const [maxVisible, setMaxVisible] = useState(FRIEND_BAR_MAX_SLOTS);
    const elementRef = useRef<HTMLDivElement>(null);
    // The native staff conversation remains available in Friends/Chat; it does not occupy a bottom slot.
    const validFriends = useMemo(() => onlineFriends.filter(friend => friend && !isStaffChatIdentity(friend)), [onlineFriends]);

    useLayoutEffect(() => {
        const element = elementRef.current;

        if (!element) return;

        const rail = element.closest('.tb-nav-clip') as HTMLElement | null;
        const shell = element.closest('.tb-open-shell-right') as HTMLElement | null;

        const measure = () => {
            let next: number;

            if (rail && shell) {
                const frame = document.querySelector<HTMLElement>('.tb-frame');
                const reserved = AIR_RAIL_EDGE_GAP;
                const children = Array.from(shell.children).filter(child => getComputedStyle(child).display !== 'none') as HTMLElement[];
                const toolsWidth = children.filter(child => !child.contains(element)).reduce((sum, child) => sum + (child.offsetWidth || child.getBoundingClientRect().width), 0);
                const gap = parseFloat(getComputedStyle(shell).columnGap) || FRIEND_BAR_GAP;
                const shellSpacing = Math.max(0, children.length - 1) * gap;
                const leftToolbar = document.querySelector<HTMLElement>('.tb-open-shell:not(.tb-open-shell-right)');
                const leftEdge = leftToolbar?.getBoundingClientRect().right ?? window.innerWidth / 2;
                let available = Math.max(0, window.innerWidth - leftEdge - reserved - toolsWidth - shellSpacing);
                if (rail.classList.contains('habbix-social-dock')) {
                    // The centered rail needs equal clearance on both sides, including personal/event tools.
                    const own = rail.getBoundingClientRect();
                    const sideDocks = Array.from(document.querySelectorAll<HTMLElement>('.habbix-personal-dock,.habbix-event-dock'));
                    const clearance = sideDocks.reduce((max, dock) => {
                        const rect = dock.getBoundingClientRect();
                        if (rect.bottom <= own.top || rect.top >= own.bottom) return max;
                        return Math.max(max, rect.left < window.innerWidth / 2 ? rect.right + 12 : window.innerWidth - rect.left + 12);
                    }, 12);
                    available = Math.max(0, window.innerWidth - 2 * clearance - toolsWidth - shellSpacing - 18);
                }
                next = resolveFriendBarCapacity(available);
            } else {
                const left = element.getBoundingClientRect().left;
                const available = window.innerWidth - left - RIGHT_SAFE;
                next = resolveFriendBarCapacity(available);
            }

            setMaxVisible((prev) => (prev === next ? prev : next));
        };

        measure();

        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);

        observer?.observe(document.documentElement);
        if (rail) observer?.observe(rail);
        if (shell) observer?.observe(shell);
        const leftToolbar = document.querySelector<HTMLElement>('.tb-open-shell:not(.tb-open-shell-right)');
        if (leftToolbar) observer?.observe(leftToolbar);
        const changes = new MutationObserver(measure);
        if (shell) changes.observe(shell, { childList: true });
        if (rail) changes.observe(rail, { attributes: true, attributeFilter: ['class'] });
        const frame = document.querySelector('.tb-frame');
        if (frame) changes.observe(frame, { attributes: true, attributeFilter: ['data-chat-raised'] });
        window.addEventListener('resize', measure);

        return () => {
            observer?.disconnect();
            changes.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [requestsCount, validFriends.length]);

    const { maxOffset, safeOffset, canScrollLeft, canScrollRight, findFriendsSlots } = resolveFriendBarPage(validFriends.length, maxVisible, indexOffset);
    const visibleFriends = validFriends.slice(safeOffset, safeOffset + maxVisible);
    useEffect(() => setIndexOffset(previous => Math.min(previous, maxOffset)), [maxOffset]);

    return (
        <motion.div
            ref={elementRef}
            className="friend-bar friend-bar--paged flex h-[40px] items-center gap-[6px] px-0 py-[3px]"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
        >
            {(
                <motion.div variants={itemVariants} className="friend-bar-page-arrow">
                    <button
                        type="button"
                        disabled={!canScrollLeft}
                        aria-label={localizeWithFallback('friendbar.scroll.left', 'Vorherige Freunde')}
                        className={`friend-bar-button left ${!canScrollLeft ? 'is-disabled' : ''}`}
                        onClick={() => setIndexOffset(safeOffset - 1)}
                    >
                        <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden="true"><path d="M6 2 2 6l4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                </motion.div>
            )}

            <AnimatePresence mode="popLayout">
                {visibleFriends.map((friend) => (
                    <motion.div layout="position" key={friend.id} variants={itemVariants} initial="hidden" animate="visible" exit="exit">
                        <FriendBarItemView friend={friend} />
                    </motion.div>
                ))}
                {Array.from({length:Math.max(maxVisible===0?1:0,findFriendsSlots)},(_,index)=><motion.div layout="position" key={`empty-friend-${index}`} variants={itemVariants} initial="hidden" animate="visible" exit="exit"><FriendBarItemView friend={null}/></motion.div>)}
            </AnimatePresence>

            {(
                <motion.div variants={itemVariants} className="friend-bar-page-arrow">
                    <button
                        type="button"
                        disabled={!canScrollRight}
                        aria-label={localizeWithFallback('friendbar.scroll.right', 'Weitere Freunde')}
                        className={`friend-bar-button right ${!canScrollRight ? 'is-disabled' : ''}`}
                        onClick={() => setIndexOffset(safeOffset + 1)}
                    >
                        <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden="true"><path d="m2 2 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                </motion.div>
            )}
        </motion.div>
    );
};
