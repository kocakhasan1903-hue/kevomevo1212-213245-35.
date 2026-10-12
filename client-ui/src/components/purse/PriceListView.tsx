import { OctaneCard } from '../../layout';
import { GetUserProfile } from '../../api';
import { LayoutAvatarImageView } from '../../common';
import { PriceListContent } from './PriceListContent';
import './PriceListView.css';
export function PriceListView({ onClose }: { onClose: () => void }) {
    return <OctaneCard uniqueKey="habbix-pricelist" className="habbix-pricelist resize-none"><OctaneCard.Header headerText="Preisliste" onCloseClick={onClose}/><PriceListContent openProfile={id=>GetUserProfile(id)} renderAvatar={figure=><LayoutAvatarImageView figure={figure} headOnly direction={3} nativeCroppedHead/>}/></OctaneCard>;
}
