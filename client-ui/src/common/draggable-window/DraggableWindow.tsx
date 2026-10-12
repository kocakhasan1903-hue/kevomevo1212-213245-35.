import {
    CSSProperties,
    FC,
    Key,
    MouseEvent as ReactMouseEvent,
    ReactNode,
    TouchEvent as ReactTouchEvent,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState
} from 'react';
import { createPortal } from 'react-dom';
import { DraggableWindowPosition } from './DraggableWindowPosition';
import { useSmartMode } from '../../hooks/habbix/useSmartMode';

const CURRENT_WINDOWS: HTMLElement[] = [];
const BOUNDS_THRESHOLD_TOP: number = 0;
const BOUNDS_THRESHOLD_LEFT: number = 0;
const TOOLBAR_CLEARANCE: number = 64;
const DRAG_START_THRESHOLD_PX: number = 3;

export interface DraggableWindowProps {
    uniqueKey?: Key;
    handleSelector?: string;
    windowPosition?: string;
    disableDrag?: boolean;
    dragStyle?: CSSProperties;
    offsetLeft?: number;
    offsetTop?: number;
    children?: ReactNode;
}

export const DraggableWindow: FC<DraggableWindowProps> = (props) => {
    const {settings:smart}=useSmartMode();
    const {
        uniqueKey = null,
        handleSelector = '.drag-handler',
        windowPosition = DraggableWindowPosition.CENTER,
        disableDrag = false,
        dragStyle = {},
        children = null,
        offsetLeft = 0,
        offsetTop = 0
    } = props;
    const [delta, setDelta] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [isPositioned, setIsPositioned] = useState(false);
    const [dragHandler, setDragHandler] = useState<HTMLElement>(null);
    const elementRef = useRef<HTMLDivElement>(null);
    const offsetRef = useRef({ x: 0, y: 0 });
    const deltaRef = useRef({ x: 0, y: 0 });
    const hasDraggedRef = useRef(false);
    const dragRef = useRef<{ pointerId: number; startX: number; startY: number; active: boolean } | null>(null);
    const bringToTop = useCallback(() => {
        let zIndex = 400;
        for (const existingWindow of CURRENT_WINDOWS) {
            zIndex += 1;
            existingWindow.style.zIndex = zIndex.toString();
        }
    }, []);

    const moveCurrentWindow = useCallback(() => {
        const index = CURRENT_WINDOWS.indexOf(elementRef.current);
        if (index === -1) {
            CURRENT_WINDOWS.push(elementRef.current);
        } else if (index === CURRENT_WINDOWS.length - 1) return;
        else if (index >= 0) {
            CURRENT_WINDOWS.splice(index, 1);
            CURRENT_WINDOWS.push(elementRef.current);
        }
        bringToTop();
    }, [bringToTop]);

    const onMouseDown = useCallback(
        (event: ReactMouseEvent<HTMLDivElement>) => {
            moveCurrentWindow();
        },
        [moveCurrentWindow]
    );

    const onTouchStart = useCallback(
        (event: ReactTouchEvent<HTMLDivElement>) => {
            moveCurrentWindow();
        },
        [moveCurrentWindow]
    );

    const clampPosition = useCallback((newX: number, newY: number) => {
        if (!elementRef.current) return { x: newX, y: newY };

        const windowWidth = elementRef.current.offsetWidth;
        const windowHeight = elementRef.current.offsetHeight;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const clampedX = Math.max(BOUNDS_THRESHOLD_LEFT, Math.min(newX, Math.max(0, viewportWidth - windowWidth)));
        const clampedY = Math.max(BOUNDS_THRESHOLD_TOP, Math.min(newY, Math.max(0, viewportHeight - TOOLBAR_CLEARANCE - windowHeight)));

        return { x: clampedX, y: clampedY };
    }, []);

    const centerWindow = useCallback(() => {
        const element = elementRef.current;
        if (!element) return;
        const width = element.offsetWidth || 340;
        const height = element.offsetHeight || 462;
        const position = clampPosition((window.innerWidth - width) / 2, (window.innerHeight - height) / 2);
        offsetRef.current = position;
        setOffset(position);
    }, [clampPosition]);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;
        const keepVisible = () => {
            if (!hasDraggedRef.current) { centerWindow(); return; }
            const position = clampPosition(offsetRef.current.x, offsetRef.current.y);
            if (position.x !== offsetRef.current.x || position.y !== offsetRef.current.y) {
                offsetRef.current = position;
                setOffset(position);
            }
        };
        const observer = new ResizeObserver(keepVisible);
        observer.observe(element);
        window.addEventListener('resize', keepVisible);
        return () => { observer.disconnect(); window.removeEventListener('resize', keepVisible); };
    }, [centerWindow, clampPosition]);

    useLayoutEffect(() => {
        const element = elementRef.current as HTMLElement;
        if (!element) return;

        CURRENT_WINDOWS.push(element);
        bringToTop();

        if (!disableDrag) {
            const handle = element.querySelector(handleSelector);
            if (handle) setDragHandler(handle as HTMLElement);
        }

        hasDraggedRef.current = false;
        centerWindow();
        deltaRef.current = { x: 0, y: 0 };
        setDelta({ x: 0, y: 0 });
        setIsPositioned(true);

        return () => {
            const index = CURRENT_WINDOWS.indexOf(element);
            if (index >= 0) CURRENT_WINDOWS.splice(index, 1);
        };
    }, [handleSelector, windowPosition, uniqueKey, disableDrag, offsetLeft, offsetTop, bringToTop, centerWindow]);


    useEffect(() => {
        if (!dragHandler) return;

        const onPointerDown = (event: PointerEvent) => {
            if ((event.target as HTMLElement)?.closest?.('button, input, select, textarea, a')) return;
            if (event.pointerType === 'mouse' && event.button !== 0) return;

            dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false };
            deltaRef.current = { x: 0, y: 0 };
        };

        const onPointerMove = (event: PointerEvent) => {
            const drag = dragRef.current;
            if (!drag || event.pointerId !== drag.pointerId) return;

            if (!drag.active) {
                if (Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) < DRAG_START_THRESHOLD_PX) return;

                drag.active = true;
                hasDraggedRef.current = true;

                try {
                    dragHandler.setPointerCapture(event.pointerId);
                } catch {}

                setIsDragging(true);
            }

            const clampedPos = clampPosition(offsetRef.current.x + (event.clientX - drag.startX), offsetRef.current.y + (event.clientY - drag.startY));
            const nextDelta = { x: clampedPos.x - offsetRef.current.x, y: clampedPos.y - offsetRef.current.y };

            deltaRef.current = nextDelta;
            setDelta(nextDelta);
        };

        const onPointerEnd = (event: PointerEvent) => {
            const drag = dragRef.current;
            if (!drag || event.pointerId !== drag.pointerId) return;

            dragRef.current = null;

            if (!drag.active) return;

            try {
                dragHandler.releasePointerCapture(event.pointerId);
            } catch {}

            const clampedPos = clampPosition(offsetRef.current.x + deltaRef.current.x, offsetRef.current.y + deltaRef.current.y);

            deltaRef.current = { x: 0, y: 0 };
            offsetRef.current = clampedPos;
            setDelta({ x: 0, y: 0 });
            setOffset(clampedPos);
            setIsDragging(false);

        };

        dragHandler.addEventListener('pointerdown', onPointerDown);
        dragHandler.addEventListener('pointermove', onPointerMove);
        dragHandler.addEventListener('pointerup', onPointerEnd);
        dragHandler.addEventListener('pointercancel', onPointerEnd);

        return () => {
            dragHandler.removeEventListener('pointerdown', onPointerDown);
            dragHandler.removeEventListener('pointermove', onPointerMove);
            dragHandler.removeEventListener('pointerup', onPointerEnd);
            dragHandler.removeEventListener('pointercancel', onPointerEnd);
        };
    }, [dragHandler, uniqueKey, clampPosition]);

    useEffect(()=>{
        const element=elementRef.current;
        if(!element||String(uniqueKey)==='habbix-smart-mode')return;
        const close=()=>{
            if(element.querySelector('[data-smart-mode-protect],.hmp-confirm,.habbix-profile-editor,.hcn-window,.octane-avatar-editor,.octane-wired,[class*=trade],.hmx-input input:focus,textarea:focus'))return;
            element.querySelector<HTMLButtonElement>('.octane-card-close-button,.hfl-close,.messenger-minimize,.octane-camera-capture__close,.octane-navigator-air__close:not(.octane-navigator-air__help),.hmp-window-header>button')?.click();
        };
        let idle:ReturnType<typeof setTimeout>;
        const resetIdle=()=>{clearTimeout(idle);if(smart.idleSeconds>0)idle=setTimeout(close,smart.idleSeconds*1000);};
        const outside=(event:PointerEvent)=>{const target=event.target as HTMLElement;if(smart.outside&&!element.contains(target)&&!target?.closest('[data-radix-popper-content-wrapper],.octane-purse-container,.habbix-smart-window'))close();resetIdle();};
        const keyboard=(event:KeyboardEvent)=>{if(smart.escape&&event.key==='Escape'&&!event.defaultPrevented&&CURRENT_WINDOWS.at(-1)===element){event.preventDefault();close();}resetIdle();};
        window.addEventListener('pointerdown',outside);window.addEventListener('keydown',keyboard);element.addEventListener('pointermove',resetIdle);resetIdle();
        return()=>{clearTimeout(idle);window.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',keyboard);element.removeEventListener('pointermove',resetIdle);};
    },[smart.outside,smart.escape,smart.idleSeconds,uniqueKey]);

    return createPortal(
        <div
            ref={elementRef}
            className="absolute draggable-window"
            data-window-key={uniqueKey ?? undefined}
            data-window-ready={isPositioned ? 'true' : 'false'}
            style={{
                ...dragStyle,
                opacity:String(uniqueKey)==='habbix-smart-mode'?1:smart.opacity/100,
                left: 0,
                top: 0,
                transform: `translate3d(${Math.round(offset.x + delta.x)}px, ${Math.round(offset.y + delta.y)}px, 0)`,
                willChange: isDragging ? 'transform' : undefined,
                backfaceVisibility: 'hidden',
                visibility: isPositioned ? 'visible' : 'hidden'
            }}
            onMouseDownCapture={onMouseDown}
            onTouchStartCapture={onTouchStart}
        >
            {children}
        </div>,
        document.getElementById('draggable-windows-container')
    );
};
