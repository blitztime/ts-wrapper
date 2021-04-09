/** Wrappers for the HTTP endpoints. */
import axios, { AxiosInstance, AxiosRequestConfig, Method } from "axios";
import {
    ApiError,
    AppStats,
    SocketCredentials,
    StageSettings,
    Timer,
    TimerJoinSide
} from "./types";

interface JsonObject extends Record<string, Json> {}
type Json = Json[]|string|number|boolean|null|JsonObject;

/** A client for making requests to HTTP endpoints. */
export class HttpClient {
    client: AxiosInstance;

    /** Set up the Axios client. */
    constructor(apiUrl: string) {
        this.client = axios.create({ baseURL: apiUrl });
    }

    /** Send a request and handle errors in the response. */
    async _request(
        method: Method, endpoint: string, body: Json | undefined = undefined
    ): Promise<Record<string, any>> {
        const config: AxiosRequestConfig = {
            url: endpoint,
            method: method,
        };
        if (body !== undefined) config.data = body;
        const response = await this.client.request(config);
        if (response.status >= 400) {
            throw new ApiError(response.data.detail, response.status);
        }
        return response.data;
    }

    /** Get usage stats for the app. */
    async getStats(): Promise<AppStats> {
        const response = await this._request('GET', '/stats');
        return new AppStats(response);
    }

    /** Get information on a timer. */
    async getTimer(id: number): Promise<Timer> {
        const response = await this._request('GET', `/timer/${id}`);
        return new Timer(response);
    }

    /** Join the away side of a timer. */
    async joinTimer(
        id: number,
        side: TimerJoinSide
    ): Promise<SocketCredentials> {
        const response = await this._request('POST', `/timer/${id}/${side}`);
        return {
            timer: response.timer,
            token: response.token
        };
    }

    /** Create a new timer with given settings. */
    async createTimer(
        settings: StageSettings[],
        asManager: boolean = false
    ): Promise<SocketCredentials> {
        const rawSettings = settings.map(stage => stage.dump());
        const response = await this._request('POST', '/timer', {
            stages: rawSettings,
            as_manager: asManager
        });
        return {
            timer: response.timer,
            token: response.token
        };
    }
}
