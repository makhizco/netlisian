import React, { useEffect, useState } from "react";
import { Plus, Trash2, Copy, Settings2, X, Zap } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../../components/base/accordion";
import { Button } from "../../../components/base/button";
import { Card } from "../../../components/base/card";
import { Separator } from "../../../components/base/separator";
import { cn } from "../../../lib/utils";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../../components/base/dialog";
import { Input } from "../../../components/base/input";
import { Textarea } from "../../../components/base/textarea";
import { Label } from "../../../components/base/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/base/select";
import { Field, DefaultComponentProps, createUsePuck } from "@measured/puck";
const useCustomPuck = createUsePuck();
import {
  BuilderComponentConfig,
  BuilderRootConfig,
  Overrides,
} from "@netlisian/softconfig/puck";
import {
  buildCvaTransform,
  getEligibleCvaFields,
  dedupeOptions,
  useCvaConfig,
  componentNameToLabels,
  type CvaConfig,
  type FieldOption,
} from "../../hooks/use-cva-mapping";
const rootDroppableId = "root:default-zone";



export {
  buildCvaTransform,
  getEligibleCvaFields,
  dedupeOptions,
  useCvaConfig,
  type CvaConfig,
  type FieldOption,
};

// Check if path contains numeric array indices [0], [1], etc. (invalid in mappings)
const hasNumericArrayIndices = (path: string | string[] | undefined) => {
  const paths = Array.isArray(path) ? path : path ? [path] : [];
  return paths.some((value) => /\[\d+\]/.test(value));
};

// --- TYPES ---

export interface MappingItem {
  mode: "simple" | "cva";
  to: string | null;
  from: string | string[];
  cva?: CvaConfig;
  transform?: (inputs: unknown[], props: DefaultComponentProps) => unknown;
}

interface CvaDialogProps {
  isOpen: boolean;
  onClose: () => void;
  config: CvaConfig;
  toOptions: FieldOption[];
  selectedTo: string | null;
  onToChange: (val: string) => void;
  availableTriggerFields: FieldOption[];
  onSave: (config: CvaConfig) => void;
}

