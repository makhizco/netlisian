/**
 * soft-config.spec.ts — Core Soft Component Lifecycle Tests
 * ===========================================================
 *
 * Covers the fundamental build → place → remodel lifecycle of soft components.
 * CVA mapping tests live in cva.spec.ts.
 * Performance benchmarks live in benchmark.spec.ts.
 *
 * Fixtures: e2e/fixtures/*.json
 *   Each fixture is a VersionedSoftComponent (has name, defaultVersion, versions{}).
 *   Tests pass the inner version object (versions['1.0.0']) to setSoftComponent.
 *   See fixtures/_README.md for the full format reference.
 *
 * Helpers: e2e/helpers/soft-config.ts
 *   registerSoftComponent  — setSoftComponent + hydrateTransforms
 *   waitForRegistered      — polls softConfig.components until present
 *   insertComponent        — rAF-wrapped puckDispatch insert
 *   waitForPlaced          — polls puckState.data.content until present
 */

import { test, expect } from '@playwright/test';
import {
  registerSoftComponent,
  waitForRegistered,
  insertComponent,
  waitForPlaced,
} from './helpers/soft-config';

// ── Fixtures ────────────────────────────────────────────────────────────────────
// Import the version data (not the full versioned wrapper) since setSoftComponent
// takes a SoftComponent, not a VersionedSoftComponent.

import headingFixture from './fixtures/heading.json';
import cardFixture from './fixtures/card.json';

const heading = (headingFixture as any).versions['1.0.0'];
const card = (cardFixture as any).versions['1.0.0'];

// ── Suite ───────────────────────────────────────────────────────────────────────

test.describe('Soft Config Core Lifecycle', () => {
  // Reset localStorage before every test so each test starts from a blank canvas.
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.goto('/');
    // Wait until both window globals are available — they are set inside useEffect
    // hooks that run after the first React render.
    await page.waitForFunction(() => !!window.puckDispatch && !!window.softConfigStore);
  });

  // ── Test: Build ───────────────────────────────────────────────────────────────

  test('should register a soft component into softConfig', async ({ page }) => {
    await registerSoftComponent(page, 'Heading', '1.0.0', heading);
    await waitForRegistered(page, 'Heading');

    // The component should appear in softConfig.components so Puck renders
    // its drawer item in the sidebar.
    const registered = await page.evaluate(() =>
      !!window.softConfigStore.getState().softConfig.components['Heading'],
    );
    expect(registered).toBe(true);
  });

  // ── Test: Place ───────────────────────────────────────────────────────────────

  test('should place a registered component onto the canvas', async ({ page }) => {
    await registerSoftComponent(page, 'Heading', '1.0.0', heading);
    await waitForRegistered(page, 'Heading');

    await insertComponent(page, 'Heading', 'heading-1');
    await waitForPlaced(page, 'Heading');

    // Verify the component instance exists with the expected defaultProps.
    const item = await page.evaluate(() =>
      window.puckState.data.content.find((n: any) => n.type === 'Heading'),
    );
    expect(item).toBeDefined();
    expect(item!.props.title).toBe('Heading Text');
    expect(item!.props.level).toBe('h2');
  });

  // ── Test: Remodel ─────────────────────────────────────────────────────────────

  test('should remodel a component by adding a new field', async ({ page }) => {
    // Build + place
    await registerSoftComponent(page, 'Heading', '1.0.0', heading);
    await waitForRegistered(page, 'Heading');
    await insertComponent(page, 'Heading', 'heading-1');
    await waitForPlaced(page, 'Heading');

    // Remodel: add a 'subtitle' field to the existing version.
    // We spread the existing version data so we don't lose existing fields.
    await page.evaluate(() => {
      const store = window.softConfigStore.getState();
      const existing = store.softComponents['Heading'].versions['1.0.0'];

      store.setSoftComponent('Heading', '1.0.0', {
        ...existing,
        fields: {
          ...existing.fields,
          subtitle: { type: 'text', label: 'Subtitle' },
        },
        fieldSettings: {
          ...existing.fieldSettings,
          subtitle: { defaultValue: '' },
        },
        defaultProps: {
          ...existing.defaultProps,
          subtitle: 'A subtitle',
        },
      });
      store.hydrateTransforms();
    });

    // IMPORTANT: softConfig.components['Heading'].fields will always be {}
    // because fields are resolved dynamically via resolveFields. Assert on
    // the softComponents store (the source of truth) instead.
    await expect(async () => {
      const hasSubtitle = await page.evaluate(() => {
        const sc = window.softConfigStore.getState().softComponents['Heading'];
        return !!sc?.versions?.['1.0.0']?.fields?.['subtitle'];
      });
      expect(hasSubtitle).toBe(true);
    }).toPass({ timeout: 5000 });
  });

  // ── Test: Nested Composition ──────────────────────────────────────────────────

  test('should build and place a nested component (Card)', async ({ page }) => {
    // Card has a 2-level nested container tree with two text nodes.
    await registerSoftComponent(page, 'Card', '1.0.0', card);
    await waitForRegistered(page, 'Card');

    await insertComponent(page, 'Card', 'card-1');
    await waitForPlaced(page, 'Card');

    const item = await page.evaluate(() =>
      window.puckState.data.content.find((n: any) => n.type === 'Card'),
    );
    expect(item).toBeDefined();
    expect(item!.props.title).toBe('Card Title');
    expect(item!.props.body).toBe('Card body text goes here.');
  });

  // ── Test: Multiple placements ─────────────────────────────────────────────────

  test('should place multiple components of different types', async ({ page }) => {
    await registerSoftComponent(page, 'Heading', '1.0.0', heading);
    await registerSoftComponent(page, 'Card', '1.0.0', card);
    await waitForRegistered(page, 'Heading');
    await waitForRegistered(page, 'Card');

    // Insert both — each at index 0 so order is Card, Heading on the canvas.
    await insertComponent(page, 'Heading', 'heading-1', 0);
    await insertComponent(page, 'Card', 'card-1', 1);

    await waitForPlaced(page, 'Heading');
    await waitForPlaced(page, 'Card');

    const content = await page.evaluate(() => window.puckState.data.content);
    expect(content.length).toBe(2);
    const types = content.map((n: any) => n.type);
    expect(types).toContain('Heading');
    expect(types).toContain('Card');
  });

  // ── Test: fieldSettings stored correctly ───────────────────────────────────────

  test('should persist fieldSettings in the soft component store', async ({ page }) => {
    await registerSoftComponent(page, 'Heading', '1.0.0', heading);
    await waitForRegistered(page, 'Heading');

    const fs = await page.evaluate(() => {
      const sc = window.softConfigStore.getState().softComponents['Heading'];
      return sc?.versions?.['1.0.0']?.fieldSettings;
    });

    expect(fs).toBeDefined();
    expect(fs.title.defaultValue).toBe('Heading Text');
    expect(fs.level.defaultValue).toBe('h2');
    expect(fs.level.options).toHaveLength(3);
  });
});
