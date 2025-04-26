import { ipcMain, BrowserWindow } from "electron";
import LCUConnector from "lcu-connector";
import axios, { AxiosInstance } from "axios";
import https from "https";
import WebSocket from "ws";

class LoL {
    private connector: LCUConnector;
    private window: BrowserWindow | null = null;
    private instance: AxiosInstance | null = null;
    private socket: WebSocket | null = null;
    private team = null

    constructor() {
        this.connector = new LCUConnector();
        this.connector.start();

        this.connector.on("connect", async (data) => {
            this.instance = axios.create({
                baseURL: `${data.protocol}://127.0.0.1:${data.port}`,
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false
                }),
                headers: {
                    Authorization: `Basic ${Buffer.from(`riot:${data.password}`).toString('base64')}`
                }
            });

            const user = await this.getCurrentSummoner();

            this.window?.webContents.send("league-open", { username: user.gameName });
            ipcMain.handle("isPlaying", async (event, arg) => {
                const game = await this.getCurrentGameData();
                return game
            });

            this.connectWebSocket(data);


            this.connector.on("disconnect", () => {
                console.log("League of Legends fechado.");
                this.window?.webContents.send("league-closed");

                if (this.socket) {
                    this.socket.close();
                    this.socket = null;
                }
            });
        });
    }

    set Window(window: BrowserWindow) {
        this.window = window;
    }

    public async getCurrentSummoner() {
        const response = await this.instance?.get("/lol-summoner/v1/current-summoner/");
        return response ? response.data : { username: "NotFound" };
    }

    public async getCurrentGame() {
        const response = await this.instance?.get("/lol-gameflow/v1/gameflow-phase");
        return response ? response.data : "NotFound";
    }

    private connectWebSocket(data: { address: string; port: number; password: string }) {
        this.socket = new WebSocket(`wss://${data.address}:${data.port}`, {
            headers: {
                Authorization: `Basic ${Buffer.from(`riot:${data.password}`).toString("base64")}`
            },
            rejectUnauthorized: false
        });

        this.socket.on("open", () => {
            console.log("WebSocket da LCU conectado.");
            this.socket?.send(JSON.stringify([5, "OnJsonApiEvent_lol-gameflow_v1_session"]));
        });

        this.socket.on("message", async (data: WebSocket.Data) => {
            try {
                const message: WebSocketMessage = JSON.parse(data.toString());

                if (
                    Array.isArray(message) &&
                    message[2]?.uri === "/lol-gameflow/v1/session" &&
                    (message[2]?.data as GameflowSession)?.phase === "InProgress"
                ) {
                    const gameData = (message[2]?.data as any).gameData;
                    const teamOne = gameData.teamOne as any[]
                    const teamTwo = gameData.teamTwo as any[]

                    const user = await this.getCurrentSummoner();
                    let team = 'two'

                    teamOne.forEach((player) => {
                        if (player.puuid == user.puuid) {
                            team = 'one'
                            return
                        }
                    })

                    this.onEnterChampSelect(`${gameData.gameId}-${team}`);
                }
            } catch (err) {
                console.error("Erro ao processar evento do WebSocket");
            }
        });

        interface WebSocketMessage extends Array<any> {
            2?: {
                uri?: string;
                data?: unknown;
            };
        }

        interface GameflowSession {
            phase?: string;
            gameData?: unknown; // Add the gameData property to the interface
        }

        this.socket.on("close", () => {
            console.log("WebSocket fechado.");
        });

        this.socket.on("error", (err: Error) => {
            console.error("Erro no WebSocket:", err);
        });
    }
    private async getCurrentGameData() {
        const response = await this.instance?.get("/lol-gameflow/v1/session");
        if (response && response.data) {
            const gameData = response.data.gameData;
            return gameData;
        }
        return null;
    }
    private onEnterChampSelect(roomId: string) {
        console.log("Entrou na Champ Select!");
        this.window?.webContents.send("champ-select-entered", { roomId });
    }
}

export = new LoL();
