import { getNativeSupabaseClient } from "./session-transport.native";

export interface MessagesSocketAuth {
  withCredentials: boolean;
  token?: string;
}

/** Native PKCE bearer session — pass token via socket.io handshake.auth. */
export async function getMessagesSocketAuth(): Promise<MessagesSocketAuth> {
  const { data } = await getNativeSupabaseClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    return { withCredentials: false };
  }
  return { withCredentials: false, token };
}
