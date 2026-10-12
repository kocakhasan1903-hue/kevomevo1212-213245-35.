import { useEffect } from 'react';
import { useMobileClient } from '../../hooks/useMobileClient';
import { useMobilePreferences } from '../toolbar/mobilePreferences';
import { MobileNoticeStack } from './MobileNoticeStack';
import { FC, ReactNode, useMemo } from 'react';
import { NotificationBubbleType } from '../../api';
import { useNotification } from '../../hooks';
import { GetAlertLayout } from './views/alert-layouts/GetAlertLayout';
import { GetBubbleLayout } from './views/bubble-layouts/GetBubbleLayout';
import { GetConfirmLayout } from './views/confirm-layouts/GetConfirmLayout';
import { HotelAlertToastView } from './views/HotelAlertToastView';
import { RightRailSlot } from '../right-side/RightNoticeRail';

export const NotificationCenterView: FC<{}> = (props) => {
    const mobile = useMobileClient();
    const preferences = useMobilePreferences();
    useEffect(() => {
        let wallet: HTMLElement | null = null;
        const resize = new ResizeObserver(() => measure());
        const measure = () => {
            const next = document.querySelector<HTMLElement>('.octane-purse-container');
            if (next !== wallet) { resize.disconnect(); wallet = next; if (wallet) resize.observe(wallet); }
            const bottom = wallet?.getBoundingClientRect().bottom ?? 96;
            document.documentElement.style.setProperty('--habbix-notification-top', `${Math.ceil(bottom + 10)}px`);
        };
        const observer = new MutationObserver(measure);
        observer.observe(document.body, {childList:true,subtree:true});
        window.addEventListener('resize',measure); measure();
        return () => {observer.disconnect();resize.disconnect();window.removeEventListener('resize',measure);document.documentElement.style.removeProperty('--habbix-notification-top');};
    }, []);
    const { alerts = [], bubbleAlerts = [], confirms = [], closeAlert = null, closeBubbleAlert = null, closeConfirm = null } = useNotification();

    const getAlerts = useMemo(() => {
        if (!alerts || !alerts.length) return null;

        const elements: ReactNode[] = [];

        for (const alert of alerts) {
            const element = GetAlertLayout(alert, () => closeAlert(alert));

            elements.push(element);
        }

        return elements;
    }, [alerts, closeAlert]);

    const getBubbleAlerts = useMemo(() => {
        if (!bubbleAlerts || !bubbleAlerts.length) return null;

        const elements: ReactNode[] = [];

        for (const alert of bubbleAlerts) {
            const element = GetBubbleLayout(alert, () => closeBubbleAlert(alert));

            if (alert.notificationType === NotificationBubbleType.CLUBGIFT) {
                elements.unshift(element);

                continue;
            }

            elements.push(element);
        }

        return elements;
    }, [bubbleAlerts, closeBubbleAlert]);

    const getConfirms = useMemo(() => {
        if (!confirms || !confirms.length) return null;

        const elements: ReactNode[] = [];

        for (const confirm of confirms) {
            const element = GetConfirmLayout(confirm, () => closeConfirm(confirm));

            elements.push(element);
        }

        return elements;
    }, [confirms, closeConfirm]);

    return (
        <>
            <RightRailSlot slot="notices">{mobile ? preferences.notices && <MobileNoticeStack count={bubbleAlerts.length}>{getBubbleAlerts}</MobileNoticeStack> : <div className="octane-rightside-notifications flex flex-col gap-1">{getBubbleAlerts}</div>}</RightRailSlot>
            <HotelAlertToastView />
            {getConfirms}
            {getAlerts}
        </>
    );
};
