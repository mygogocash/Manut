export interface MessagesSocketAuth {
  withCredentials: boolean;
  token?: string;
}

/** Web uses httpOnly cookie session; socket.io sends credentials on handshake. */
export async function getMessagesSocketAuth(): Promise<MessagesSocketAuth> {
  return { withCredentials: true };
}
