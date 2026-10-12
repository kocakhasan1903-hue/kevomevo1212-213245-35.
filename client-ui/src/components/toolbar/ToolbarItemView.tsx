import { DetailedHTMLProps, HTMLAttributes, PropsWithChildren, Ref } from 'react';
import { HabbixActionIcon } from '../../common/HabbixActionIcon';
import { classNames } from '../../layout/classNames';
import { useMobileClient } from '../../hooks/useMobileClient';

const mobileLabels: Record<string, string> = { rooms: 'Räume', catalog: 'Shop', inventory: 'Inventar', camera: 'Kamera', game: 'Spiele', buildersclub: 'Bauen', friendall: 'Freunde', friendsearch: 'Suchen', message: 'Nachrichten', mentions: 'Erwähnungen', housekeeping: 'Verwaltung', modtools: 'Moderation', 'wired-tools': 'Wired', youtube: 'YouTube', soundboard: 'Sounds' };

type ToolbarItemViewProps = PropsWithChildren<{
    icon: string;
    ref?: Ref<HTMLDivElement>;
}> &
    DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>;

export const ToolbarItemView = ({ ref, icon = null, className = null, ...rest }: ToolbarItemViewProps) => {
    const mobile = useMobileClient();
    if (icon === 'message') return <div ref={ref} {...rest} role="button" tabIndex={rest.tabIndex ?? 0} aria-label={rest['aria-label'] || 'Nachrichten'} className={classNames('cursor-pointer relative habbix-message-tool', className)} onKeyDown={event => { rest.onKeyDown?.(event); if (!event.defaultPrevented && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.currentTarget.click(); } }}><HabbixActionIcon kind="chat"/>{mobile && <small>Nachrichten</small>}</div>;
    if (mobile) return <div ref={ref} {...rest} role="button" tabIndex={rest.tabIndex ?? 0}
        aria-label={rest['aria-label'] || mobileLabels[icon] || icon}
        className={classNames('cursor-pointer relative habbix-mobile-icon-button', className)}
        onKeyDown={event => { rest.onKeyDown?.(event); if (!event.defaultPrevented && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.currentTarget.click(); } }}>
        <span aria-hidden="true" className={`octane-icon icon-${icon} habbix-mobile-icon-art`} />
        <small aria-hidden="true">{mobileLabels[icon] || icon}</small>
    </div>;
    return <div ref={ref} className={classNames('cursor-pointer relative', `octane-icon icon-${icon}`, className)} {...rest} />;
};
