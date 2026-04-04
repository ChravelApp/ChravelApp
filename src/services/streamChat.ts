import { StreamChat } from 'stream-chat';

const apiKey = import.meta.env.VITE_STREAM_API_KEY as string;

// Singleton client instance
let client: StreamChat | null = null;

export function getStreamClient(): StreamChat {
  if (!client) {
    client = new StreamChat(apiKey);
  }
  return client;
}

export async function connectStreamUser(
  userId: string,
  userName: string,
  userImage: string | undefined,
  token: string
): Promise<void> {
  const streamClient = getStreamClient();
  if (streamClient.userID) return; // already connected
  await streamClient.connectUser({ id: userId, name: userName, image: userImage }, token);
}

export async function disconnectStreamUser(): Promise<void> {
  if (client?.userID) {
    await client.disconnectUser();
  }
}

export function getTripChannel(tripId: string) {
  const streamClient = getStreamClient();
  return streamClient.channel('messaging', `trip-${tripId}`);
}
