import React, { createContext, useContext } from "react";
import { useGamePreferences } from "../hooks/useGamePreferences";

const DarkModeCardsContext = createContext(false);

export function CardAppearanceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { darkModeCards } = useGamePreferences();
  return (
    <DarkModeCardsContext.Provider value={darkModeCards}>
      {children}
    </DarkModeCardsContext.Provider>
  );
}

export function useDarkModeCards(): boolean {
  return useContext(DarkModeCardsContext);
}
