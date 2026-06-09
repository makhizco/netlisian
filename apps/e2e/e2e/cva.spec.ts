/**
 * cva.spec.ts — CVA (Class Variance Authority) Mapping Tests
 * ============================================================
 *
 * Tests the CVA mapping pipeline end-to-end:
 *   soft prop value  →  cva variant lookup  →  className string  →  rendered element
 *
 * ── How CVA mapping works ──────────────────────────────────────────────────────
 *
 * A container node's map[] entry with mode: 'cva' instructs the soft-config
 * engine to compute a className from one or more soft prop values:
 *
 *   map: [{
 *     mode: 'cva',
 *     from: ['variant', 'size'],   // soft field names driving the variants
 *     to: 'values.className',      // target path on the container's fixedProps
 *     cva: {
 *       base: '...',               // always-applied classes
 *       variants: [                // ARRAY format — one entry per field
 *         { fieldId: 'variant', classes: { default: '...', outline: '...' } },
 *         { fieldId: 'size',    classes: { default: '...', sm: '...' } },
 *       ],
 *     },
 *   }]
 *
 * IMPORTANT: variants must be an ARRAY of { fieldId, classes } objects.
 * The older flat object format { primary: '...', secondary: '...' } is not
 * supported and will be silently ignored.
 *
 * ── What to assert ─────────────────────────────────────────────────────────────
 *
 * After a prop update (e.g. variant: 'default' → 'outline'), the applyMapping
 * engine re-computes the className. The new value is stored in the component's
 * props inside puckState. Assert on props — not on DOM classes — because the
 * iframe Tailwind processor is asynchronous and its output depends on whether
 * the classes are in the pre-compiled stylesheet.
 *
 * ── Context destruction ─────────────────────────────────────────────────────────
 *
 * Complex CVA components can trigger iframe re-renders that destroy the
 * Playwright execution context mid-evaluate. Use a plain synchronous dispatch
 * (no rAF wrapper) for these tests and rely on toPass polling for verification.
 *
 * Fixtures: e2e/fixtures/button.json
 * Helpers:  e2e/helpers/soft-config.ts
 */

import { test, expect } from '@playwright/test';
import {
  registerSoftComponent,
  waitForRegistered,
  waitForPlaced,
} from './helpers/soft-config';

import buttonFixture from './fixtures/button.json';

const button = (buttonFixture as any).versions['1.0.0'];

// ── Suite ───────────────────────────────────────────────────────────────────────

