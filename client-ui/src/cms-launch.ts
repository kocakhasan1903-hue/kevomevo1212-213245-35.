export const readCmsLaunch = (href: string) => {
    const url = new URL(href);
    const fragment = new URLSearchParams(url.hash.slice(1));
    const ticket = fragment.get('sso') || url.searchParams.get('sso') || null;
    const room = url.searchParams.get('room');
    const friend = url.searchParams.get('friend');
    if (ticket) {
        url.searchParams.delete('sso');
        url.hash = '';
    }
    return { ticket, room, friend, cleanUrl: url.pathname + url.search + url.hash };
};
