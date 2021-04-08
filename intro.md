# Blitztime Typescript API Wrapper

There are two ways the Blitztime API uses to interact with a client: over HTTP and over Socket.IO (which is a wrapper around WebSockets, and also provides alternative transports). HTTP is used for one-way, individual, client-initiated requests. Socket.IO is used for two-way information exchange. This allows users to be notified in real time about changes, which is necessary for a timer.

This wrapper uses the `Duration` and `DateTime` objects from [Luxon](https://moment.github.io/luxon/) for managing times and dates.

## Creating an HTTP Client

You can create an HTTP client like so:
```js
const client = new HttpClient('https://api.blitz.red');
```

## Getting information on a timer

You can get information on a timer by ID using the `getTimer` method:
```js
const timer = await client.getTimer(139);
console.log(timer.id);    // 139
```

## Creating a timer

You can create a timer, given timer stage settings, with the `createTimer` method:
```js
const stage1 = StageSettings.create(
    startTurn: 0,
    fixedTimerPerTurn: Duration.fromMillis(0),
    incrementPerTurn: Duration.fromMillis(30 * 1000),
    initialTime: Duration.fromMillis(300 * 1000)
);
const stage2 = StageSettings.create(
    startTurn: 10,
    fixedTimePerTurn: Duration.fromMillis(60 * 1000),
    incrementPerTurn: Duration.fromMillis(0),
    initialTime: Duration.fromMillis(600 * 1000)
)
const creds = await client.createTimer([stage1, stage2]);
```
`createTimer` accepts a second parameter, `asManager`, which is a `boolean`. ``false`` (default), you will be added to the game as the host, and the token returned will be a player token. Otherwise, no host will be added and the token returned will be a manager token.

See "Connecting to a timer" below for how to use `creds`.

## Joining a timer

You can join as the away side of a timer with `joinTimer`:
```js
const creds = await client.joinTimer(491);
```

## Getting app usage stats

Stats on the usage of the app are available `getStats`:
```js
const stats = await client.getStats();
console.log(`Total timers alltime: ${stats.allTimers}`);
console.log(`Timers running right now: ${stats.ongoingTimers}`);
console.log(`Number of people playing or observing now: ${stats.connected}`);
```

## Connecting to a timer

You can connect to a timer, and create a Socket.IO client, like so:
```js
const socket = new TimerConnection(creds, 'https://api.blitz.red');
```
`creds` should be an object conforming to the `SocketCredentials` interface, as returned by `HttpClient#createTimer` or `HttpClient#joinTimer`. Alternatively, to observe a game, create an object with `timer` set to the ID of the timer:
```js
const socket = new TimerConenction({ timer: 494 }, 'https://api.blitz.red');
```

## Sending events

The following methods can be used to send events:
- `TimerConnection#startTimer` (called by host to start the timer once away has joined).
- `TimerConnection#endTurn` (called by the currently playing player to end their turn).
- `TimerConnection#opponentTimedOut` (called by the non-playing player when their opponent times out).

None of these methods accept paremeters, and they cannot be called by observers.

Additionally, `TimerConnection#addTime` can be called by a manager to add time to both clocks. It accepts one parameter, the number of seconds to add.

## Listening for events

You can register an event listener with `TimerConnection#addListener`. For example, to listen for timer state changes:
```js
socket.addListener('state_update', state => {
    console.log(state.turnNumber);
});
```
Or to listen for errors caused by events sent by the client:
```js
socket.addListener('error', error => {
    console.log(error.detail);
});
```
You can remove a listener with `TimerConnection#removeListener`:
```js
function connectListenerOnce() {
    console.log('Connected!');
    socket.removeListener(connectListenerOnce);
}
socket.addListener(connectListenerOnce);
```
The other available event types are `connect_error` and `disconnect`. Neither include data in the callback.
