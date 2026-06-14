"use client";

import React, { useState, useEffect } from "react";
import { Save, FolderOpen, Trash2, X, ChevronDown, ChevronUp } from "lucide-react";
import { useSavedFilters, FilterPreset } from "@/hooks/useScreenerUtils";

interface Props {
  scanner:       string;
  currentFilters: Record<string, any>;
  onLoad:        (filters: Record<string, any>) => void;
}

export default function SavedFiltersPanel({ scanner, currentFilters, onLoad }: Props) {
  const { getAll, savePreset, deletePreset } = useSavedFilters(scanner);
  const [presets, setPresets]     = useState<FilterPreset[]>([]);
  const [open, setOpen]           = useState(false);
  const [newName, setNewName]     = useState("");
  const [saving, setSaving]       = useState(false);
  const [savedMsg, setSavedMsg]   = useState(false);

  useEffect(() => {
    if (open) setPresets(getAll());
  }, [open]);

  const handleSave = () => {
    if (!newName.trim()) return;
    setSaving(true);
    savePreset(newName.trim(), currentFilters);
    setPresets(getAll());
    setNewName("");
    setSaving(false);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  const handleLoad = (preset: FilterPreset) => {
    onLoad(preset.filters);
    setOpen(false);
  };

  const handleDelete = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deletePreset(name);
    setPresets(getAll());
  };

  const hasFilters = Object.values(currentFilters).some(
    (v) => v !== "" && v !== null && v !== undefined && v !== false
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 text-xs border px-3 py-1.5 rounded-lg transition-all ${
          open
            ? "bg-gray-700 border-gray-500 text-white"
            : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
        }`}
        title="Saved Presets (S)"
      >
        <FolderOpen size={11} />
        <span>Presets</span>
        {presets.length > 0 && (
          <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">{presets.length}</span>
        )}
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-gray-300">Saved Filter Presets</h4>
            <button onClick={() => setOpen(false)} className="text-gray-600 hover:text-white">
              <X size={12} />
            </button>
          </div>

          {/* Save current */}
          {hasFilters && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Preset name…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleSave}
                disabled={!newName.trim() || saving}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
              >
                <Save size={10} />
                {savedMsg ? "Saved!" : "Save"}
              </button>
            </div>
          )}

          {/* Preset list */}
          {presets.length === 0 ? (
            <p className="text-gray-600 text-xs text-center py-4">
              No saved presets yet.{hasFilters ? " Apply filters above and save." : ""}
            </p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {presets.map((p) => (
                <div
                  key={p.name}
                  onClick={() => handleLoad(p)}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 cursor-pointer border border-transparent hover:border-gray-700 transition-all group"
                >
                  <div>
                    <div className="text-xs font-medium text-white">{p.name}</div>
                    <div className="text-[10px] text-gray-500">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(p.name, e)}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
