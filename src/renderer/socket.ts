import EventEmitter from 'events';
import { Buffer } from 'buffer';

export enum Events {
    Authentication,
    Join,
    Leave,
    SetClient,
    SetClients,
    Signal
}

export default class Socket extends EventEmitter {
    ws?: WebSocket;
    serverURL: string;

    constructor(serverURL: string) {
        super();
        this.serverURL = serverURL.replace(/^http/, 'ws');

        this.connect();
    }

    connect() {
        this.ws = new WebSocket(this.serverURL);
        this.ws.binaryType = 'arraybuffer';
        this.ws.onopen = this.onOpen.bind(this);
        this.ws.onclose = this.onClose.bind(this);
        this.ws.onmessage = this.onMessage.bind(this);
    }

    close(code?: number, reason?: string) {
        this.ws?.close(code, reason);
    }

    onOpen(evt: Event) {
        this.emit('connect', evt);
    }

    onClose(evt: CloseEvent) {
        this.emit('disconnect', evt);

        setTimeout(() => {
            this.connect();
        }, 1000)
    }

    onMessage(evt: MessageEvent) {
        if (!(evt.data instanceof ArrayBuffer)) {
            this.close();
            return;
        }

        let buf = Buffer.from(evt.data);

        let type = buf.readUInt8(0);
        let len = buf.readUInt16BE(1);

        let data: any = null;

        if (len > 0) {
            data = JSON.parse(buf.slice(3).toString('utf8'));
        }

        switch (type) {
            case Events.Authentication:
                // TODO: Save own id
                this.emit('authenticate');
                break;
            case Events.Join:
                this.emit('join', data[0], data[1]);
                break;
            case Events.Leave:
                this.emit('leave');
                break;
            case Events.SetClient:
                // setId {id,playerId}
                this.emit('setClient', data[0], data[1]);
                break;
            case Events.Signal:
                // signal {from,data}
                this.emit('signal', data[0], data[1]);
                break;
            case Events.SetClients:
                // setIds {snowflake:Client,...}
                this.emit('setIds', data);
                break;
        }
    }

    send(type: number, data?: any) {
        if (!this.ws || this.ws.readyState != WebSocket.OPEN) {
            return;
        }

        let dataBuf: string|null = null;

        if (data) {
            dataBuf = JSON.stringify(data);
        }

        let dataLen = 3;

        if (dataBuf) {
            dataLen += dataBuf.length;
        }

        let buf = Buffer.alloc(dataLen);

        buf.writeUInt8(type, 0);
        buf.writeUInt16BE(dataBuf ? dataBuf.length : 0, 1);

        if (dataBuf) {
            buf.write(dataBuf, 3);
        }

        this.ws?.send(buf.buffer);
    }
}