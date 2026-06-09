/**
 * E2E Test Helpers — Soft Config
 * ================================
 *
 * Shared utilities for interacting with the SoftConfig store and Puck editor
 * in Playwright tests. Import these instead of calling window APIs directly
 * to keep tests readable and avoid common mistakes.
 *
 * ── Key Concepts ───────────────────────────────────────────────────────────────
 *
 * window.softConfigStore  — The Zustand store exposed by SoftConfigProvider.
 *   - .getState().setSoftComponent(name, version, component)
 *       Upserts a soft component into the store. Only updates softComponents,
 *       does NOT rebuild softConfig automatically.
 *   - .getState().hydrateTransforms()
 *       Runs hydrateMapTransform over softComponents and rebuilds softConfig.
 *       MUST be called after setSoftComponent for the component to appear in
 *       the Puck sidebar and be insertable.
 *
 * window.puckDispatch     — Puck's dispatch function, set via useEffect inside
 *                           the PuckExposer component (HeaderActions override).
 *   IMPORTANT: dispatch runs synchronously in the JS call stack, but React
 *   state updates are async. Always wait for window.puckState to reflect the
 *   change rather than asserting immediately after dispatch.
 *
 * window.puckState        — The last committed Puck AppState (set on every
 *                           render via useEffect). Use .data.content[] to
 *                           inspect placed components.
 *
 * ── Zone Names ─────────────────────────────────────────────────────────────────
 *
 * Puck 0.20.x uses compound zone strings: "<areaId>:<zoneName>".
 * The root canvas zone is always "root:default-zone".
 * Using plain "root" silently does nothing — the insert action does an exact
 * match on the zone compound string.
 *
 * ── requestAnimationFrame wrapping ─────────────────────────────────────────────
 *
 * Wrapping puckDispatch('insert') inside requestAnimationFrame gives React one
 * frame to flush the softConfig update (hydrateTransforms) into the Puck config
 * before the insert action fires. Without this the component type may not yet
 * exist in the config, causing the insert to be silently rejected.
 *
 * ── softConfig.components fields ───────────────────────────────────────────────
 *
 * Do NOT assert on softConfig.components['MyComp'].fields after a remodel.
 * createVersionedComponentConfig builds fields dynamically via resolveFields,
 * so the static .fields object on the config entry is always {}.
 * Instead assert on softComponents['MyComp'].versions['1.0.0'].fields which is
 * the actual source of truth stored in the Zustand store.
 */

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

// ── Types ───────────────────────────────────────────────────────────────────────

/** A minimal Puck content item used to build Data payloads for setData dispatch. */
export type PuckContentItem = {
  type: string;
  props: {
    id: string;
    [key: string]: unknown;
  };
};

/** Minimal Puck Data shape accepted by the setData action. */
export type PuckData = {
  content: PuckContentItem[];
  root?: { props?: Record<string, unknown> };
  zones?: Record<string, PuckContentItem[]>;
};

// ── Store helpers ───────────────────────────────────────────────────────────────

/**
 * Registers a soft component version in the store and rebuilds softConfig.
 * Equivalent to calling setSoftComponent + hydrateTransforms on the store.
 *
 * @param page      - Playwright page
 * @param name      - Component name key (e.g. "button", "Heading")
 * @param version   - Semver version string (e.g. "1.0.0")
 * @param component - The SoftComponent definition object (matches SoftComponent type)
 */
export async function registerSoftComponent(
  page: Page,
  name: string,
  version: string,
  component: Record<string, unknown>,
): Promise<void> {
  await page.evaluate(
    ({ name, version, component }) => {
      const store = window.softConfigStore.getState();
      store.setSoftComponent(name, version, component as any);
      // hydrateTransforms re-applies hydrateMapTransform (defined in the app's
      // overrides) and rebuilds softConfig from the updated softComponents.
      store.hydrateTransforms();
    },
    { name, version, component },
  );
}

// ── Wait helpers ────────────────────────────────────────────────────────────────

/**
 * Polls until the component appears in softConfig.components.
 * Use this after registerSoftComponent — hydrateTransforms is synchronous
 * but React state propagation is async.
 */
