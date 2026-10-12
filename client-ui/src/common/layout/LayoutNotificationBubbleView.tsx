import { AnimatePresence, motion } from 'framer-motion';
import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { Flex, FlexProps } from '../Flex';

export interface LayoutNotificationBubbleViewProps extends FlexProps {
    fadesOut?: boolean;
    timeoutMs?: number;
    onClose: () => void;
}

export const LayoutNotificationBubbleView: FC<LayoutNotificationBubbleViewProps> = (props) => {
    const { fadesOut = true, timeoutMs = 8000, onClose = null, overflow = 'hidden', classNames = [], ...rest } = props;
    const [isVisible, setIsVisible] = useState(false);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;

    const getClassNames = useMemo(() => {
        const newClassNames: string[] = [
            'pointer-events-auto text-sm bg-[#1c1c20f2] px-[5px] py-[6px] [box-shadow:inset_0_5px_#22222799,inset_0_-4px_#12121599] ',
            'rounded',
            'octane-notification-bubble',
            'octane-swf-notification-bubble'
        ];

        if (classNames.length) newClassNames.push(...classNames);

        return newClassNames;
    }, [classNames]);

    useEffect(() => {
        setIsVisible(true);

        return () => setIsVisible(false);
    }, []);

    useEffect(() => {
        if (!fadesOut) return;

        let removal: ReturnType<typeof setTimeout>;
        const timeout = setTimeout(() => {
            setIsVisible(false);

            removal = setTimeout(() => closeRef.current?.(), 300);
        }, timeoutMs);

        return () => { clearTimeout(timeout); clearTimeout(removal); };
    }, [fadesOut, timeoutMs]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div className="notification-bubble-slot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <Flex overflow={overflow} classNames={getClassNames} onClick={onClose} {...rest} />
                </motion.div>
            )}
        </AnimatePresence>
    );
};
