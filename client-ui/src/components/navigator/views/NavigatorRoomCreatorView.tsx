import { FloorplanEditorView, FloorplanDraft } from '../../floorplan-editor/FloorplanEditorView';
import { CreateFlatMessageComposer } from '@octane/renderer';
import { FC, useMemo, useState } from 'react';
import { CreateLinkEvent, GetConfigurationValue, IRoomModel, LocalizeText, SendMessageComposer } from '../../../api';
import vipIconSmall from '../../../assets/images/navigator/air/icon-vip-small.png';
import { useNavigatorData, useNavigatorUiStore, useUserDataSnapshot, useUserPermissions } from '../../../hooks';
import './NavigatorRoomCreatorView.css';
import { useRoomCreatorStore } from './navigatorRoomCreatorStore';

const AIR_TRADE_KEYS = ['navigator.roomsettings.trade_not_allowed', 'navigator.roomsettings.trade_not_with_Controller', 'navigator.roomsettings.trade_allowed'];

const ROOM_LIMIT_HC = 75;
const ROOM_LIMIT_NON_SUBSCRIBER = 50;

const buildVisitorOptions = (limit: number) => {
    const values: string[] = [];

    for (let value = 10; value <= limit; value += 5) values.push(String(value));

    return values;
};

export const NavigatorRoomCreatorView: FC = () => {
    const { categories } = useNavigatorData();
    const { clubLevel, securityLevel } = useUserDataSnapshot();
    const permissions = useUserPermissions();
    // acc_navigator_staff; a server that sends no keys keeps Flash's staff level (4).
    const isNavigatorStaff = permissions.size ? permissions.get('acc_navigator_staff') === 1 : securityLevel >= 4;
    const beginCreate = useRoomCreatorStore((state) => state.beginCreate);

    const hcDisabled = GetConfigurationValue<boolean>('hc.disabled', false);
    const effectiveClubLevel = hcDisabled ? 2 : clubLevel;

    const [layoutOpen, setLayoutOpen] = useState(false);
    const [customLayout, setCustomLayout] = useState<FloorplanDraft>(null);
    const [name, setName] = useState('');
    const [nameTouched, setNameTouched] = useState(false);
    const [description, setDescription] = useState('');
    const [descriptionTouched, setDescriptionTouched] = useState(false);
    const [categoryIndex, setCategoryIndex] = useState(0);
    const [visitorsIndex, setVisitorsIndex] = useState(0);
    const [tradeIndex, setTradeIndex] = useState(0);
    const [nameError, setNameError] = useState<string>(null);
    const [roomModels] = useState<IRoomModel[]>(() => GetConfigurationValue<IRoomModel[]>('navigator.room.models') ?? []);
    const [selectedModelName, setSelectedModelName] = useState<string>(() => {
        const models = GetConfigurationValue<IRoomModel[]>('navigator.room.models');

        return models && models.length ? models[0].name : '';
    });

    const visibleModels = useMemo(() => roomModels.filter((model) => model.clubLevel >= 0 || isNavigatorStaff), [roomModels, isNavigatorStaff]);

    const selectableCategories = useMemo(
        () => (categories ?? []).filter((category) => category.visible && !category.automatic && (!category.staffOnly || isNavigatorStaff)),
        [categories, isNavigatorStaff]
    );

    const visitorOptions = useMemo(() => buildVisitorOptions(effectiveClubLevel >= 2 ? ROOM_LIMIT_HC : ROOM_LIMIT_NON_SUBSCRIBER), [effectiveClubLevel]);

    const safeCategoryIndex = categoryIndex < selectableCategories.length ? categoryIndex : 0;
    const safeVisitorsIndex = visitorsIndex < visitorOptions.length ? visitorsIndex : 0;

    const namePlaceholder = LocalizeText('navigator.createroom.roomnameinfo');
    const descriptionPlaceholder = LocalizeText('navigator.createroom.roomdescinfo');
    const tileSizeLabel = LocalizeText('navigator.createroom.tilesize');

    const getRoomModelImage = (modelName: string) => `${GetConfigurationValue<string>('images.url')}/navigator/models/model_${modelName}.png`;

    const closeCreator = () => useNavigatorUiStore.getState().closeCreator();

    const selectModel = (model: IRoomModel) => {
        if (model.clubLevel > 0 && effectiveClubLevel < model.clubLevel) {
            CreateLinkEvent('habboUI/open/hccenter');

            return;
        }

        if (model.clubLevel < 0 && !isNavigatorStaff) return;

        setSelectedModelName(model.name);
        setCustomLayout(null);
    };

    const createRoom = () => {
        const roomName = nameTouched ? name : '';

        if (roomName.trim().length <= 2) {
            setNameError(LocalizeText('navigator.createroom.nameerr'));

            return;
        }

        setNameError(null);

        if (useRoomCreatorStore.getState().isCreating) return;

        useRoomCreatorStore.getState().setPendingLayout(customLayout);
        beginCreate();

        const category = selectableCategories[safeCategoryIndex];

        SendMessageComposer(
            new CreateFlatMessageComposer(
                roomName,
                descriptionTouched ? description : '',
                `model_${selectedModelName}`,
                category ? category.id : 0,
                Number(visitorOptions[safeVisitorsIndex] ?? 10),
                tradeIndex
            )
        );
    };

    const isCreating = useRoomCreatorStore(state => state.isCreating);
    const selectedIndex = Math.max(0, visibleModels.findIndex(model => model.name === selectedModelName));
    const changeModel = (delta: number) => {
        const model = visibleModels[selectedIndex + delta];
        if (model) selectModel(model);
    };

    return <div className="habbix-room-create">
        {layoutOpen && <FloorplanEditorView externalSession={{ embedded: true, title: 'Dein Raumlayout entwerfen', tilemap: customLayout?.tilemap ?? Array(8).fill('00000000').join('\r'), draft: customLayout, onClose: () => setLayoutOpen(false), onSave: (tilemap, draft) => setCustomLayout(draft ?? { tilemap, doorX: 0, doorY: 0, doorDirection: 2, thicknessWall: 0, thicknessFloor: 0, wallHeight: -1 }) }} />}
        <div className="habbix-room-create__scroll" hidden={layoutOpen}>
            <section className="habbix-room-create__models" aria-label="Raumlayout wählen">
                <button type="button" className="habbix-room-create__arrow" aria-label="Vorheriges Modell" disabled={selectedIndex === 0} onClick={() => changeModel(-1)}>‹</button>
                <div className="habbix-room-create__model-window">
                    <div className="habbix-room-create__model-track">
                        {visibleModels.slice(Math.max(0, selectedIndex - 1), selectedIndex + 2).map(model => <button key={model.name} type="button" className={`habbix-room-create__model${!customLayout && selectedModelName === model.name ? ' is-selected' : ''}`} aria-label={`${model.tileSize} ${tileSizeLabel}`} aria-pressed={!customLayout && selectedModelName === model.name} onClick={() => selectModel(model)}>
                            <img className="habbix-room-create__model-image" src={getRoomModelImage(model.name)} alt="" />
                            <span>{model.tileSize} {tileSizeLabel}</span>
                            {model.clubLevel > 0 && <img className="habbix-room-create__club" src={vipIconSmall} alt="Club" />}
                        </button>)}
                    </div>
                </div>
                <button type="button" className="habbix-room-create__arrow" aria-label="Nächstes Modell" disabled={selectedIndex >= visibleModels.length - 1} onClick={() => changeModel(1)}>›</button>
            </section>
            <div className="habbix-room-create__fields">
                <label>Raumname<input maxLength={25} placeholder="Raumname" value={name} onChange={event => { setNameTouched(true); setNameError(null); setName(event.target.value); }} aria-invalid={!!nameError} /></label>
                <label>Kategorie<select value={safeCategoryIndex} onChange={event => setCategoryIndex(Number(event.target.value))}>{selectableCategories.map((category, index) => <option key={category.id} value={index}>{LocalizeText(category.name)}</option>)}</select></label>
                <label className="is-wide">Raumbeschreibung<textarea maxLength={128} placeholder="Raumbeschreibung" value={description} onChange={event => { setDescriptionTouched(true); setDescription(event.target.value); }} /></label>
                <label>Maximale Anzahl an Besuchern<select value={safeVisitorsIndex} onChange={event => setVisitorsIndex(Number(event.target.value))}>{visitorOptions.map((value, index) => <option key={value} value={index}>{value}</option>)}</select></label>
                <label>Tauscheinstellungen<select value={tradeIndex} onChange={event => setTradeIndex(Number(event.target.value))}>{AIR_TRADE_KEYS.map((key, index) => <option key={key} value={index}>{LocalizeText(key)}</option>)}</select></label>
                <div className="habbix-room-create__custom is-wide"><div><strong>{customLayout ? 'Eigenes Layout ausgewählt' : 'Eigener Grundriss'}</strong><small>{customLayout ? `${customLayout.tilemap.replace(/[x\r\n]/g, '').length} Felder · wird für deinen neuen Raum übernommen` : 'Boden, Höhen, Eingang und Wände selbst gestalten'}</small></div><button type="button" onClick={() => setLayoutOpen(true)}>{customLayout ? 'Layout bearbeiten' : 'Bodenlayout-Editor öffnen'}</button>{customLayout && <button type="button" onClick={() => setCustomLayout(null)}>Vorlage verwenden</button>}</div>
                {nameError && <p className="is-wide" role="alert">{nameError}</p>}
            </div>
        </div>
        <footer hidden={layoutOpen}><button type="button" disabled={isCreating || name.trim().length < 3 || !selectedModelName} onClick={createRoom}>{isCreating ? 'Raum wird erstellt …' : 'Raum erstellen'}</button></footer>
    </div>;
};
