import { IMessageDataWrapper, IMessageParser } from '@octane/api';

export class RoomInviteParser implements IMessageParser
{
    private _senderId: number;
    private _messageText: string;
    private _roomId: number = 0;

    public flush(): boolean
    {
        this._senderId = 0;
        this._messageText = null;
        this._roomId = 0;

        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._senderId = wrapper.readInt();
        this._messageText = wrapper.readString();
        this._roomId = wrapper.bytesAvailable && (wrapper.remainingBytes === undefined || wrapper.remainingBytes >= 4) ? Math.max(0, wrapper.readInt()) : 0;

        return true;
    }

    public get senderId(): number
    {
        return this._senderId;
    }

    public get roomId(): number { return this._roomId; }

    public get messageText(): string
    {
        return this._messageText;
    }
}
