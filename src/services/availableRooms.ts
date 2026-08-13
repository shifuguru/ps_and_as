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
