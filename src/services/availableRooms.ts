import { isBotPublicRoomCode } from "../utils/roomCode";

export type AvailableRoom = {
  roomId: string;
  hostName: string;
  roomName?: string;
  playerCount: number;
  maxPlayers: number;
  createdAt: number;
  inGame?: boolean;
  roundInProgress?: boolean;
  deadHandSeatOpen?: boolean;
  spectatorCount?: number;
  isBotHosted?: boolean;
  botTableStalled?: boolean;
};

export function formatRoomTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

/** D-010 — hide bot-hosted public table from listings. */
export function filterPublicRooms(rooms: AvailableRoom[]): AvailableRoom[] {
  return rooms.filter(
    (room) => !room.isBotHosted && !isBotPublicRoomCode(room.roomId),
  );
}

/**
 * Live 2-player tables keep a dead-hand seat. Listing "Join" sent players to
 * CreateGame, whose Ready is lobby-only and cannot claim that seat.
 * Offer Spectate whenever the match is in progress (including between rounds).
 */
export function listedRoomShowsSpectate(
  room: Pick<AvailableRoom, "inGame" | "deadHandSeatOpen" | "playerCount">,
): boolean {
  return !!room.inGame && !!room.deadHandSeatOpen && room.playerCount >= 2;
}

/**
 * Bot-open tables keep spectators in the lobby Ready UI.
 * Standard in-game joins must enter GameScreen — CreateGame Ready cannot
 * emit playerReadyForNextRound or show the table.
 */
export function shouldHoldSpectatorStartGameInLobby(
  roomId: string | null | undefined,
): boolean {
  return isBotPublicRoomCode(roomId ?? "");
}
