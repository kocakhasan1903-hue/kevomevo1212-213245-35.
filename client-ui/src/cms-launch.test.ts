import { describe, expect, it } from 'vitest';
import { readCmsLaunch } from './cms-launch';
describe('HabboJe client launch', () => {
    it('reads the existing CMS fragment without exposing it in the clean address', () => {
        expect(readCmsLaunch('https://hotel.test/client/#sso=test%2Bticket')).toEqual({
            ticket: 'test+ticket', room: null, friend: null, cleanUrl: '/client/'
        });
    });
    it('preserves room forwarding and accepts upstream query launches', () => {
        expect(readCmsLaunch('https://hotel.test/client/?sso=query&room=42&friend=9')).toEqual({
            ticket: 'query', room: '42', friend: '9', cleanUrl: '/client/?room=42&friend=9'
        });
    });
    it('allows the Octane login screen when no CMS ticket was supplied', () => {
        expect(readCmsLaunch('https://hotel.test/client/').ticket).toBeNull();
    });
});
