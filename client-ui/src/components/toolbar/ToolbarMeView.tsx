import { CreateLinkEvent, GetSessionDataManager } from '@octane/renderer';
import { Dispatch, FC, PropsWithChildren, SetStateAction, useEffect, useRef } from 'react';
import { GetConfigurationValue, GetUserProfile, localizeWithFallback } from '../../api';
import { Flex } from '../../common';
import fortuneWheelIcon from '../../assets/images/toolbar/icons/fortune-wheel.svg';

export const ToolbarPersonalShortcuts: FC = () => <>
    {GetConfigurationValue('toolbar.fortunewheel.enabled', true) &&
        <button type="button" className="tb-slot habbix-personal-shortcut" title="Glücksrad" aria-label="Glücksrad" onClick={() => CreateLinkEvent('fortune-wheel/toggle')}>
            <img src={fortuneWheelIcon} alt="" />
        </button>}
    <button type="button" className="tb-slot habbix-personal-shortcut" title="Mein Profil" aria-label="Mein Profil" onClick={() => GetUserProfile(GetSessionDataManager().userId)}>
        <span className="octane-icon icon-me-profile" aria-hidden="true" />
    </button>
</>;

export const ToolbarMeView: FC<
    PropsWithChildren<{
        setMeExpanded: Dispatch<SetStateAction<boolean>>;
    }>
> = (props) => {
    const { setMeExpanded = null, children = null } = props;
    const elementRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onClick = (event: MouseEvent) => {
            if (elementRef.current && elementRef.current.contains(event.target as Node)) return;

            setMeExpanded(false);
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setMeExpanded(false);
        };
        document.addEventListener('keydown', onKeyDown);
        const timeout = window.setTimeout(() => document.addEventListener('click', onClick), 0);

        return () => {
            window.clearTimeout(timeout);
            document.removeEventListener('click', onClick);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [setMeExpanded]);

    return (
        <Flex
            alignItems="center"
            className="habbix-me-menu bg-[rgba(85,85,85,0.95)] border border-[solid] border-[#3d3d3d] [box-shadow:inset_2px_2px_rgba(255,255,255,.1),inset_-2px_-2px_rgba(0,0,0,.15)] rounded-[6px] p-2"
            gap={2}
            innerRef={elementRef}
        >
            <div className="navigation-item relative octane-icon icon-me-clothing cursor-pointer" onClick={(event) => CreateLinkEvent('avatar-editor/toggle')} />
            <div className="navigation-item relative octane-icon icon-me-settings cursor-pointer" onClick={(event) => CreateLinkEvent('user-settings/toggle')} />
            <div
                className="navigation-item relative octane-icon icon-me-forums cursor-pointer"
                onClick={(event) => CreateLinkEvent('groupforum/toggle')}
                title={localizeWithFallback('toolbar.icon.label.forums','Gruppenforen')}
            />
            {children}
        </Flex>
    );
};
