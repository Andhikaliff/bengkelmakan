"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/lib/use-settings";
import { CancelIcon } from "./Icons";

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings, loaded } = useSettings();

  // Handle dark mode side effect directly on body
  useEffect(() => {
    if (loaded) {
      if (settings.darkMode) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, [settings.darkMode, loaded]);

  if (!isOpen || !loaded) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Pengaturan</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <CancelIcon className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-5 flex flex-col gap-6">
          {/* Dashboard Settings */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Dashboard</h3>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-gray-800">Auto Refresh</p>
                <p className="text-xs text-gray-500">Muat ulang data transaksi otomatis</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.autoRefresh}
                  onChange={(e) => updateSettings({ autoRefresh: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>
            
            {settings.autoRefresh && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">Interval Refresh (detik)</p>
                </div>
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={settings.autoRefreshInterval}
                  onChange={(e) => updateSettings({ autoRefreshInterval: Number(e.target.value) || 30 })}
                  className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 text-right"
                />
              </div>
            )}
            
            <div className="flex items-center justify-between mt-4">
              <div>
                <p className="text-sm font-medium text-gray-800">Mode Gelap (Dark Mode)</p>
                <p className="text-xs text-gray-500">Tema gelap untuk dashboard</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.darkMode}
                  onChange={(e) => updateSettings({ darkMode: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
          
          <hr className="border-gray-100" />
          
          {/* Scanner Settings */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Scanner</h3>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-gray-800">Suara Notifikasi</p>
                <p className="text-xs text-gray-500">Aktifkan efek suara saat scan</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.scannerSoundEnabled}
                  onChange={(e) => updateSettings({ scannerSoundEnabled: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>
            
            {settings.scannerSoundEnabled && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-800">Volume Suara</p>
                  <span className="text-xs font-semibold text-gray-500">{Math.round(settings.scannerVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.scannerVolume}
                  onChange={(e) => updateSettings({ scannerVolume: Number(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>
        
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full bg-gray-900 text-white font-medium text-sm rounded-lg py-2 hover:bg-gray-800 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
