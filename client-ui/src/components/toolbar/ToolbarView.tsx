import { HabbixActionIcon } from '../../common/HabbixActionIcon';
import { MobileClientChrome } from './MobileClientChrome';
import { setMobilePreferences, useMobilePreferences } from './mobilePreferences';
import { useMobileClient } from '../../hooks/useMobileClient';
import priceListIcon from '../../assets/images/purse/pricelist.png';
import { PriceListView } from '../purse/PriceListView';
import nativeFootballIcon from '../../assets/images/icons/sign-soccer.png';
import nativeHotelLogo from '../../assets/images/toolbar/air/logo.png';
import footballIcon from '../tipp/football.png';
import hotelLogo from '../../assets/images/toolbar/hotel-logo.png';
import '../tipp/TippPanel.css';
import marketplaceIcon from '../../assets/images/toolbar/icons/marketplace.png';
import helpToolIcon from '../../assets/images/toolbar/icons/me-menu/helper-tool.png';
import eventPlanIcon from '../../assets/images/toolbar/events/eventplan.png';
import eventManagerIcon from '../../assets/images/toolbar/events/auction.png';
import moderationIcon from '../../assets/images/toolbar/events/modtools.png';
import { CreateLinkEvent, Dispose, DropBounce, EaseOut, FindNewFriendsMessageComposer, JumpBy, Motions, OctaneToolbarAnimateIconEvent, Queue, Wait, YouTubeRoomSettingsEvent } from '@octane/renderer';
import { AnimatePresence, motion, Variants } from 'framer-motion';
import { CSSProperties, FC, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { GetConfigurationValue, isHousekeepingEnabled, localizeWithFallback, MessengerIconState, OpenMessengerChat, SendMessageComposer, setYoutubeRoomEnabled, VisitDesktop } from '../../api';
import collapseLeftImg from '../../assets/images/toolbar/air/collapse-left.png';
import collapseRightImg from '../../assets/images/toolbar/air/collapse-right.png';
import dividerImg from '../../assets/images/toolbar/air/divider.png';
import memenuBgImg from '../../assets/images/toolbar/air/memenu-bg.png';
import memenuCircleImg from '../../assets/images/toolbar/air/memenu-circle.png';
import { Flex, LayoutAvatarImageView, LayoutItemCountView } from '../../common';
import { SoundboardRoomMessageEvent } from '../../events';
import { useFriends, useHasPermission, useInventoryUnseenTracker, useMentionsSnapshot, useMessageEvent, useMessenger, useModTools, useOctaneEvent, useSessionInfo, useSoundboard, useUiEvent, useUserRank, useWiredTools } from '../../hooks';
import { BottomDockLayout, resolveBottomDockLayout } from './bottomDockLayout';
import { ToolbarItemView } from './ToolbarItemView';
import { ToolbarMeView, ToolbarPersonalShortcuts } from './ToolbarMeView';
import { YouTubePlayerView } from './YouTubePlayerView';

const containerVariants: Variants = {
    hidden: { transition: { staggerChildren: 0.015, staggerDirection: -1 } },
    visible: { transition: { staggerChildren: 0.025 } }
};
const itemVariants: Variants = {
    hidden: { opacity: 0, y: 10, scale: 0.8 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 22 } }
};

const shellVariants: Variants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0 }
};

const SHELL_TRANSITION = { type: 'spring' as const, stiffness: 260, damping: 26 };
const NAV_TRANSITION = { type: 'spring' as const, stiffness: 300, damping: 28 };
const ME_POPOVER_TRANSITION = { type: 'tween' as const, duration: 0.22, ease: [0.22, 1, 0.36, 1] as [number,number,number,number] };
const LEFT_COLLAPSED_STORAGE_KEY = 'nitro.toolbar.leftCollapsed';
const RIGHT_COLLAPSED_STORAGE_KEY = 'nitro.toolbar.rightCollapsed';


const readCollapsedPreference = (key: string): boolean =>
{
    if(typeof window === 'undefined') return false;

    try
    {
        return window.localStorage.getItem(key) === '1';
    }
    catch
    {
        return false;
    }
};

