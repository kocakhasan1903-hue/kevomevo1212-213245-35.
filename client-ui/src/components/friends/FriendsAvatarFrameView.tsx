import { FC } from 'react';
import { LayoutAvatarImageView } from '../../common';
import { useFriendAvatarStyle } from '../../hooks/habbix/nametag';
import { resolveAvatarFigure } from './views/friends-list/resolveAvatarFigure';

export const FriendsAvatarFrameView: FC<{name:string;figure:string;gender?:number}> = ({name,figure,gender}) => {
    const style=useFriendAvatarStyle(name);
    return <span className="hmx-avatar-frame" style={style}><LayoutAvatarImageView figure={resolveAvatarFigure(figure,gender)} headOnly nativeCroppedHead direction={2}/></span>;
};
