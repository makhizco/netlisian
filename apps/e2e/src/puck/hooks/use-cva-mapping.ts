import { useState, useCallback } from "react";
import { twMerge } from "tailwind-merge";
import { Field } from "@puckeditor/core";
import { SoftFieldSettings, SoftFieldDefinition } from "@netlisian/softconfig/puck";

export interface CvaVariant {
  fieldId: string;
  classes: Record<string, string>;
}

export interface CvaConfig {
  base: string;
  variants: CvaVariant[];
}

export interface FieldOption {
  label: string;
  value: string;
  type: Field["type"] | "reference";
  options?: { label: string; value: string }[];
}

export const componentNameToLabels = (name: string): string => {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export const buildCvaTransform = (cfg: CvaConfig) => {
  return (inputs: unknown[]) => {
    const base = cfg.base || "";
    const variants = cfg.variants || [];
    const classes = [base];

    variants.forEach((variant, index) => {
      if (!variant.fieldId) return;
      const value = Array.isArray(inputs)
        ? inputs.at(index)
        : (inputs as Record<string, unknown> | undefined)?.[variant.fieldId];
      const className = variant.classes?.[value as keyof typeof variant.classes];
      if (className) classes.push(className);
    });

    return twMerge(classes.filter(Boolean).join(" "));
  };
};

export const getEligibleCvaFields = (
  fields: SoftFieldDefinition[] = [],
  settings: SoftFieldSettings = {},
): FieldOption[] => {
  const options: FieldOption[] = [];

  const processField = (field: SoftFieldDefinition, prefix = "") => {
    const path = prefix ? `${prefix}.${field.name}` : field.name;
    const fieldSettings = settings[field.name];

    if (field.type === "array" && fieldSettings?.subFields) {
      fieldSettings.subFields.forEach((subField: SoftFieldDefinition) => {
        processField(subField, `${path}[]`);
      });
    } else if (field.type === "object" && fieldSettings?.subFields) {
      fieldSettings.subFields.forEach((subField: SoftFieldDefinition) => {
        processField(subField, path);
      });
    } else if (
      field.type !== "slot" &&
      field.type !== "array" &&
      field.type !== "object"
    ) {
      const subOptions = fieldSettings?.options || [];
      options.push({
        label: componentNameToLabels(path),
        value: path,
        type: field.type as FieldOption["type"],
        options: subOptions.length > 0 ? subOptions as { label: string; value: string }[] : undefined,
      });
    }
  };

  fields.forEach((field) => {
    processField(field);
  });

  return options;
};

export const dedupeOptions = (options: FieldOption[]): FieldOption[] => {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
};

export const useCvaConfig = (initialConfig: CvaConfig) => {
  const [localConfig, setLocalConfig] = useState<CvaConfig>(initialConfig);

  const handleBaseChange = useCallback((value: string) => {
    setLocalConfig((previous) => ({ ...previous, base: value }));
  }, []);

  const addVariant = useCallback(() => {
    setLocalConfig((previous) => ({
      ...previous,
      variants: [...previous.variants, { fieldId: "", classes: {} }],
    }));
  }, []);

  const removeVariant = useCallback((index: number) => {
    setLocalConfig((previous) => {
      const next = [...previous.variants];
      next.splice(index, 1);
      return { ...previous, variants: next };
    });
  }, []);

  const updateVariantField = useCallback((index: number, fieldId: string) => {
    setLocalConfig((previous) => {
      const next = [...previous.variants];
      next[index] = { fieldId, classes: {} };
      return { ...previous, variants: next };
    });
  }, []);

  const updateVariantClass = useCallback(
    (variantIndex: number, optionValue: string, className: string) => {
      setLocalConfig((previous) => {
        const next = [...previous.variants];
        const current = next[variantIndex];
        if (!current) return previous;

        const currentClasses = { ...current.classes };
        currentClasses[optionValue] = className;
        next[variantIndex] = { ...current, classes: currentClasses };
        return { ...previous, variants: next };
      });
    },
    [],
  );

  return {
    config: localConfig,
    setConfig: setLocalConfig,
    handleBaseChange,
    addVariant,
    removeVariant,
    updateVariantField,
    updateVariantClass,
  };
};
