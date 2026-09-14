import React, { useState } from "react";
import {
  SortCriterion,
  ColumnDefinition,
  SortPreset,
  SortDirection,
} from "../utils/hierarchicalSort";
import {
  ArrowDownUp,
  ArrowUp,
  ArrowDown,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Info,
  ChevronDown,
  Layers,
} from "lucide-react";

interface HierarchicalSortControlProps<K extends string = string> {
  criteria: SortCriterion<K>[];
  onChangeCriteria: (newCriteria: SortCriterion<K>[]) => void;
  availableColumns: ColumnDefinition<K>[];
  presets?: SortPreset<K>[];
  className?: string;
  defaultCollapsed?: boolean;
}

// Visual priority colors for hierarchy badges
const LEVEL_COLORS = [
  "bg-blue-500/20 text-blue-300 border-blue-500/40",
  "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  "bg-purple-500/20 text-purple-300 border-purple-500/40",
  "bg-amber-500/20 text-amber-300 border-amber-500/40",
  "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  "bg-rose-500/20 text-rose-300 border-rose-500/40",
];

const CIRCLED_NUMBERS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

export const HierarchicalSortControl = <K extends string = string>({
  criteria,
  onChangeCriteria,
  availableColumns,
  presets = [],
  className = "",
  defaultCollapsed = false,
}: HierarchicalSortControlProps<K>) => {
  const [isOpen, setIsOpen] = useState(!defaultCollapsed);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showPresetMenu, setShowPresetMenu] = useState(false);

  const columnMap = new Map<K, ColumnDefinition<K>>();
  availableColumns.forEach((c) => columnMap.set(c.key, c));

  const usedFields = new Set(criteria.map((c) => c.field));
  const unusedColumns = availableColumns.filter((c) => !usedFields.has(c.key));

  // Add a new sort level
  const handleAddLevel = (field: K) => {
    const colDef = columnMap.get(field);
    const newLevel: SortCriterion<K> = {
      id: `${field}_${Date.now()}`,
      field,
      direction: colDef?.defaultDirection || "asc",
    };
    onChangeCriteria([...criteria, newLevel]);
    setShowAddMenu(false);
  };

  // Remove a sort level
  const handleRemoveLevel = (index: number) => {
    const updated = criteria.filter((_, idx) => idx !== index);
    onChangeCriteria(updated);
  };

  // Toggle direction of a specific level
  const handleToggleDirection = (index: number) => {
    const updated = [...criteria];
    const current = updated[index];
    updated[index] = {
      ...current,
      direction: current.direction === "asc" ? "desc" : "asc",
    };
    onChangeCriteria(updated);
  };

  // Move level precedence earlier (swap with index - 1)
  const handleMoveEarlier = (index: number) => {
    if (index <= 0) return;
    const updated = [...criteria];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    onChangeCriteria(updated);
  };

  // Move level precedence later (swap with index + 1)
  const handleMoveLater = (index: number) => {
    if (index >= criteria.length - 1) return;
    const updated = [...criteria];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    onChangeCriteria(updated);
  };

  // Change the column field for an existing level
  const handleChangeField = (index: number, newField: K) => {
    const colDef = columnMap.get(newField);
    const updated = [...criteria];
    updated[index] = {
      ...updated[index],
      field: newField,
      direction: colDef?.defaultDirection || updated[index].direction,
    };
    onChangeCriteria(updated);
  };

  // Clear all sort levels
  const handleClearAll = () => {
    onChangeCriteria([]);
  };

  // Apply a preset
  const handleApplyPreset = (preset: SortPreset<K>) => {
    const newCriteria: SortCriterion<K>[] = preset.criteria.map((c, i) => ({
      id: `${c.field}_preset_${i}_${Date.now()}`,
      field: c.field,
      direction: c.direction,
    }));
    onChangeCriteria(newCriteria);
    setShowPresetMenu(false);
  };

  return (
    <div
      className={`bg-slate-950/70 border border-slate-800/90 rounded-xl p-3 text-xs shadow-inner transition-all ${className}`}
    >
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 font-bold text-slate-200 hover:text-white transition-colors cursor-pointer"
          >
            <div className="p-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <span className="font-display">Hierarchical Multi-Level Sort</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Active Level Count Badge */}
          {criteria.length > 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 font-mono text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              {criteria.length} {criteria.length === 1 ? "Level" : "Levels"} Active
            </span>
          ) : (
            <span className="text-[11px] text-slate-500 font-mono">
              (No multi-sort active)
            </span>
          )}
        </div>

        {/* Right side controls: Presets & Clear */}
        <div className="flex items-center gap-2">
          {presets.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowPresetMenu(!showPresetMenu);
                  setShowAddMenu(false);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 text-[11px] font-medium transition cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Sort Presets</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showPresetMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowPresetMenu(false)}
                  />
                  <div className="absolute right-0 mt-1 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-30 space-y-1">
                    <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      Hierarchical Presets
                    </div>
                    {presets.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleApplyPreset(preset)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-600/20 hover:text-blue-200 text-slate-200 transition cursor-pointer text-xs group"
                      >
                        <div className="font-semibold">{preset.label}</div>
                        {preset.description && (
                          <div className="text-[10px] text-slate-400 group-hover:text-blue-300/80 mt-0.5">
                            {preset.description}
                          </div>
                        )}
                        <div className="flex items-center gap-1 mt-1 text-[10px] font-mono text-slate-400">
                          {preset.criteria.map((c, cIdx) => (
                            <React.Fragment key={cIdx}>
                              <span className="text-slate-300">
                                {columnMap.get(c.field)?.label || c.field} (
                                {c.direction === "asc" ? "▲" : "▼"})
                              </span>
                              {cIdx < preset.criteria.length - 1 && <span>➔</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {criteria.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition text-[11px] cursor-pointer"
              title="Reset all sort levels"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Expandable Body */}
      {isOpen && (
        <div className="pt-2.5 space-y-2.5">
          {/* Active Chain Pills */}
          {criteria.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/50 border border-dashed border-slate-800 text-slate-400 text-xs">
              <div className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>
                  No hierarchical sorting applied. Click a column header below or add sort levels to rank rows hierarchically.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddMenu(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add First Sort Level</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {criteria.map((crit, index) => {
                const colorClass =
                  LEVEL_COLORS[index % LEVEL_COLORS.length] ||
                  "bg-slate-800 text-slate-200 border-slate-700";
                const circledNumber = CIRCLED_NUMBERS[index] || `#${index + 1}`;
                const colDef = columnMap.get(crit.field);

                return (
                  <React.Fragment key={crit.id || `${crit.field}_${index}`}>
                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border shadow-sm transition-all ${colorClass}`}
                    >
                      {/* Priority Rank Indicator */}
                      <span
                        className="font-bold text-xs"
                        title={`Sort Priority #${index + 1}: Evaluated ${
                          index === 0
                            ? "first"
                            : `after Level #${index} ties`
                        }`}
                      >
                        {circledNumber}
                      </span>

                      {/* Field Selector Dropdown */}
                      <select
                        value={crit.field}
                        onChange={(e) =>
                          handleChangeField(index, e.target.value as K)
                        }
                        className="bg-slate-900/90 text-white font-medium text-xs rounded-md px-1.5 py-0.5 border border-slate-700 outline-none cursor-pointer hover:border-slate-500"
                        title="Change column for this level"
                      >
                        <option value={crit.field}>
                          {colDef?.label || crit.field}
                        </option>
                        {unusedColumns.map((col) => (
                          <option key={col.key} value={col.key}>
                            {col.label}
                          </option>
                        ))}
                      </select>

                      {/* Direction Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleDirection(index)}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/80 hover:bg-slate-900 text-white font-mono text-[11px] border border-slate-700 hover:border-slate-500 transition cursor-pointer"
                        title={`Currently ${
                          crit.direction === "asc" ? "Ascending" : "Descending"
                        }. Click to toggle.`}
                      >
                        {crit.direction === "asc" ? (
                          <>
                            <ArrowUp className="w-3 h-3 text-emerald-400" />
                            <span>Asc</span>
                          </>
                        ) : (
                          <>
                            <ArrowDown className="w-3 h-3 text-rose-400" />
                            <span>Desc</span>
                          </>
                        )}
                      </button>

                      {/* Reorder Precedence Buttons */}
                      <div className="flex items-center bg-slate-900/60 rounded border border-slate-700/80">
                        <button
                          type="button"
                          onClick={() => handleMoveEarlier(index)}
                          disabled={index === 0}
                          className="p-1 hover:text-white disabled:opacity-30 transition cursor-pointer"
                          title="Increase sort precedence (move earlier)"
                        >
                          <ChevronLeft className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveLater(index)}
                          disabled={index === criteria.length - 1}
                          className="p-1 hover:text-white disabled:opacity-30 transition cursor-pointer"
                          title="Decrease sort precedence (move later)"
                        >
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Delete Level */}
                      <button
                        type="button"
                        onClick={() => handleRemoveLevel(index)}
                        className="p-1 hover:bg-rose-500/20 hover:text-rose-300 rounded transition cursor-pointer text-slate-400"
                        title="Remove this sort level"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Arrow between levels */}
                    {index < criteria.length - 1 && (
                      <span className="text-slate-500 font-mono text-xs font-bold select-none">
                        ➔
                      </span>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Add Next Level Button */}
              {unusedColumns.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMenu(!showAddMenu);
                      setShowPresetMenu(false);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-medium transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-blue-400" />
                    <span>Add Sort Level</span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>

                  {showAddMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => setShowAddMenu(false)}
                      />
                      <div className="absolute left-0 mt-1 w-52 max-h-60 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1 z-30 space-y-0.5">
                        <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800">
                          Select Next Column
                        </div>
                        {unusedColumns.map((col) => (
                          <button
                            key={col.key}
                            type="button"
                            onClick={() => handleAddLevel(col.key)}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-600/20 hover:text-blue-200 text-slate-300 transition cursor-pointer text-xs flex items-center justify-between"
                          >
                            <span>{col.label}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {col.defaultDirection === "desc" ? "▼ desc" : "▲ asc"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Quick Tip / Guidance */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-300">Shortcut:</span>
            <span>
              Hold <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-blue-300">Shift</kbd> + click any column header below to toggle or append it into your sort hierarchy.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Reusable Table Header Helper component with badge indicating hierarchical sort priority
 */
interface TableSortHeaderProps<K extends string = string> {
  field: K;
  label: string;
  criteria: SortCriterion<K>[];
  onSortClick: (field: K, isShiftPressed: boolean) => void;
  onAddLevel?: (field: K) => void;
  onRemoveLevel?: (field: K) => void;
  className?: string;
  align?: "left" | "center" | "right";
  title?: string;
}

export const TableSortHeader = <K extends string = string>({
  field,
  label,
  criteria,
  onSortClick,
  onAddLevel,
  onRemoveLevel,
  className = "",
  align = "left",
  title,
}: TableSortHeaderProps<K>) => {
  const activeIndex = criteria.findIndex((c) => c.field === field);
  const isActive = activeIndex >= 0;
  const currentCriterion = isActive ? criteria[activeIndex] : null;

  const circledNumber = isActive
    ? CIRCLED_NUMBERS[activeIndex] || `#${activeIndex + 1}`
    : "";

  const alignClass =
    align === "right"
      ? "justify-end"
      : align === "center"
      ? "justify-center"
      : "justify-start";

  const colorClass = isActive
    ? LEVEL_COLORS[activeIndex % LEVEL_COLORS.length]
    : "text-slate-400 hover:text-white";

  return (
    <th
      onClick={(e) => onSortClick(field, e.shiftKey)}
      className={`cursor-pointer select-none transition-colors group relative ${className}`}
      title={
        title ||
        (isActive
          ? `Priority #${activeIndex + 1} (${currentCriterion?.direction.toUpperCase()}). Click to toggle direction (${currentCriterion?.direction === "asc" ? "desc" : "asc"}), click ✕ to remove.`
          : `Click to sort by ${label}. Click '+' icon or hold Shift to append to hierarchical sort.`)
      }
    >
      <div className={`flex items-center gap-1.5 ${alignClass}`}>
        <span className="font-semibold">{label}</span>
        {isActive ? (
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-mono font-bold shadow-sm ${colorClass}`}
          >
            <span>{circledNumber}</span>
            {currentCriterion?.direction === "asc" ? (
              <ArrowUp className="w-3 h-3 text-emerald-400 stroke-[2.5]" />
            ) : (
              <ArrowDown className="w-3 h-3 text-rose-400 stroke-[2.5]" />
            )}
            {onRemoveLevel && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveLevel(field);
                }}
                className="ml-0.5 p-0.5 rounded hover:bg-rose-500/30 text-slate-400 hover:text-rose-200 transition-colors"
                title={`Remove ${label} from sort hierarchy`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </span>
        ) : (
          <div className="inline-flex items-center gap-1">
            <ArrowDownUp className="w-3 h-3 text-slate-500 opacity-40 group-hover:opacity-90 transition-opacity" />
            {onAddLevel && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddLevel(field);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity px-1 py-0.2 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 text-[9px] font-mono border border-blue-500/30 flex items-center gap-0.5"
                title={`Append ${label} as next sort level`}
              >
                <Plus className="w-2.5 h-2.5" />
                <span>Level</span>
              </button>
            )}
          </div>
        )}
      </div>
    </th>
  );
};
