import React from "react";
import { Animated } from "react-native";
import PlayerHub from "../screens/PlayerHub";
import type { SocketAdapter } from "../game/socketAdapter";
import type { LobbySession } from "../services/lobbySession";
import type { OnlinePlayer } from "../services/onlinePresence";

export interface AppMenuContentProps {
  displayName: string;
  currentPlayerId: string | null;
  whatsNewUnread: number;
  onlinePlayerCount: number;
  onlinePlayers: OnlinePlayer[];
  menuOpacity: Animated.Value;
  refreshKey: number;
  updateAvailable: boolean;
  onOpenUpdate: () => void;
  pendingLobby: LobbySession | null;
  onRejoinLobby: () => void;
  onDismissLobby: () => void;
  onNavigateSound: () => void;
  actions: {
    onPlay: (playerCount: number) => void;
    onHostOnlineGame: (name: string) => void;
    onJoinOnlineRoom: (roomId: string, playerName: string) => void;
    onSpectateOnlineRoom: (roomId: string, playerName: string) => void;
    onOpenAchievements: () => void;
    onOpenTitles: () => void;
    onOpenWhatsNew: () => void;
    onOpenSettings: () => void;
    onOpenReadMe: () => void;
  };
}

const AppMenuContent: React.FC<AppMenuContentProps> = ({
displayName,
    currentPlayerId,
    whatsNewUnread,
    onlinePlayerCount,
    onlinePlayers,
    menuOpacity,
    refreshKey,
    updateAvailable,
    onOpenUpdate,
    pendingLobby,
    onRejoinLobby,
    onDismissLobby,
    onNavigateSound,
    actions,
    }) => {

  return (
    <Animated.View style={[{ flex: 1 }, { opacity: menuOpacity }]} pointerEvents="auto">
      <PlayerHub
        displayName={displayName}
        currentPlayerId={currentPlayerId}
        whatsNewUnread={whatsNewUnread}
        onlinePlayerCount={onlinePlayerCount}
        onlinePlayers={onlinePlayers}
        refreshKey={refreshKey}
        updateAvailable={updateAvailable}
        onOpenUpdate={onOpenUpdate}
        pendingLobby={pendingLobby}
        onRejoinLobby={onRejoinLobby}
        onDismissLobby={onDismissLobby}
        onNavigateSound={onNavigateSound}
        actions={actions}
      />
    </Animated.View>
  );
};

export default AppMenuContent;