export const ToolbarView: FC<{ isInRoom: boolean }> = props =>
{
    const { isInRoom } = props;
    const [hotelOnline,setHotelOnline]=useState<number | null>(null);
    useEffect(()=>{
        const receive=(event:MessageEvent)=>{
            if(event.source!==window.parent || event.origin!==window.location.origin) return;
            if(event.data?.type==='habbix-hotel-online' && Number.isSafeInteger(event.data.online) && event.data.online>=0) setHotelOnline(event.data.online);
        };
        window.addEventListener('message',receive);
        window.parent.postMessage({type:'habbix-client-online-ready'},window.location.origin);
        return()=>window.removeEventListener('message',receive);
    },[]);
    const [ isMeExpanded, setMeExpanded ] = useState(false);
    const [priceListOpen, setPriceListOpen] = useState(false);
    const isTouchLayout = useMobileClient();
    const [ leftCollapsed, setLeftCollapsed ] = useState(() => readCollapsedPreference(LEFT_COLLAPSED_STORAGE_KEY));
    const mobilePreferences = useMobilePreferences();
    const [ rightCollapsed, setRightCollapsed ] = useState(() => readCollapsedPreference(RIGHT_COLLAPSED_STORAGE_KEY));
    const [ dockLayout, setDockLayout ] = useState<BottomDockLayout>({ chatRaised: false, chatBottom: 7 });
    const [ staffStackBottom, setStaffStackBottom ] = useState<number | null>(null);
    const [ youtubeEnabled, setYoutubeEnabled ] = useState(false);
    const [ soundboardPulse, setSoundboardPulse ] = useState(false);
    const soundboardPulseTimerRef = useRef<number | null>(null);
    const leftDockRef = useRef<HTMLDivElement>(null);
    const rightDockRef = useRef<HTMLDivElement>(null);
    const { userFigure = null } = useSessionInfo();
    const { getFullCount = 0 } = useInventoryUnseenTracker();
    const { requests = [] } = useFriends();
    const { iconState = MessengerIconState.HIDDEN, unreadCount = 0 } = useMessenger();
    const { unreadCount: mentionsUnread = 0 } = useMentionsSnapshot();
    const mentionsEnabled = useMemo(() => GetConfigurationValue<boolean>('mentions_ui.enabled', true), []);
    const buildersClubEnabled = useMemo(() => GetConfigurationValue<boolean>('buildersclub.enabled', GetConfigurationValue<boolean>('toolbar.buildersclub.enabled', true)), []);
    const { openMonitor, showToolbarButton } = useWiredTools();
    const { enabled: soundboardEnabled, reset: resetSoundboard } = useSoundboard();
    const isMod = useHasPermission('acc_supporttool');
    const isHk = useHasPermission('acc_housekeeping');
    const { id: rankId } = useUserRank();
    const canManageEvents = rankId >= 6;
    const hkEnabled = useMemo(() => isHousekeepingEnabled(), []);
    const { tickets = [] } = useModTools();
    const openTicketsCount = useMemo(
        () => isMod ? tickets.filter(ticket => ticket && (ticket.state === 1)).length : 0,
        [ isMod, tickets ]
    );
    const visibilityVariant = 'visible';
    const touchLayout = isTouchLayout;
    const desktopBlockClasses = touchLayout ? 'hidden' : 'block';
    const desktopFlexClasses = touchLayout ? 'hidden' : 'flex';
    const socialInSideStack = touchLayout;
    const storiesEnabled = useMemo(() => GetConfigurationValue<boolean>('toolbar.stories.enabled', false), []);
    const [ messengerNotifyFrame, setMessengerNotifyFrame ] = useState(0);
    const chatFrameStyle = useMemo<CSSProperties | undefined>(() =>
    {
        if(touchLayout) return undefined;

        return { bottom: `${ dockLayout.chatBottom }px` };
    }, [ dockLayout.chatBottom, touchLayout ]);

    const railMaxWidthClass = (isInRoom && !dockLayout.chatRaised) ? 'max-w-[calc(50vw-242px)]' : 'max-w-[calc(50vw-12px)]';
    const chatFramePositionClass = touchLayout ? 'bottom-[90px]' : '';
    const leftNavVariants = useMemo<Variants>(() => ({
        hidden: { opacity: 0, x: isInRoom ? -10 : 0, y: isInRoom ? 0 : 8, pointerEvents: 'none' },
        visible: { opacity: 1, x: 0, y: 0, pointerEvents: 'auto' }
    }), [ isInRoom ]);
    const rightNavVariants = useMemo<Variants>(() => ({
        hidden: { opacity: 0, x: 10, pointerEvents: 'none' },
        visible: { opacity: 1, x: 0, pointerEvents: 'auto' }
    }), []);
    const mobileNavVariants = useMemo<Variants>(() => ({
        hidden: { opacity: 0, y: 8, pointerEvents: 'none' },
        visible: { opacity: 1, y: 0, pointerEvents: 'auto' }
    }), []);

    useMessageEvent<YouTubeRoomSettingsEvent>(YouTubeRoomSettingsEvent, event =>
    {
        const enabled = event.getParser().youtubeEnabled;
        setYoutubeEnabled(enabled);
        setYoutubeRoomEnabled(enabled);
    });

    useUiEvent<SoundboardRoomMessageEvent>(SoundboardRoomMessageEvent.ROOM_MESSAGE, () =>
    {
        setSoundboardPulse(true);
        if(soundboardPulseTimerRef.current !== null) window.clearTimeout(soundboardPulseTimerRef.current);
        soundboardPulseTimerRef.current = window.setTimeout(() =>
        {
            setSoundboardPulse(false);
            soundboardPulseTimerRef.current = null;
        }, 700);
    });

    useEffect(() => () =>
    {
        if(soundboardPulseTimerRef.current !== null) window.clearTimeout(soundboardPulseTimerRef.current);
    }, []);

    useEffect(() =>
    {
        if(!isInRoom)
        {
            setYoutubeEnabled(false);
            setYoutubeRoomEnabled(false);
            resetSoundboard();
        }
    }, [ isInRoom, resetSoundboard ]);


    useEffect(() =>
    {
        if(iconState !== MessengerIconState.UNREAD)
        {
            setMessengerNotifyFrame(0);
            return;
        }

        const interval = window.setInterval(() => setMessengerNotifyFrame(value => (value === 0 ? 1 : 0)), 500);

        return () => window.clearInterval(interval);
    }, [ iconState ]);

    useEffect(() =>
    {
        try
        {
            window.localStorage.setItem(LEFT_COLLAPSED_STORAGE_KEY, leftCollapsed ? '1' : '0');
        }
        catch
        {
        }
    }, [ leftCollapsed ]);

    useEffect(() =>
    {
        try
        {
            window.localStorage.setItem(RIGHT_COLLAPSED_STORAGE_KEY, rightCollapsed ? '1' : '0');
        }
        catch
        {
        }
    }, [ rightCollapsed ]);

    useLayoutEffect(() =>
    {
        if(touchLayout || !isInRoom) return;

        const leftDock = leftDockRef.current;
        const rightDock = rightDockRef.current;

        if(!leftDock || !rightDock) return;

        let frame = 0;

        const applyMeasurement = () =>
        {
            const leftRect = leftDock.getBoundingClientRect();
            const rightRect = rightDock.getBoundingClientRect();
            const leftEdge = leftRect.left + Math.max(leftRect.width, leftDock.scrollWidth);
            const rightEdge = rightRect.right - Math.max(rightRect.width, rightDock.scrollWidth);
            const next = resolveBottomDockLayout({
                viewportWidth: window.innerWidth,
                leftEdge,
                rightEdge
            });

            setDockLayout(previous => (
                previous.chatRaised === next.chatRaised && previous.chatBottom === next.chatBottom
                    ? previous
                    : next
            ));
        };

        const measure = () =>
        {
            window.cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(applyMeasurement);
        };

        applyMeasurement();

        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);

        observer?.observe(leftDock);
        observer?.observe(rightDock);
        observer?.observe(document.body);
        window.addEventListener('resize', measure);

        return () =>
        {
            window.cancelAnimationFrame(frame);
            observer?.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [
        buildersClubEnabled,
        canManageEvents,
        hkEnabled,
        iconState,
        isHk,
        isInRoom,
        isMod,
        leftCollapsed,
        mentionsEnabled,
        rightCollapsed,
        showToolbarButton,
        soundboardEnabled,
        touchLayout,
        youtubeEnabled
    ]);

    useEffect(() =>
    {
        const measure = () =>
        {
            const roomTools = document.querySelector('.octane-room-tools-container') as HTMLElement | null;
            const next = roomTools
                ? Math.max(8, Math.round(window.innerHeight - roomTools.getBoundingClientRect().top + 15))
                : null;

            setStaffStackBottom(prevValue => (prevValue === next ? prevValue : next));
        };

        measure();

        const interval = window.setInterval(measure, 400);
        window.addEventListener('resize', measure);

        return () =>
        {
            window.clearInterval(interval);
            window.removeEventListener('resize', measure);
        };
    }, [ isInRoom ]);

    const openYouTubePlayer = () => window.dispatchEvent(new CustomEvent('youtube:toggle'));

    useOctaneEvent<OctaneToolbarAnimateIconEvent>(OctaneToolbarAnimateIconEvent.ANIMATE_ICON, event =>
    {
        const animationIconToToolbar = (iconName: string, image: HTMLImageElement, x: number, y: number) =>
        {
            const target = (document.body.getElementsByClassName(iconName)[0] as HTMLElement);

            if(!target) return;

            image.className = 'toolbar-icon-animation';
            image.style.visibility = 'visible';
            image.style.left = (x + 'px');
            image.style.top = (y + 'px');

            document.body.append(image);

            const targetBounds = target.getBoundingClientRect();
            const imageBounds = image.getBoundingClientRect();
            const left = (imageBounds.x - targetBounds.x);
            const top = (imageBounds.y - targetBounds.y);
            const squared = Math.sqrt(((left * left) + (top * top)));
            const wait = (500 - Math.abs(((((1 / squared) * 100) * 500) * 0.5)));
            const height = 20;
            const motionName = (`ToolbarBouncing[${ iconName }]`);

            if(!Motions.getMotionByTag(motionName))
            {
                Motions.runMotion(new Queue(new Wait((wait + 8)), new DropBounce(target, 400, 12))).tag = motionName;
            }

            const motion = new Queue(new EaseOut(new JumpBy(image, wait, ((targetBounds.x - imageBounds.x) + height), (targetBounds.y - imageBounds.y), 100, 1), 1), new Dispose(image));

            Motions.runMotion(motion);
        };

        animationIconToToolbar('icon-inventory', event.image, event.x, event.y);
    });

    return (
        <>
            { youtubeEnabled && <YouTubePlayerView /> }
            {priceListOpen && <PriceListView onClose={() => setPriceListOpen(false)}/>}

            { isInRoom &&
                <div
                    data-chat-raised={ dockLayout.chatRaised ? 'true' : 'false' }
                    style={ chatFrameStyle }
                    className={ `tb-frame absolute ${ chatFramePositionClass } left-1/2 -translate-x-1/2 z-[71] flex h-[45px] w-[400px] max-w-[95vw] items-center p-0 pointer-events-none` }>
                    <Flex
                        alignItems="center"
                        justifyContent="center"
                        className="pointer-events-auto h-full w-full min-w-0 flex-1"
                        id="toolbar-chat-input-container" />
                </div> }

            <motion.div
                initial="visible"
                animate={ visibilityVariant }
                variants={ shellVariants }
                transition={ SHELL_TRANSITION }
                className={ `octane-toolbar octane-toolbar-hobba absolute bottom-0 left-0 right-0 z-[70] h-[60px] ${ desktopBlockClasses }` } />

            <motion.div
                ref={ leftDockRef }
                initial="visible"
                animate={ visibilityVariant }
                variants={ leftNavVariants }
                transition={ NAV_TRANSITION }
                className={ `tb-nav-clip habbix-bottom-rail habbix-main-dock ${leftCollapsed ? 'is-collapsed' : ''} absolute bottom-0 left-0 z-[71] h-[60px] ${ railMaxWidthClass } items-center ${ desktopFlexClasses }` }>
                <button type="button" className="habbix-dock-toggle" aria-expanded={!leftCollapsed}
                    aria-controls="habbix-desktop-navigation" aria-label={leftCollapsed ? 'Navigation ausklappen' : 'Navigation einklappen'}
                    onClick={() => { setMeExpanded(false); setLeftCollapsed(value => !value); }}><span aria-hidden="true" /></button>
                <motion.div
                    variants={ containerVariants }
                    id="habbix-desktop-navigation" inert={leftCollapsed} aria-hidden={leftCollapsed}
                    className="tb-open-shell flex h-[60px] max-w-full items-center overflow-visible bg-transparent">
                    <>
                    <motion.div variants={itemVariants} className="tb-slot tb-slot-compass">
                        <button className={`habbix-compass${!isInRoom ? " is-active" : ""}`} aria-pressed={!isInRoom} type="button" title="Hotel" aria-label={`Hotel, ${hotelOnline===null?'Onlinezahl wird geladen':hotelOnline+' online'}`} onClick={()=>VisitDesktop()}><img className="habbix-hotel-logo" src={touchLayout ? nativeHotelLogo : hotelLogo} alt=""/><span className="habbix-compass-divider"/><strong>{hotelOnline===null?'–':hotelOnline.toLocaleString('de-DE')}</strong></button>
                    </motion.div>
                    <motion.div variants={ itemVariants } className="tb-slot">
                        <ToolbarItemView icon="rooms" onClick={ () => CreateLinkEvent('navigator/toggle') } className="tb-icon" />
                    </motion.div>


                    { (!isInRoom && storiesEnabled) &&
                        <motion.div variants={ itemVariants } className="tb-slot">
                            <ToolbarItemView icon="stories" onClick={ () => CreateLinkEvent('stories/toggle') } className="tb-icon" />
                        </motion.div> }
                    </>
                    <motion.div variants={ itemVariants } className="tb-slot">
                        <ToolbarItemView icon="catalog" onClick={ () => CreateLinkEvent('catalog/toggle/normal') } className="tb-icon" />
                    </motion.div>

                    { isInRoom &&
                        <motion.div variants={ itemVariants } className="relative tb-slot tb-slot-inventory">
                            <ToolbarItemView icon="inventory" onClick={ () => CreateLinkEvent('inventory/toggle') } className="tb-icon" />
                            { (getFullCount > 0) &&
                                <LayoutItemCountView count={ getFullCount } className="absolute -right-1 top-0" /> }
                        </motion.div> }

                    { (isInRoom && showToolbarButton) &&
                        <motion.div variants={ itemVariants } className="tb-slot tb-slot-tall">
                            <ToolbarItemView icon="wired-tools" onClick={ openMonitor } className="tb-icon" />
                        </motion.div> }
                    <img src={ dividerImg } alt="" className="tb-divider" />
                    <>
                    { (isInRoom && youtubeEnabled) &&
                        <motion.div variants={ itemVariants } className="tb-slot">
                            <ToolbarItemView icon="youtube" onClick={ openYouTubePlayer } className="tb-icon" />
                        </motion.div> }
                    { (isInRoom && soundboardEnabled) &&
                        <motion.div variants={ itemVariants } className="tb-slot">
                            <ToolbarItemView icon="soundboard" onClick={ () => CreateLinkEvent('soundboard/toggle') } className={ `tb-icon ${ soundboardPulse ? 'animate-pulse' : '' }` } />
                        </motion.div> }
                    <motion.div variants={ itemVariants } className="relative tb-slot tb-slot-tall tb-slot-memenu">
                        <img src={ memenuBgImg } alt="" className="tb-memenu-bg" />
                        <AnimatePresence>
                            { (!touchLayout && isMeExpanded) &&
                                <motion.div
                                    initial={ { opacity: 0, y: 4 } }
                                    animate={ { opacity: 1, y: 0 } }
                                    exit={ { opacity: 0, y: 4 } }
                                    transition={ ME_POPOVER_TRANSITION }
                                    className="habbix-me-popover pointer-events-auto absolute bottom-[calc(100%+8px)] z-50">
                                    <ToolbarMeView setMeExpanded={ setMeExpanded } />
                                </motion.div> }
                        </AnimatePresence>
                        <motion.div
                            className={`tb-memenu-avatar${isMeExpanded ? ' is-open' : ''}`}
                            role="button" tabIndex={0} aria-label="Profilmenü" aria-expanded={isMeExpanded}
                            onKeyDown={event => { if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setMeExpanded(value => !value); } }}
                            onClick={ event =>
                            {
                                setMeExpanded(value => !value);
                                event.stopPropagation();
                            } }>
                            <LayoutAvatarImageView direction={2} figure={userFigure} headOnly nativeCroppedHead className="habbix-toolbar-avatar" />
                        </motion.div>
                        <img src={ memenuCircleImg } alt="" className="tb-memenu-circle" />
                    </motion.div>
                    { isInRoom &&
                        <motion.div variants={ itemVariants } className="tb-slot tb-slot-tall">
                            <ToolbarItemView icon="camera" onClick={ () => CreateLinkEvent('camera/toggle') } className="tb-icon" />
                        </motion.div> }

                    { (isHk && hkEnabled) &&
                        <motion.div variants={ itemVariants } className="tb-slot habbix-housekeeping-slot">
                            <ToolbarItemView icon="housekeeping" onClick={ () => CreateLinkEvent('housekeeping/toggle') } className="tb-icon" />
                        </motion.div> }
                    </>
                </motion.div>
            </motion.div>
            {!touchLayout && <motion.div initial="visible" animate={visibilityVariant} variants={containerVariants} className="habbix-personal-dock habbix-bottom-rail tb-open-shell flex" role="toolbar" aria-label="Persönliche Schnellzugriffe">
                    <ToolbarPersonalShortcuts />
                    <span className="habbix-personal-separator" role="separator" aria-orientation="vertical" />
                    <motion.div variants={itemVariants} className="tb-slot"><button type="button" className="tb-icon hmp-toolbar-button" title="Marktplatz" aria-label="Marktplatz" onClick={()=>CreateLinkEvent('marketplace/toggle')}><img src={marketplaceIcon} alt="" /></button></motion.div>
                    <motion.div variants={itemVariants} className="tb-slot"><button type="button" className="habbix-personal-price" title="Preisliste" aria-label="Preisliste" aria-expanded={priceListOpen} onClick={() => setPriceListOpen(open => !open)}><img src={priceListIcon} alt=""/></button></motion.div>
            </motion.div>}
            {!touchLayout && <div className="habbix-event-dock tb-open-shell tb-open-shell-right" role="toolbar" aria-label="Events und Hilfe">
                    <motion.div variants={itemVariants} className="tb-slot habbix-controller-slot">
                        <button type="button" aria-label="Eventplan" title="Eventplan" className="habbix-rail-tool habbix-controller-tool habbix-eventplan-tool" onClick={()=>CreateLinkEvent('eventplan/toggle')}><img src={eventPlanIcon} alt=""/></button>
                    </motion.div>
                    <motion.div variants={itemVariants} className="tb-slot habbix-controller-slot"><button type="button" aria-label="Habbico Tipp" title="Habbico Tipp" className="habbix-rail-tool habbix-controller-tool habbix-tipp-tool" onClick={()=>CreateLinkEvent('habbico-tipp/toggle')}><img src={touchLayout ? nativeFootballIcon : footballIcon} alt=""/></button></motion.div>
                    <span className="habbix-tools-separator" role="separator" aria-orientation="vertical" />
                    { mentionsEnabled &&
                        <motion.div variants={ itemVariants } className="relative tb-slot">
                            <ToolbarItemView icon="mentions" onClick={ () => CreateLinkEvent('mentions/toggle') } className="tb-icon" />
                            { (mentionsUnread > 0) &&
                                <LayoutItemCountView count={ mentionsUnread } className="absolute -right-2 -top-1" /> }
                        </motion.div> }
                    <motion.div variants={itemVariants} className="tb-slot">
                        <button type="button" aria-label="Habbohilfe" title="Habbohilfe" className="habbix-help-tool" onClick={()=>CreateLinkEvent('help/show')}><img src={helpToolIcon} alt=""/></button>
                    </motion.div>
                    { isMod && <motion.div variants={itemVariants} className="relative tb-slot">
                        <button type="button" aria-label="MOD-Tool" title="MOD-Tool" className="habbix-rail-tool" onClick={()=>CreateLinkEvent('mod-tools/toggle')}><img src={moderationIcon} alt=""/></button>
                        { (openTicketsCount > 0) && <LayoutItemCountView count={openTicketsCount} className="pointer-events-none absolute -right-1 -top-1 z-10" /> }
                    </motion.div> }
                    { canManageEvents && <motion.div variants={itemVariants} className="tb-slot">
                        <button type="button" aria-label="Eventmanager" title="Eventmanager" className="habbix-rail-tool" onClick={()=>CreateLinkEvent('events/toggle')}><img src={eventManagerIcon} alt=""/></button>
                    </motion.div> }
            </div>}
            <motion.div
                ref={ rightDockRef }
                initial="visible"
                animate={ visibilityVariant }
                variants={ rightNavVariants }
                transition={ NAV_TRANSITION }
                className={ `tb-nav-clip habbix-social-dock absolute bottom-0 z-[71] h-[60px] ${ railMaxWidthClass } items-center ${ desktopFlexClasses } ${ isInRoom ? 'right-0' : 'right-3' }` }>
                <motion.div
                    variants={ containerVariants }
                    className="tb-open-shell tb-open-shell-right flex h-[60px] max-w-full items-center overflow-visible bg-transparent">
                    <img src={ dividerImg } alt="" className="tb-divider" />

                    { !rightCollapsed && (<>
                    <div className={ `h-[40px] shrink-0 ${ desktopBlockClasses }` } id="toolbar-friend-bar-container-desktop" />
                    </>) }
                    { !rightCollapsed && <span className="habbix-social-separator" role="separator" aria-orientation="vertical" /> }
                    <motion.div variants={ itemVariants } className="relative tb-slot">
                        <ToolbarItemView icon="friendall" onClick={ () => CreateLinkEvent('friends/list') } className="tb-icon" />
                        { (requests.length > 0) &&
                            <LayoutItemCountView count={ requests.length } className="absolute -right-2 -top-1" /> }
                    </motion.div>
                    <motion.div variants={ itemVariants } className="relative tb-slot tb-slot-messenger">
                        <ToolbarItemView className={ `tb-icon ${ iconState === MessengerIconState.UNREAD ? (messengerNotifyFrame === 1 ? 'is-notify-1' : 'is-notify-0') : '' }` } icon="message" onClick={ () => OpenMessengerChat() } />
                        {unreadCount>0&&<span className="habbix-chat-unread habbix-unread-badge" aria-label={`${unreadCount} ungelesene Nachrichten`}>{unreadCount}</span>}
                    </motion.div>


                </motion.div>
                <button
                    type="button"
                    onClick={ () => setRightCollapsed(value => !value) }
                    aria-label={ localizeWithFallback('toolbar.icons.toggle', 'Show/hide icons') }
                    className="tb-collapse pointer-events-auto">
                    <img src={ rightCollapsed ? collapseLeftImg : collapseRightImg } alt="" />
                </button>
            </motion.div>
            {touchLayout && <MobileClientChrome onCollapse={() => setMeExpanded(false)}>
                <div className="habbix-mobile-nav-group">
                <motion.div
                    variants={ containerVariants }
                    className="tb-bar-scroll flex h-full min-w-0 flex-1 items-center gap-2 overflow-x-auto overflow-y-visible px-1">
                    <motion.div variants={ itemVariants }>
                        <button type="button" className="habbix-mobile-hotel" aria-label={isInRoom ? 'Hotelansicht öffnen' : 'Zum eigenen Raum'} onClick={() => isInRoom ? VisitDesktop() : CreateLinkEvent('navigator/goto/home')}><img className="habbix-hotel-logo" src={touchLayout ? nativeHotelLogo : hotelLogo} alt=""/><small>Hotel</small></button>
                    </motion.div>
                    <motion.div variants={ itemVariants }>
                        <ToolbarItemView icon="rooms" onClick={ () => CreateLinkEvent('navigator/toggle') } className="tb-icon" />
                    </motion.div>
                    { GetConfigurationValue('game.center.enabled') &&
                        <motion.div variants={ itemVariants }>
                            <ToolbarItemView icon="game" onClick={ () => CreateLinkEvent('games/toggle') } className="tb-icon" />
                        </motion.div> }
                    <motion.div variants={ itemVariants }>
                        <ToolbarItemView icon="catalog" onClick={ () => CreateLinkEvent('catalog/toggle/normal') } className="tb-icon" />
                    </motion.div>
                    <motion.div variants={ itemVariants } className="relative tb-slot tb-slot-tall tb-slot-memenu shrink-0">
                        <img src={ memenuBgImg } alt="" className="tb-memenu-bg" />
                        <motion.div
                            className={`tb-memenu-avatar${isMeExpanded ? ' is-open' : ''}`}
                            role="button" tabIndex={0} aria-label="Profilmenü" aria-expanded={isMeExpanded}
                            onKeyDown={event => { if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setMeExpanded(value => !value); } }}
                            onClick={ event =>
                            {
                                setMeExpanded(value => !value);
                                event.stopPropagation();
                            } }>
                            <LayoutAvatarImageView direction={2} figure={userFigure} headOnly nativeCroppedHead className="habbix-toolbar-avatar" />
                        </motion.div>
                        <img src={ memenuCircleImg } alt="" className="tb-memenu-circle" />
                    </motion.div>
                    { isInRoom &&
                        <motion.div variants={ itemVariants } className="relative">
                            <ToolbarItemView icon="inventory" onClick={ () => CreateLinkEvent('inventory/toggle') } className="tb-icon" />
                            { (getFullCount > 0) &&
                                <LayoutItemCountView count={ getFullCount } className="absolute -right-1 top-0" /> }
                        </motion.div> }
                </motion.div>
                <motion.div
                    variants={ containerVariants }
                    className="tb-bar-scroll flex h-full items-center gap-2 overflow-x-auto overflow-y-visible px-1">
                    { (isInRoom && showToolbarButton) &&
                        <motion.div variants={ itemVariants }>
                            <ToolbarItemView icon="wired-tools" onClick={ openMonitor } className="tb-icon" />
                        </motion.div> }
                { isInRoom &&
                    <motion.div variants={ itemVariants }>
                        <ToolbarItemView icon="camera" onClick={ () => CreateLinkEvent('camera/toggle') } className="tb-icon" />
                    </motion.div> }
                    { (isInRoom && youtubeEnabled) &&
                        <motion.div variants={ itemVariants }>
                            <ToolbarItemView icon="youtube" onClick={ openYouTubePlayer } className="tb-icon" />
                        </motion.div> }
                    { (isInRoom && soundboardEnabled) &&
                        <motion.div variants={ itemVariants }>
                            <ToolbarItemView icon="soundboard" onClick={ () => CreateLinkEvent('soundboard/toggle') } className={ `tb-icon ${ soundboardPulse ? 'animate-pulse' : '' }` } />
                        </motion.div> }
                    { /* On narrow desktop windows the social icons live in the
                         left side stack — only real touch devices get them here. */ }
                    { !socialInSideStack &&
                        <motion.div variants={ itemVariants } className="relative">
                            <ToolbarItemView icon="friendall" onClick={ () => CreateLinkEvent('friends/list') } className="tb-icon" />
                            { (requests.length > 0) &&
                                <LayoutItemCountView count={ requests.length } className="absolute -right-2 -top-1" /> }
                        </motion.div> }
                    { (!socialInSideStack && mentionsEnabled) &&
                        <motion.div variants={ itemVariants } className="relative">
                            <ToolbarItemView icon="mentions" onClick={ () => CreateLinkEvent('mentions/toggle') } className="tb-icon" />
                            { (mentionsUnread > 0) &&
                                <LayoutItemCountView count={ mentionsUnread } className="absolute -right-2 -top-1" /> }
                        </motion.div> }
                </motion.div>
                </div>
                <div className="habbix-mobile-extra-group">
                {touchLayout && <ToolbarPersonalShortcuts />}
                { touchLayout && buildersClubEnabled &&
                    <motion.div variants={ itemVariants }>
                        <ToolbarItemView icon="buildersclub" onClick={ () => CreateLinkEvent('catalog/toggle/builder') } className="tb-icon" />
                    </motion.div> }

                <motion.div variants={itemVariants} className="habbix-mobile-game-pair">
                    <button type="button" aria-label="Eventplan" title="Eventplan" className="habbix-rail-tool habbix-controller-tool habbix-eventplan-tool" onClick={()=>CreateLinkEvent('eventplan/toggle')}><img src={eventPlanIcon} alt=""/><small>Events</small></button><button type="button" aria-label="Habbico Tipp" title="Habbico Tipp" className="habbix-rail-tool habbix-controller-tool habbix-tipp-tool" onClick={()=>CreateLinkEvent('habbico-tipp/toggle')}><img src={touchLayout ? nativeFootballIcon : footballIcon} alt=""/><small>Tipp</small></button>
                </motion.div>
                { canManageEvents && <motion.div variants={itemVariants}>
                    <button type="button" aria-label="Eventmanager" title="Eventmanager" className="habbix-rail-tool" onClick={()=>CreateLinkEvent('events/toggle')}><img src={eventManagerIcon} alt=""/></button>
                </motion.div> }
                { isMod &&
                    <motion.div variants={ itemVariants } className="relative">
                        <ToolbarItemView icon="modtools" onClick={ () => CreateLinkEvent('mod-tools/toggle') } className="tb-icon" />
                        { (openTicketsCount > 0) &&
                            <LayoutItemCountView count={ openTicketsCount } className="pointer-events-none absolute -right-1 -top-1 z-10" /> }
                    </motion.div> }

                { /* Below the compact breakpoint the right rail's social icons
                     live in the stack — on narrow desktop windows too, so they
                     don't jump back into the bottom bar. Real touch devices
                     keep friends + mentions in the mobile bar instead. */ }
                { socialInSideStack &&
                    <motion.div variants={ itemVariants } className="relative">
                        <ToolbarItemView icon="friendall" onClick={ () => CreateLinkEvent('friends/list') } className="tb-icon" />
                        { (requests.length > 0) &&
                            <LayoutItemCountView count={ requests.length } className="pointer-events-none absolute -right-1 -top-1 z-10" /> }
                    </motion.div> }
                { socialInSideStack &&
                    <motion.div variants={ itemVariants }>
                        <ToolbarItemView icon="friendsearch" onClick={ () => SendMessageComposer(new FindNewFriendsMessageComposer()) } className="tb-icon" />
                    </motion.div> }
                { (socialInSideStack && mentionsEnabled) &&
                    <motion.div variants={ itemVariants } className="relative">
                        <ToolbarItemView icon="mentions" onClick={ () => CreateLinkEvent('mentions/toggle') } className="tb-icon" />
                        { (mentionsUnread > 0) &&
                            <LayoutItemCountView count={ mentionsUnread } className="pointer-events-none absolute -right-1 -top-1 z-10" /> }
                    </motion.div> }
                { (socialInSideStack && ((iconState === MessengerIconState.SHOW) || (iconState === MessengerIconState.UNREAD))) &&
                    <motion.div variants={ itemVariants } className="relative tb-slot-messenger">
                        <ToolbarItemView className={ `tb-icon ${ iconState === MessengerIconState.UNREAD ? (messengerNotifyFrame === 1 ? 'is-notify-1' : 'is-notify-0') : '' }` } icon="message" onClick={ () => OpenMessengerChat() } />
                        {unreadCount>0&&<span className="habbix-chat-unread habbix-unread-badge" aria-label={`${unreadCount} ungelesene Nachrichten`}>{unreadCount}</span>}
                    </motion.div> }
                {isInRoom && <button type="button" className="habbix-mobile-room-button" aria-label="Rauminformationen" aria-pressed={mobilePreferences.roomInfo} onClick={() => setMobilePreferences({ roomInfo: !mobilePreferences.roomInfo })}>ⓘ</button>}
                { (isHk && hkEnabled) &&
                    <motion.div variants={ itemVariants }>
                        <ToolbarItemView icon="housekeeping" onClick={ () => CreateLinkEvent('housekeeping/toggle') } className="tb-icon" />
                    </motion.div> }
                </div>
            </MobileClientChrome>}
            {touchLayout && <div className="habbix-mobile-social">
                {mobilePreferences.friends && <div id="toolbar-friend-bar-container-mobile" />}
                <button type="button" className="habbix-mobile-social-button" aria-label="Freundesliste öffnen" onClick={() => CreateLinkEvent('friends/list')}><HabbixActionIcon kind="options"/>{requests.length > 0 && <span className="habbix-unread-badge">{requests.length}</span>}</button>
                <button type="button" className="habbix-mobile-social-button" aria-label="Nachrichten öffnen" onClick={() => OpenMessengerChat()}><HabbixActionIcon kind="chat"/>{unreadCount > 0 && <span className="habbix-unread-badge">{unreadCount}</span>}</button>
            </div>}
            <AnimatePresence>{touchLayout && isMeExpanded && mobilePreferences.sidebarOpen && <motion.div className="habbix-mobile-profile-popover" initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:4}} transition={ME_POPOVER_TRANSITION}><ToolbarMeView setMeExpanded={setMeExpanded}/></motion.div>}</AnimatePresence>

        </>
    );
};



