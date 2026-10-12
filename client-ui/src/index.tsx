import { installMobileClientDetection } from './hooks/useMobileClient';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import { App } from './App';
import { LoadingView } from './components/loading/LoadingView';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false
        }
    }
});

import './css/habbo/HabboTheme.css';
import './css/index.css';

import './css/avatar-editor/AvatarEditorView.css';
import './css/backgrounds/BackgroundsView.css';
import './css/badges/BadgeLeaderboardView.css';
import './css/catalog/CatalogView.css';
import './css/catalog/CatalogExperience.css';
import './css/catalog/CatalogVipBuyView.css';
import './css/emustats/EmuStatsView.css';
import './css/floorplan-editor/FloorplanEditorView.css';

import './css/chat/Chats.css';
import './css/chat/ChatHistoryView.css';
import './css/chat/ChatInputMentionSelectorView.css';
import './css/chat/ChatInputHabbiconSelectorView.css';
import './css/mentions/MentionToasts.css';
import './css/mentions/MentionsPanel.css';

import './css/common/Buttons.css';
import './css/habbo/HabboSkin.css';
import './css/common/PrefixEffects.css';

import './css/forms/form_select.css';

import './css/friends/FriendsView.css';
import './css/fortune-wheel/FortuneWheelView.css';
import './css/groups/GroupView.css';

import './css/game-center/GameCenterView.css';

import './css/help/HelpView.css';
import './css/housekeeping/HousekeepingView.css';

import './css/hotelview/HotelView.css';

import './css/login/LoginView.css';

import './css/icons/icons.css';

import './css/inventory/InventoryView.css';
import './css/inventory/InventoryAnimals.css';
import './css/inventory/InventoryBadges.css';
import './css/inventory/InventoryFilters.css';

import './css/layout/LayoutTrophy.css';

import './css/octanecard/OctaneCardView.css';
import './css/achievements/AchievementsView.css';

import './css/notification/NotificationCenterView.css';
import './css/notification/HotelAlertToast.css';

import './css/purse/PurseView.css';
import './css/radio/RadioView.css';

import './css/room/InfoStand.css';
import './css/room/NavigatorRoomInfo.css';
import './css/room/NavigatorRoomSettings.css';
import './css/room/RoomWidgets.css';
import './css/room/WiredVariableFx.css';

import './css/slider.css';

import './css/toolbar/ToolBar.css';
import './css/user-profile/UserProfileView.css';
import './css/user-settings/UserSettingsView.css';

import './css/vault/VaultView.css';
import './css/widgets/FurnitureWidgets.css';
import './css/WiredView.css';
import './css/camera/CameraWidget.css';
import './css/catalog/CatalogGiftView.css';
import './css/navigator/NavigatorView.css';
import './css/common/ClassicScrollbar.css';
import './css/habbo/HabbixGlass.css';

document.documentElement.classList.add('has-classic-scrollbar');
const stopMobileDetection = installMobileClientDetection();
if (import.meta.hot) import.meta.hot.dispose(stopMobileDetection);

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <ErrorBoundary
                fallbackRender={({ error }) => (
                    <LoadingView
                        isError={true}
                        message={`Something went wrong.\n${(error as Error)?.message ?? 'Unknown error'}`}
                        homeUrl={window.location.origin + '/'}
                    />
                )}
            >
                <App />
            </ErrorBoundary>
        </QueryClientProvider>
    </StrictMode>
);

import './css/habbo/HabbixReference.css';
import './css/habbo/HabbixClientChrome.css';

import './css/habbo/HabbixProfiles.css';

import './css/habbo/HabbixProfileEditor.css';

import './css/habbo/HabbixChatRepair.css';
import './css/habbo/HabbixWindowRepair.css';
import './css/habbo/HabbixWindowPolish.css';
import './css/habbo/HabbixReferenceRefinement.css';
import './css/habbo/HabbixRoomParity.css';
import './css/habbo/HabbixNavigatorHelp.css';
import './css/habbo/HabbixSocialModParity.css';
import './css/habbo/HabbixToolbarEvents.css';

import './css/habbo/HabbixClientControls.css';



import './css/habbo/HabbixMotion.css';
import './css/habbo/HabbixDockLayout.css';
import './css/habbo/HabbixWindowIdentity.css';
import './css/habbo/HabbixViewportLayout.css';
import './css/habbo/HabbixMobileLayout.css';
import './css/habbo/HabbixPalette.css';
import './css/habbo/HabbixRoomComposer.css';
import './css/habbo/HabbixWindowRefresh.css';
import './css/habbo/HabbixMobileControls.css';
import './css/habbo/HabbixMobileExperience.css';
import './css/habbo/HabbixClientRepair.css';
import './css/habbo/HabbixHousekeepingTheme.css';
import './css/habbo/HabbixClientPolish.css';

// Track the usable viewport on phones when the virtual keyboard opens.
if (window.visualViewport) {
    const updateMobileViewport = () => {
        const viewport = window.visualViewport;
        document.documentElement.style.setProperty('--habbix-mobile-height', `${viewport.height}px`);
        document.documentElement.style.setProperty('--habbix-mobile-top', `${viewport.offsetTop}px`);
        document.documentElement.classList.toggle('habbix-keyboard-open', document.documentElement.classList.contains('habbix-mobile-client') && window.innerHeight - viewport.height > 150);
    };
    window.visualViewport.addEventListener('resize', updateMobileViewport);
    window.visualViewport.addEventListener('scroll', updateMobileViewport);
    window.addEventListener('resize', updateMobileViewport);
    updateMobileViewport();
}
