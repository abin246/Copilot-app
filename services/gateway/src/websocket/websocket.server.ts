import { WebSocketServer } from "ws"
import http from "http"
import { handleRealtimeSession } from "../services/realtime.service.js"

export function initWebSocket(server: http.Server) {

  const wss = new WebSocketServer({ server })

  wss.on("connection", (ws) => {

    console.log("client connected")

    handleRealtimeSession(ws)

  })

}