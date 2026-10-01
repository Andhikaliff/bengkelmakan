"use client";

import { useState, useEffect } from "react";

export type Settings = {
  autoRefresh: boolean;
  autoRefreshInterval: number; // in seconds
  darkMode: boolean;
  scannerVolume: number; // 0 to 1
  scannerSoundEnabled: boolean;
};

const defaultSettings: Settings = {
  autoRefresh: false,
  autoRefreshInterval: 30,
  darkMode: false,
  scannerVolume: 1,
  scannerSoundEnabled: true,
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("canteen_settings");
    if (saved) {
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(saved) });
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
    setLoaded(true);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "canteen_settings" && e.newValue) {
        try {
          setSettings({ ...defaultSettings, ...JSON.parse(e.newValue) });
        } catch (e) {}
      }
    };

    const handleCustomChange = () => {
      const saved = localStorage.getItem("canteen_settings");
      if (saved) {
        try {
          setSettings({ ...defaultSettings, ...JSON.parse(saved) });
        } catch (e) {}
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("canteen_settings_updated", handleCustomChange);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("canteen_settings_updated", handleCustomChange);
    };
  }, []);

  const updateSettings = (newSettings: Partial<Settings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem("canteen_settings", JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("canteen_settings_updated"));
  };

  return { settings, updateSettings, loaded };
}