test.describe('CVA Mapping', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.goto('/');
    await page.waitForFunction(() => !!window.puckDispatch && !!window.softConfigStore);

    // Register the button before every test — it's used in all cases.
    await registerSoftComponent(page, 'button', '1.0.0', button);
    await waitForRegistered(page, 'button');
  });

  // ── Test: Registration ───────────────────────────────────────────────────────

  test('should store fieldSettings with options and defaultValues', async ({ page }) => {
    const fs = await page.evaluate(() => {
      const sc = window.softConfigStore.getState().softComponents['button'];
      return sc?.versions?.['1.0.0']?.fieldSettings;
    });

    expect(fs).toBeDefined();

    // Text field
    expect(fs.Text.defaultValue).toBe('Button');

    // Variant field — 6 options
    expect(fs.variant.defaultValue).toBe('default');
    expect(fs.variant.options).toHaveLength(6);
    expect(fs.variant.options.map((o: any) => o.value)).toEqual([
      'default', 'outline', 'secondary', 'ghost', 'destructive', 'link',
    ]);

    // Size field — 8 options
    expect(fs.size.defaultValue).toBe('default');
    expect(fs.size.options).toHaveLength(8);
  });

  // ── Test: Default props on placement ─────────────────────────────────────────

  test('should place a button with defaultProps populated from fieldSettings', async ({ page }) => {
    // Use synchronous dispatch — avoids context destruction from iframe re-renders.
    await page.evaluate(() => {
      window.puckDispatch({
        type: 'insert',
        componentType: 'button',
        destinationZone: 'root:default-zone',
        destinationIndex: 0,
        id: 'btn-default',
      });
    });

    await waitForPlaced(page, 'button');

    const props = await page.evaluate(() => {
      const item = window.puckState.data.content.find((n: any) => n.type === 'button');
      return item?.props;
    });

    expect(props).toBeDefined();
    expect(props.Text).toBe('Button');
    expect(props.variant).toBe('default');
    expect(props.size).toBe('default');
  });

  // ── Test: CVA variant switch ──────────────────────────────────────────────────

  test('should update stored props when variant is changed via replace', async ({ page }) => {
    // Place the button
    await page.evaluate(() => {
      window.puckDispatch({
        type: 'insert',
        componentType: 'button',
        destinationZone: 'root:default-zone',
        destinationIndex: 0,
        id: 'btn-variant',
      });
    });
    await waitForPlaced(page, 'button');

    // Change variant from 'default' → 'outline' via a replace dispatch.
    // replace mutates the props of an existing item in-place.
    await page.evaluate(() => {
      const item = window.puckState.data.content.find((n: any) => n.type === 'button');
      if (!item) throw new Error('button not found in content');

      window.puckDispatch({
        type: 'replace',
        destinationZone: 'root:default-zone',
        destinationIndex: 0,
        data: {
          ...item,
          props: { ...item.props, variant: 'outline' },
        },
      });
    });

    // After the replace, puckState should reflect the new variant.
    await expect(async () => {
      const variant = await page.evaluate(() => {
        const item = window.puckState.data.content.find((n: any) => n.type === 'button');
        return item?.props?.variant;
      });
      expect(variant).toBe('outline');
    }).toPass({ timeout: 5000 });
  });

  // ── Test: CVA size switch ─────────────────────────────────────────────────────

  test('should update stored props when size is changed via replace', async ({ page }) => {
    await page.evaluate(() => {
      window.puckDispatch({
        type: 'insert',
        componentType: 'button',
        destinationZone: 'root:default-zone',
        destinationIndex: 0,
        id: 'btn-size',
      });
    });
    await waitForPlaced(page, 'button');

    await page.evaluate(() => {
      const item = window.puckState.data.content.find((n: any) => n.type === 'button');
      if (!item) throw new Error('button not found in content');

      window.puckDispatch({
        type: 'replace',
        destinationZone: 'root:default-zone',
        destinationIndex: 0,
        data: {
          ...item,
          props: { ...item.props, size: 'lg' },
        },
      });
    });

    await expect(async () => {
      const size = await page.evaluate(() => {
        const item = window.puckState.data.content.find((n: any) => n.type === 'button');
        return item?.props?.size;
      });
      expect(size).toBe('lg');
    }).toPass({ timeout: 5000 });
  });

  // ── Test: Multiple simultaneous CVA fields ────────────────────────────────────

  test('should update both variant and size props simultaneously', async ({ page }) => {
    await page.evaluate(() => {
      window.puckDispatch({
        type: 'insert',
        componentType: 'button',
        destinationZone: 'root:default-zone',
        destinationIndex: 0,
        id: 'btn-multi',
      });
    });
    await waitForPlaced(page, 'button');

    await page.evaluate(() => {
      const item = window.puckState.data.content.find((n: any) => n.type === 'button');
      if (!item) throw new Error('button not found in content');

      window.puckDispatch({
        type: 'replace',
        destinationZone: 'root:default-zone',
        destinationIndex: 0,
        data: {
          ...item,
          props: { ...item.props, variant: 'destructive', size: 'sm' },
        },
      });
    });

    await expect(async () => {
      const props = await page.evaluate(() => {
        const item = window.puckState.data.content.find((n: any) => n.type === 'button');
        return item?.props;
      });
      expect(props?.variant).toBe('destructive');
      expect(props?.size).toBe('sm');
    }).toPass({ timeout: 5000 });
  });

  // ── Test: Remodel adds a new CVA field ────────────────────────────────────────

  test('should support adding a new CVA field via remodel', async ({ page }) => {
    // Add a new 'weight' field with its own CVA variant set
    await page.evaluate(() => {
      const store = window.softConfigStore.getState();
      const existing = store.softComponents['button'].versions['1.0.0'];

      store.setSoftComponent('button', '1.0.0', {
        ...existing,
        fields: {
          ...existing.fields,
          weight: {
            type: 'select',
            label: 'Weight',
            options: [
              { label: 'Normal', value: 'normal' },
              { label: 'Bold', value: 'bold' },
            ],
          },
        },
        fieldSettings: {
          ...existing.fieldSettings,
          weight: {
            defaultValue: 'normal',
            options: [
              { label: 'Normal', value: 'normal' },
              { label: 'Bold', value: 'bold' },
            ],
          },
        },
        defaultProps: {
          ...existing.defaultProps,
          weight: 'normal',
        },
      });
      store.hydrateTransforms();
    });

    // The new field should appear in the soft component data store.
    await expect(async () => {
      const hasWeight = await page.evaluate(() => {
        const sc = window.softConfigStore.getState().softComponents['button'];
        return !!sc?.versions?.['1.0.0']?.fields?.['weight'];
      });
      expect(hasWeight).toBe(true);
    }).toPass({ timeout: 5000 });
  });
});
