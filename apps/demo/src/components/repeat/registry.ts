import { ComponentConfig } from "@measured/puck";

export type RepeatComponentRegistry = Record<string, ComponentConfig<Record<string, unknown>>>;
type RepeatRegistryListener = () => void;

let repeatComponentRegistry: RepeatComponentRegistry = {};
let isRepeatRegistryInitialized = false;
const repeatRegistryListeners = new Set<RepeatRegistryListener>();

const notifyRepeatRegistryListeners = () => {
  repeatRegistryListeners.forEach((listener) => listener());
};

export const setRepeatComponentRegistry = (
  registry: RepeatComponentRegistry | null | undefined
) => {
  repeatComponentRegistry = registry || {};
  isRepeatRegistryInitialized = true;
  notifyRepeatRegistryListeners();
};

export const getRepeatComponentRegistry = (): RepeatComponentRegistry => {
  return repeatComponentRegistry;
};

export const subscribeRepeatComponentRegistry = (
  listener: RepeatRegistryListener
) => {
  repeatRegistryListeners.add(listener);
  return () => {
    repeatRegistryListeners.delete(listener);
  };
};

export const hasRepeatComponentRegistryInitialized = (): boolean => {
  return isRepeatRegistryInitialized;
};
