import { getNativeAccessToken } from "./session-transport.native";

export interface MessagesSocketAuth {
  withCredentials: boolean;
  token?: string;
}

/** Native SecureStore bearer session — pass token via socket.io handshake.auth. */
export async function getMessagesSocketAuth(): Promise<MessagesSocketAuth> {
  const token = await getNativeAccessToken();
  if (!token) {
    return { withCredentials: false };
  }
  return { withCredentials: false, token };
}
