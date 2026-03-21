export interface SocketMessage {
  type: "session" | "transcript" | "ai" | "error" | "plan";
  data: unknown;
}
// export interface SocketMessage {
//   type: "session" | "transcript" | "ai" | "error";
//   data: string;
// }