// --- COMPONENT: CVA Dialog ---
export const CvaDialog = ({
  isOpen,
  onClose,
  config,
  toOptions,
  selectedTo,
  onToChange,
  availableTriggerFields,
  onSave,
}: CvaDialogProps) => {
  const {
    config: localConfig,
    handleBaseChange,
    addVariant,
    removeVariant,
    updateVariantField,
    updateVariantClass,
  } = useCvaConfig(config);

  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 overflow-y-auto text-foreground bg-card dark:bg-slate-900">
        <DialogHeader className="px-6 py-5 border-b border-border bg-muted/20 dark:bg-muted/50 dark:border-border">
          <DialogTitle className="text-zinc-900 dark:text-zinc-50">
            Configure CVA Rules
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Define logic for the target property.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Target Prop Selection */}
          <div className="space-y-2 p-3 bg-slate-50 border rounded-md">
            <Label className="text-xs font-bold uppercase text-muted-foreground">
              Target Prop (Output)
            </Label>
            <Select
              value={selectedTo}
              onValueChange={(val: string | null) => val && onToChange(val)}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select where these classes go..." />
              </SelectTrigger>
              <SelectContent>
                {toOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Default / Base Classes</Label>
            <Textarea
              placeholder="e.g. rounded-md text-sm..."
              className="font-mono text-xs min-h-20"
              value={localConfig.base}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                handleBaseChange(e.target.value)
              }
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Variants</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={addVariant}
                className="h-8 gap-1"
              >
                <Plus className="w-3 h-3" /> Add Variant Group
              </Button>
            </div>

            {localConfig.variants.length === 0 && (
              <div className="py-6 text-center bg-slate-50 border border-dashed rounded-md text-xs text-muted-foreground">
                No variants defined.
              </div>
            )}

            {localConfig.variants.map((variant, vIdx) => {
              const selectedFieldDef = availableTriggerFields?.find(
                (f) => f.value === variant.fieldId,
              );
              const availableOptions = selectedFieldDef?.options || [];

              return (
                <div
                  key={vIdx}
                  className="border rounded-lg p-3 bg-slate-50 relative"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6 text-slate-400 hover:text-red-500"
                    onClick={() => removeVariant(vIdx)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                  <div className="mb-3 pr-8">
                    <Label className="text-xs mb-1.5 block">
                      Trigger Field
                    </Label>
                    <Select
                      value={variant.fieldId}
                      onValueChange={(val: string | null) =>
                        val && updateVariantField(vIdx, val)
                      }
                    >
                      <SelectTrigger className="bg-white h-8 text-xs">
                        <SelectValue placeholder="Select root field..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTriggerFields.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {variant.fieldId && (
                    <div className="space-y-2 pl-2 border-l-2 border-slate-200">
                      {availableOptions.length > 0 ? (
                        availableOptions.map((opt) => (
                          <div
                            key={opt.value}
                            className="grid grid-cols-[100px_1fr] gap-2 items-center"
                          >
                            <Label
                              className="text-xs font-normal text-muted-foreground truncate"
                              title={opt.label}
                            >
                              {opt.label}:
                            </Label>
                            <Input
                              className="h-7 bg-white font-mono text-xs"
                              placeholder="Classes..."
                              value={variant.classes[opt.value] || ""}
                              onChange={(
                                e: React.ChangeEvent<HTMLInputElement>,
                              ) =>
                                updateVariantClass(
                                  vIdx,
                                  opt.value,
                                  e.target.value,
                                )
                              }
                            />
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-amber-600 italic">
                          No options found for this field.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter className="border-t border-border bg-muted/20 dark:bg-muted/50 dark:border-border px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// --- COMPONENT: Quick Add CVA Dialog ---
export const QuickAddCvaDialog = ({
  isOpen,
  onClose,
  onAdd,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (config: {
    base?: string;
    variants?: Record<string, Record<string, string>>;
    defaultVariants?: Record<string, string>;
  }) => void;
}) => {
  const [code, setCode] = useState("");

  const handleAdd = () => {
    try {
      const cvaMock = (base: string, options: Record<string, any>) => ({
        base,
        ...options,
      });
      const match = code.match(/cva\s*\(([\s\S]*)\)/);
      if (!match) {
        alert("Could not find cva() call in the code.");
        return;
      }
      const args = match[1];
      const parsed = new Function("cva", `return cva(${args})`)(cvaMock);
      onAdd(parsed);
      onClose();
    } catch (e) {
      console.error(e);
      alert("Failed to parse CVA code. Check console for details.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col text-foreground bg-card dark:bg-slate-900">
        <DialogHeader className="px-6 py-5 border-b border-border bg-muted/20 dark:bg-muted/50 dark:border-border">
          <DialogTitle className="text-zinc-900 dark:text-zinc-50">
            Quick Add CVA
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Paste your CVA definition code here. It will automatically create
            root fields and a mapping for this component.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-6 overflow-y-auto flex-1">
          <Label className="mb-2 block">CVA Code</Label>
          <Textarea
            placeholder="const variants = cva('base...', { variants: { ... } })"
            className="font-mono text-xs min-h-[300px] bg-background"
            value={code}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setCode(e.target.value)
            }
          />
        </div>
        <DialogFooter className="border-t border-border bg-muted/20 dark:bg-muted/50 dark:border-border px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd}>Add CVA Prop</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const MapFn = ({
  toOptions,
  fromOptions,
  rootProps,
  props,
  value: rawValue,
  onChange,
  id,
}: {
  rootProps: BuilderRootConfig;
  toOptions: {
    label: string;
    value: string;
    type: Field["type"] | "reference";
  }[];
  fromOptions: {
    label: string;
    value: string;
    type: Field["type"] | "reference";
  }[];
  props: DefaultComponentProps;
  value: BuilderComponentConfig["_map"];
  onChange: (value: BuilderComponentConfig["_map"]) => void;
  id: string;
}) => {
  const dispatch = useCustomPuck((s) => s.dispatch);
  const appState = useCustomPuck((s) => s.appState);
  const selectedItem = useCustomPuck((s) => s.selectedItem);
  const itemSelector = appState.ui.itemSelector;
  const selectedItemType = selectedItem?.type;
  // Cast generic value to our richer MappingItem type internally
  const value = React.useMemo(
    () => (rawValue || []).map((item) => item as unknown as MappingItem),
    [rawValue],
  );

  const [activeDialogIndex, setActiveDialogIndex] = useState<number | null>(
    null,
  );
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  useEffect(() => {
    if (!rawValue?.length) return;

    let changed = false;

    const next = rawValue.map((item) => {
      const patched = { ...item };

      // Initialize CVA fields if needed
      if (
        patched.mode === "cva" &&
        patched.cva &&
        (patched.from === undefined || patched.from === "")
      ) {
        patched.from = patched.from || [];
        changed = true;
      }

      // Set default empty from for simple mode
      if (patched.mode === "simple" && patched.from === undefined) {
        patched.from = "";
        changed = true;
      }

      // Clear numeric array indices (e.g., [0], [1] are invalid; use [] for array mapping)
      if (
        typeof patched.from === "string" &&
        hasNumericArrayIndices(patched.from)
      ) {
        patched.from = patched.mode === "cva" ? [] : "";
        changed = true;
      }

      if (
        typeof patched.to === "string" &&
        hasNumericArrayIndices(patched.to)
      ) {
        patched.to = "";
        changed = true;
      }

      return patched;
    });

    if (changed) {
      onChange(next as BuilderComponentConfig["_map"]);
    }
  }, [rawValue, onChange]);

  // Memoize eligible fields for CVA dialog to avoid recalc on every render
  const cvaTriggerFields = React.useMemo(
    () => getEligibleCvaFields(rootProps._fields, rootProps._fieldSettings),
    [rootProps],
  );

  // Stabilize option lists: only update identity when the actual values change
  const resolvedToOptions = React.useMemo(
    () => dedupeOptions(toOptions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(toOptions.map((o) => o.value))],
  );

  const handleUpdate = (index: number, updates: Partial<MappingItem>) => {
    const updatedList = value.map((item, i) =>
      i === index ? { ...item, ...updates } : item,
    );
    if (updatedList)
      onChange(updatedList as unknown as BuilderComponentConfig["_map"]);
  };

  const handleAdd = () => {
    onChange([
      ...value,
      { mode: "simple", from: "", to: "" },
    ] as unknown as BuilderComponentConfig["_map"]);
  };

  const handleRemove = (index: number) => {
    const newValue = [...value];
    newValue.splice(index, 1);
    onChange(newValue as unknown as BuilderComponentConfig["_map"]);
  };

  const handleDuplicate = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const itemToClone = value[index];
    // Simple deep copy
    const newValue = [...value];
    newValue.splice(index + 1, 0, JSON.parse(JSON.stringify(itemToClone)));
    onChange(newValue as unknown as BuilderComponentConfig["_map"]);
  };

  const handleCvaSave = (index: number, newCvaConfig: CvaConfig) => {
    const usedFields = new Set<string>();
    newCvaConfig.variants.forEach((v) => {
      if (v.fieldId) usedFields.add(v.fieldId);
    });

    // We capture the config values into a closure-like structure for the function
    handleUpdate(index, {
      cva: newCvaConfig,
      from: Array.from(usedFields),
      transform: buildCvaTransform(newCvaConfig),
    });
  };

  const toggleMode = (index: number, mode: "simple" | "cva") => {
    const current = value[index];
    if (!current) return;

    if (mode === "cva" && !current.cva) {
      handleUpdate(index, { mode, cva: { base: "", variants: [] }, from: [] });
    } else if (mode === "simple") {
      // Clear CVA specific fields when going back to simple
      handleUpdate(index, {
        mode,
        from: "",
        cva: undefined,
        transform: undefined,
      });
    } else {
      handleUpdate(index, { mode });
    }
  };

  const handleQuickAdd = (parsedCva: {
    base?: string;
    variants?: Record<string, Record<string, string>>;
    defaultVariants?: Record<string, string>;
  }) => {
    const variants = parsedCva.variants || {};
    const defaultVariants = parsedCva.defaultVariants || {};
    const base = parsedCva.base || "";

    const newFields = [...(rootProps._fields || [])];
    const newFieldSettings: Record<string, any> = {
      ...(rootProps._fieldSettings || {}),
    };
    const usedFieldIds: string[] = [];

    const cvaVariants: { fieldId: string; classes: Record<string, string> }[] =
      [];

    Object.entries(variants).forEach(
      ([variantName, variantOptions]: [string, Record<string, string>]) => {
        const options = Object.entries(variantOptions).map(([optName]) => ({
          label: componentNameToLabels(optName),
          value: optName,
        }));

        // Add field to root if it doesn't exist
        if (!newFields.find((f: any) => f.name === variantName)) {
          newFields.push({
            name: variantName,
            label: componentNameToLabels(variantName),
            type: options.length <= 3 ? "radio" : "select",
          } as any);
          newFieldSettings[variantName] = {
            options,
            defaultValue: defaultVariants[variantName] || options[0]?.value,
          };
        }

        usedFieldIds.push(variantName);
        cvaVariants.push({
          fieldId: variantName,
          classes: variantOptions,
        });
      },
    );

    const newCvaConfig: CvaConfig = {
      base,
      variants: cvaVariants,
    };

    const newMapping: MappingItem = {
      mode: "cva",
      to: null,
      from: usedFieldIds,
      cva: newCvaConfig,
      transform: buildCvaTransform(newCvaConfig),
    };

    // 1 & 2: Update root fields and settings
    requestAnimationFrame(() =>
      dispatch({
        type: "replaceRoot",
        root: {
          props: {
            ...rootProps,
            _fields: newFields,
            _fieldSettings: newFieldSettings,
          } as unknown as DefaultComponentProps,
        },
      }),
    );

    // 3: Update component map
    const nextValue = [...value, newMapping];
    requestAnimationFrame(() =>
      onChange(nextValue as unknown as BuilderComponentConfig["_map"]),
    );
    // Force replace the whole component to ensure transform is applied
    if (itemSelector && selectedItemType) {
      dispatch({
        type: "replace",
        data: {
          type: selectedItemType,
          props: {
            id,
            ...props,
            _map: nextValue,
          },
        },
        destinationIndex: itemSelector.index,
        destinationZone: itemSelector?.zone || rootDroppableId,
      });
    }
  };

  return (
    <div className="w-full space-y-3" id={id}>
      <Label className="block font-medium">Dynamic Field Mapping</Label>

      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        {value.map((item, index) => (
          <Accordion key={index}>
            <AccordionItem
              value={`item-${index}`}
              className={cn(
                "border-0",
                index < value.length - 1 ? "border-b border-slate-200" : "",
              )}
            >
              {/* HEADER */}
              <div className="group flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors">
                <AccordionTrigger className="flex-1 min-w-0 px-0 py-0 hover:no-underline font-normal!">
                  <div className="text-xs font-medium text-slate-700 truncate">
                    Mapping #{index + 1}
                  </div>
                </AccordionTrigger>

                {/* ACTION BUTTONS (hover only) */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) =>
                      handleDuplicate(index, e)
                    }
                  >
                    <Copy className="h-3 w-3 text-slate-400 hover:text-slate-600" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation();
                      handleRemove(index);
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-red-400 hover:text-red-600" />
                  </Button>
                </div>
              </div>

              {/* CONTENT */}
              <AccordionContent className="px-3 py-3 text-xs bg-white">
                <div className="space-y-3">
                  {/* MODE TOGGLE */}
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-md w-fit">
                    {(["simple", "cva"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleMode(index, m)}
                        className={cn(
                          "px-3 py-1.5 rounded-sm text-[10px] font-medium capitalize transition-all",
                          item.mode === m
                            ? "bg-white text-blue-600 shadow-sm border border-blue-200"
                            : "text-slate-500 hover:text-slate-700",
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  {item.mode === "simple" && (
                    <div className="flex flex-col gap-3">
                      <div className="space-y-1.5 w-full">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">
                          Source Field
                        </Label>
                        <Select
                          value={(item.from as string) || ""}
                          onValueChange={(val: string | null) =>
                            val && handleUpdate(index, { from: val })
                          }
                        >
                          <SelectTrigger className="text-xs w-full h-8 bg-white">
                            <SelectValue placeholder="Get Value From" />
                          </SelectTrigger>
                          <SelectContent>
                            {fromOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">
                          Target Prop
                        </Label>
                        <Select
                          value={item.to || ""}
                          onValueChange={(val: string | null) =>
                            val && handleUpdate(index, { to: val })
                          }
                        >
                          <SelectTrigger className="text-xs w-full h-8 bg-white">
                            <SelectValue placeholder="Map To" />
                          </SelectTrigger>
                          <SelectContent>
                            {resolvedToOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {item.mode === "cva" && (
                    <Button
                      variant="outline"
                      className="w-full h-8 text-[11px] border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 shadow-none font-medium"
                      onClick={() => setActiveDialogIndex(index)}
                    >
                      <Settings2 className="w-3 h-3 mr-2" />
                      Configure CVA Rules
                    </Button>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ))}

        {/* Add Mapping */}
        <div
          className={cn(
            "flex items-cetner justify-between divide-x border-t border-slate-200 w-full px-2 py-1",
            value.length === 0 && "border-t-0",
          )}
        >
          <Button size="sm" variant="ghost" onClick={handleAdd}>
            <Plus />
            Add Mapping
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setIsQuickAddOpen(true)}
          >
            <Zap />
          </Button>
        </div>
      </div>

      {/* CVA Dialog */}
      {activeDialogIndex !== null && value[activeDialogIndex] && (
        <CvaDialog
          key={activeDialogIndex}
          isOpen={true}
          onClose={() => setActiveDialogIndex(null)}
          config={value[activeDialogIndex].cva || { base: "", variants: [] }}
          availableTriggerFields={cvaTriggerFields}
          toOptions={resolvedToOptions}
          selectedTo={value[activeDialogIndex].to}
          onToChange={(val: string | null) =>
            handleUpdate(activeDialogIndex, { to: val })
          }
          onSave={(newCva) => handleCvaSave(activeDialogIndex, newCva)}
        />
      )}

      {/* Quick Add CVA Dialog */}
      <QuickAddCvaDialog
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onAdd={handleQuickAdd}
      />
    </div>
  );
};

export const map: Overrides["map"] = (props) => {
  return <MapFn {...props} />;
};

export const hydrateMapTransform: Overrides["hydrateMapTransform"] = (
  mapItem,
) => {
  if (mapItem?.transform) return mapItem.transform;
  if (mapItem?.cva) return buildCvaTransform(mapItem.cva as CvaConfig);
  return undefined;
};