export async function waitForRegistered(page: Page, name: string, timeout = 5000): Promise<void> {
  await expect(async () => {
    const ok = await page.evaluate(
      (n) => !!window.softConfigStore.getState().softConfig.components[n],
      name,
    );
    expect(ok).toBe(true);
  }).toPass({ timeout });
}

/**
 * Polls until a component of the given type appears in puckState.data.content.
 * Use this after insertComponent — puckState is updated on every React render.
 */
export async function waitForPlaced(page: Page, type: string, timeout = 5000): Promise<void> {
  await expect(async () => {
    const ok = await page.evaluate(
      (t) => window.puckState.data.content.some((n: any) => n.type === t),
      type,
    );
    expect(ok).toBe(true);
  }).toPass({ timeout });
}

// ── Dispatch helpers ────────────────────────────────────────────────────────────

/**
 * Inserts a component into the root canvas zone via a Puck 'insert' dispatch,
 * wrapped in requestAnimationFrame so React has flushed the config update first.
 *
 * Use this for individual inserts during lifecycle tests.
 * For bulk inserts (e.g. benchmarks) use dispatchSetData instead.
 *
 * @param page          - Playwright page
 * @param componentType - Must match a key in softConfig.components
 * @param id            - Unique instance ID for this placement
 * @param index         - Position in root:default-zone (default: 0)
 */
export async function insertComponent(
  page: Page,
  componentType: string,
  id: string,
  index = 0,
): Promise<void> {
  await page.evaluate(
    ({ componentType, id, index }) => {
      return new Promise<void>((resolve) => {
        // rAF defers until after React has committed the latest softConfig,
        // so the componentType is guaranteed to exist in Puck's config.
        requestAnimationFrame(() => {
          window.puckDispatch({
            type: 'insert',
            componentType,
            // Root zone compound: "root:default-zone"
            // Never use plain "root" — the insert action does an exact string match.
            destinationZone: 'root:default-zone',
            destinationIndex: index,
            id,
          });
          resolve();
        });
      });
    },
    { componentType, id, index },
  );
}

/**
 * Dispatches a Puck 'setData' action to replace the entire canvas in one shot.
 *
 * Prefer this over looping insertComponent when you need many components placed
 * at once (e.g. benchmarks). setData is intentionally expensive — it triggers
 * a full re-render — but it's far faster than 100 individual insert dispatches.
 *
 * WARNING: setData replaces the *entire* canvas. Any previously placed
 * components will be removed.
 *
 * @param page - Playwright page
 * @param data - Full PuckData payload ({ content, root?, zones? })
 */
export async function dispatchSetData(page: Page, data: PuckData): Promise<void> {
  await page.evaluate((d) => {
    window.puckDispatch({ type: 'setData', data: d as any });
  }, data);
}

/**
 * Builds a PuckData object containing `count` instances of the given component
 * type, seeded with its defaultProps from the soft component store.
 *
 * Each item gets a unique ID: `<prefix>-<index>`.
 *
 * @param page          - Playwright page (needed to read defaultProps from the store)
 * @param componentType - Soft component name key (must already be registered)
 * @param count         - Number of instances to generate
 * @param idPrefix      - Prefix for generated IDs (default: componentType)
 */
export async function buildBulkData(
  page: Page,
  componentType: string,
  count: number,
  idPrefix?: string,
): Promise<PuckData> {
  return page.evaluate(
    ({ componentType, count, idPrefix }) => {
      const store = window.softConfigStore.getState();
      const sc = store.softComponents[componentType];
      const version = sc?.defaultVersion ?? '1.0.0';
      const defaultProps = sc?.versions?.[version]?.defaultProps ?? {};
      const prefix = idPrefix ?? componentType;

      const content = Array.from({ length: count }, (_, i) => ({
        type: componentType,
        props: { id: `${prefix}-${i}`, ...defaultProps },
      }));

      return { content, root: { props: {} }, zones: {} };
    },
    { componentType, count, idPrefix: idPrefix ?? componentType },
  );
}
