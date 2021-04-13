/** Types returned or accepted by the server. */
import { DateTime, Duration, Interval } from 'luxon';

export function loadDateTime(seconds: number): DateTime {
    return DateTime.fromSeconds(seconds).toUTC();
}

export function loadOptionalDateTime(seconds: number | null): DateTime | null {
    return seconds === null ? null : loadDateTime(seconds);
}

export function loadDuration(seconds: number): Duration {
    return Duration.fromMillis(seconds * 1000);
}

/** The position of a user in a game. */
export enum UserPosition {
    OBSERVER = -2,
    MANAGER = -1,
    HOME = 0,
    AWAY = 1,
}

/** The state of a timer. */
export class Timer {
    id: number;
    turnNumber: number;
    turnStartedAt: DateTime | null;
    startedAt: DateTime | null;
    hasEnded: boolean;
    endReporter: UserPosition | null;
    home: TimerSide | null;
    away: TimerSide | null;
    settings: StageSettings[];
    observers: number;
    managed: boolean;

    constructor(data: Record<string, any>) {
        this.id = data.id;
        this.turnNumber = data.turn_number;
        this.turnStartedAt = loadOptionalDateTime(data.turn_started_at);
        this.startedAt = loadOptionalDateTime(data.started_at);
        this.hasEnded = data.has_ended;
        this.endReporter = data.end_reporter;
        this.home = data.home ? new TimerSide(data.home, this) : null;
        this.away = data.away ? new TimerSide(data.away, this) : null;
        this.settings = data.settings.map(
            (settings: Record<string, any>) => StageSettings.load(settings)
        );
        this.observers = data.observers;
        this.managed = data.managed;
    }

    /** Get the settings for the current stage. */
    get stageSettings(): StageSettings {
        const turn = this.turnNumber >= 0 ? this.turnNumber / 2 :  0;
        for (const stage of this.settings.slice().reverse()) {
            if (stage.startTurn <= turn) {
                return stage;
            }
        }
        throw Error('Invalid settings detected: no first stage.');
    }
}

/** The state of one side of a timer. */
export class TimerSide {
    isTurn: boolean;
    totalTimeLastTurn: Duration;
    connected: boolean;
    timer: Timer;

    constructor(data: Record<string, any>, timer: Timer) {
        this.isTurn = data.is_turn;
        this.totalTimeLastTurn = loadDuration(data.total_time);
        this.connected = data.connected;
        this.timer = timer;
    }

    /** Get the time remaining on the game clock right now. */
    totalTimeRemaining(): Duration {
        if (!this.timer.turnStartedAt) {
            return this.timer.stageSettings.initialTime;
        }
        if (!this.isTurn) {
            return this.totalTimeLastTurn;
        }
        let timeSpent = Interval.fromDateTimes(
            this.timer.turnStartedAt,
            DateTime.now().toUTC()
        ).toDuration();
        timeSpent = timeSpent.minus(this.timer.stageSettings.fixedTimePerTurn);
        if (timeSpent < Duration.fromMillis(0)) {
            return this.totalTimeLastTurn;
        }
        return this.totalTimeLastTurn.minus(timeSpent);
    }

    /** Get the time remaining on the turn clock right now. */
    turnTimeRemaining(): Duration {
        if (!this.timer.turnStartedAt || !this.isTurn) {
            return this.timer.stageSettings.fixedTimePerTurn;
        }
        const timeSpent = Interval.fromDateTimes(
            this.timer.turnStartedAt,
            DateTime.now().toUTC()
        ).toDuration();
        const timeRemaining = this.timer.stageSettings.fixedTimePerTurn
            .minus(timeSpent);
        if (timeRemaining > Duration.fromMillis(0)) {
            return timeRemaining;
        }
        return Duration.fromMillis(0);
    }

    /** Get the time at which this player will time out. */
    timesOutAt(): DateTime {
        if (!this.timer.turnStartedAt) {
            return DateTime.fromSeconds(Number.MAX_SAFE_INTEGER);
        }
        return this.timer.turnStartedAt
            .plus(this.totalTimeLastTurn)
            .plus(this.timer.stageSettings.fixedTimePerTurn);
    }
}

/** A side of a timer to join. */
export enum TimerJoinSide {
    HOME = 0,
    AWAY = 1
}

/** Settings for one stage of a timer. */
export class StageSettings {

    constructor(
        public startTurn: number,
        public fixedTimePerTurn: Duration,
        public incrementPerTurn: Duration,
        public initialTime: Duration
    ) {}

    /** Create settings for a new stage (allows destructuring). */
    static create({
        startTurn, fixedTimePerTurn, incrementPerTurn, initialTime
    }: {
        startTurn: number,
        fixedTimePerTurn: Duration,
        incrementPerTurn: Duration,
        initialTime: Duration
    }) {
        return new StageSettings(
            startTurn, fixedTimePerTurn, incrementPerTurn, initialTime
        );
    }

    static load(data: Record<string, any>) {
        return new StageSettings(
            data.start_turn,
            loadDuration(data.seconds_fixed_per_turn),
            loadDuration(data.seconds_incremement_per_turn),
            loadDuration(data.initial_seconds)
        );
    }

    dump(): Record<string, any> {
        return {
            start_turn: this.startTurn,
            seconds_fixed_per_turn: this.fixedTimePerTurn.toMillis() / 1000,
            seconds_incremement_per_turn:
                this.incrementPerTurn.toMillis() / 1000,
            initial_seconds: this.initialTime.toMillis() / 1000
        }
    }
}

/** Stats on app usage. */
export class AppStats {
    allTimers: number;
    ongoingTimers: number;
    connected: number;

    constructor(data: Record<string, any>) {
        this.allTimers = data.all_timers;
        this.ongoingTimers = data.ongoing_timers;
        this.connected = data.connected;
    }
}

/** Credentials for connecting to a socket. */
export interface SocketCredentials {
    timer: number;
    token?: string;
}

/** An error from the API. */
export class ApiError extends Error {
    code: number;
    detail: string;

    constructor(detail: string, code: number = 400) {
        super(detail);
        this.code = code;
        this.detail = detail;
    }
}
