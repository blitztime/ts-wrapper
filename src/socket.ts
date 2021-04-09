/** Socket.IO client to connect to a timer socket. */
import { io, Socket } from 'socket.io-client';
import { ApiError, SocketCredentials, Timer } from './types';

/** The name of an event to add a listener for. */
export type EventName =
    'connect' |
    'connect_error' |
    'disconnect' |
    'state_update'|
    'error';

/** A connection to a timer socket. */
export class TimerConnection {
    socket: Socket;
    state: Timer | null;
    observer: boolean;
    listeners: Map<EventName, Array<(data: Record<string, any>) => void>>;

    /** Connect to the socket and set up listeners. */
    constructor(credentials: SocketCredentials, apiUrl: string) {
        const headers: Record<string, string> = {
            'Blitztime-Timer': credentials.timer.toString()
        };
        if (credentials.token) {
            headers['Authorization'] = credentials.token;
            this.observer = false;
        } else {
            this.observer = true;
        }
        this.socket = io(apiUrl, {
            extraHeaders: headers, autoConnect: false
        });
        const specialEvents: EventName[] = [
            'connect', 'connect_error', 'disconnect'];
        for (const event of specialEvents) {
            this.socket.on(event, () => this._triggerEvent(event, {}));
        }
        const timerConn = this;
        this.socket.on('state', state => {
            timerConn._onStateUpdate(state)
        });
        this.socket.on('error', error => {
            timerConn._onError(error)
        });
        this.state = null;
        this.listeners = new Map();
    }

    /** Open the connection. */
    connect() {
        if (!this.socket.connected) {
            this.socket.connect();
        }
    }

    /** Close the connection. */
    disconnect() {
        if (this.socket.connected) {
            this.socket.disconnect();
        }
    }

    /** Add a listener for an event. */
    addListener(
        event: EventName,
        listener: (data: Record<string, any>) => void
    ) {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.push(listener);
        } else {
            this.listeners.set(event,  [listener]);
        }
    }

    /** Remove an added listener. */
    removeListener(
        event: EventName,
        listener: (data: Record<string, any>) => void
    ) {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            this.listeners.set(event, eventListeners.filter(
                item => item !== listener
            ));
        }
    }

    /** Start the timer once away has joined (host only). */
    startTimer() {
        this.socket.emit('start_timer');
    }

    /** End the player's turn. */
    endTurn() {
        this.socket.emit('end_turn');
    }

    /** Notify the server that the player's opponent has timed out. */
    opponentTimedOut() {
        this.socket.emit('opponent_timed_out');
    }

    /** Add time to both player's clocks. */
    addTime(seconds: number) {
        this.socket.emit('add_time', seconds);
    }

    _onStateUpdate(rawState: Record<string, any>) {
        this.state = new Timer(rawState);
        this._triggerEvent('state_update', this.state);
    }

    _onError(rawError: Record<string, any>) {
        const error = new ApiError(rawError.detail);
        this._triggerEvent('error', error);
    }

    async _triggerEvent(name: EventName, data: Record<string, any>) {
        await Promise.all((this.listeners.get(name) || []).map(
            listener => listener(data)
        ));
    }
}
