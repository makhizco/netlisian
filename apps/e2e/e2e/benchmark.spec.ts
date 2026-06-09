/**
 * benchmark.spec.ts — Performance Benchmarks
 * ============================================
 *
 * Measures timing for bulk operations and cascade updates.
 * Results are written to test-results/benchmark-report.json after all tests run.
 *
 * ── Bulk insert strategy ────────────────────────────────────────────────────────
 *
 * For inserting many components we use a single 'setData' dispatch rather than
 * N individual 'insert' dispatches. This is correct because:
 *
 *   - setData replaces the entire canvas data in one atomic Puck action.
 *   - It triggers a single walkAppState + a single React re-render.
 *   - 100 individual inserts would trigger 100 re-renders and 100 onAction calls,
 *     making the test ~100× slower and measuring the wrong thing.
 *
 * buildBulkData() generates the Data payload from the store's defaultProps so
 * the items are properly seeded without hardcoding values.
 *
 * ── Timing approach ─────────────────────────────────────────────────────────────
 *
 * Timing is taken in the Node.js test process (Date.now()) rather than inside
 * page.evaluate(). This avoids serialization overhead and captures the full
 * round-trip including network latency to the headless browser.
 *
 * ── CVA cascade timing ──────────────────────────────────────────────────────────
 *
 * The cascade test measures how long a prop replace takes to land in puckState.
 * It uses toPass polling with a short interval to detect the state change as
 * quickly as possible.
 *
 * Fixtures: e2e/fixtures/button.json, e2e/fixtures/heading.json
 * Helpers:  e2e/helpers/soft-config.ts
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {
  registerSoftComponent,
  waitForRegistered,
  waitForPlaced,
  dispatchSetData,
  buildBulkData,
  insertComponent,
} from './helpers/soft-config';

import headingFixture from './fixtures/heading.json';
import buttonFixture from './fixtures/button.json';

const heading = (headingFixture as any).versions['1.0.0'];
const button = (buttonFixture as any).versions['1.0.0'];

// ── Suite ───────────────────────────────────────────────────────────────────────

test.describe('Soft Config Performance Benchmarks', () => {
  // Accumulate metrics across tests; written to JSON in afterAll.
  const metrics: Record<string, number> = {};

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.goto('/');
    await page.waitForFunction(() => !!window.puckDispatch && !!window.softConfigStore);
  });

  test.afterAll(() => {
    const reportPath = path.join(__dirname, '..', 'test-results', 'benchmark-report.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(metrics, null, 2));
    console.log(
      `\n─── BENCHMARK REPORT ───\n${JSON.stringify(metrics, null, 2)}\n────────────────────────\n`,
    );
  });

  // ── Benchmark: setData 100 components ─────────────────────────────────────────

  test('Benchmark: setData 100 Heading components', async ({ page }) => {
    // Register first so buildBulkData can read defaultProps from the store.
    await registerSoftComponent(page, 'Heading', '1.0.0', heading);
    await waitForRegistered(page, 'Heading');

    // Build the full Data payload (100 items) without dispatching yet.
    const data = await buildBulkData(page, 'Heading', 100, 'bench-heading');

    // Time the single setData dispatch.
    const t0 = Date.now();
    await dispatchSetData(page, data);
    const elapsed = Date.now() - t0;

    metrics['setData_100_headings_ms'] = elapsed;

    // Verify all 100 landed — puckState is updated on the next React render.
    await expect(async () => {
      const count = await page.evaluate(
        () => window.puckState.data.content.length,
      );
      expect(count).toBeGreaterThanOrEqual(100);
    }).toPass({ timeout: 10000 });

    console.log(`setData 100 Headings: ${elapsed}ms`);
  });

  // ── Benchmark: setData 100 normal puck components (baseline) ────────────────

  test('Benchmark: setData 100 normal components (baseline)', async ({ page }) => {
    // Build the full Data payload (100 items) using 'container' and 'text' components from the normal config.
    const data = await page.evaluate(() => {
      const content = Array.from({ length: 100 }, (_, i) => ({
        type: 'container',
        props: { 
          id: `bench-normal-container-${i}`, 
          element: 'h1',
          attributes: [{ key: 'className', valueType: 'string' }],
          values: {},
          slotItem: [
            {
              type: 'text',
              props: {
                id: `bench-normal-text-${i}`,
                text: 'Heading Text'
              }
            }
          ]
        },
      }));
      

      return { content, root: { props: {} }, zones: {} };
    });

    const t0 = Date.now();
    await page.evaluate((d) => {
      window.puckDispatch({ type: 'setData', data: d as any });
    }, data);
    const elapsed = Date.now() - t0;

    metrics['setData_100_normal_components_ms'] = elapsed;

    // Verify all 100 landed
    await expect(async () => {
      const count = await page.evaluate(
        () => window.puckState.data.content.length,
      );
      expect(count).toBeGreaterThanOrEqual(100);
    }).toPass({ timeout: 10000 });

    console.log(`setData 100 Normal Components (Baseline): ${elapsed}ms`);
  });

  // ── Benchmark: CVA prop cascade ───────────────────────────────────────────────

  test('Benchmark: CVA prop replace (variant change)', async ({ page }) => {
    // Register and place one button.
    await registerSoftComponent(page, 'button', '1.0.0', button);
    await waitForRegistered(page, 'button');

    await page.evaluate(() => {
      window.puckDispatch({
        type: 'insert',
        componentType: 'button',
        destinationZone: 'root:default-zone',
        destinationIndex: 0,
        id: 'bench-btn',
      });
    });
    await waitForPlaced(page, 'button');

    // Time how long a variant replace takes to land in puckState.
    const t0 = Date.now();

    await page.evaluate(() => {
      const item = window.puckState.data.content.find((n: any) => n.type === 'button');
      if (!item) throw new Error('button not found');
      window.puckDispatch({
        type: 'replace',
        destinationZone: 'root:default-zone',
        destinationIndex: 0,
        data: { ...item, props: { ...item.props, variant: 'destructive' } },
      });
    });

    // Poll tightly until the state update lands.
    await expect(async () => {
      const variant = await page.evaluate(() => {
        const item = window.puckState.data.content.find((n: any) => n.type === 'button');
        return item?.props?.variant;
      });
      expect(variant).toBe('destructive');
    }).toPass({ timeout: 5000 });

    metrics['cva_variant_replace_ms'] = Date.now() - t0;
    console.log(`CVA variant replace: ${metrics['cva_variant_replace_ms']}ms`);
  });

  // ── Benchmark: hydrateTransforms on large component set ───────────────────────

  test('Benchmark: hydrateTransforms with 10 registered components', async ({ page }) => {
    // Register 10 variants of the Heading component (different versions/names)
    // to simulate a realistic registry size and measure hydration cost.
    for (let i = 0; i < 10; i++) {
      await registerSoftComponent(page, `Heading${i}`, '1.0.0', {
        ...heading,
        name: `Heading${i}`,
      });
    }

    // Wait for all to appear in softConfig.
    for (let i = 0; i < 10; i++) {
      await waitForRegistered(page, `Heading${i}`);
    }

    // Now time a full hydrateTransforms pass over all 10.
    const elapsed = await page.evaluate(() => {
      const t0 = performance.now();
      window.softConfigStore.getState().hydrateTransforms();
      return performance.now() - t0;
    });

    metrics['hydrateTransforms_10_components_ms'] = elapsed;
    console.log(`hydrateTransforms 10 components: ${elapsed.toFixed(2)}ms`);

    // Sanity check: all 10 should still be in softConfig.
    const count = await page.evaluate(() =>
      Object.keys(window.softConfigStore.getState().softConfig.components).filter(
        (k) => k.startsWith('Heading'),
      ).length,
    );
    expect(count).toBeGreaterThanOrEqual(10);
  });

  // ── Benchmark: Soft component update (remodel) ────────────────────────────────

  test('Benchmark: Update existing soft component (remodel)', async ({ page }) => {
    await registerSoftComponent(page, 'Heading', '1.0.0', heading);
    await waitForRegistered(page, 'Heading');

    await page.evaluate(() => {
      window.puckDispatch({
        type: 'insert',
        componentType: 'Heading',
        destinationZone: 'root:default-zone',
        destinationIndex: 0,
        id: 'bench-remodel',
      });
    });
    await waitForPlaced(page, 'Heading');

    const t0 = Date.now();
    
    // Simulate remodeling a soft component by changing its default prop values
    await page.evaluate((originalHeading) => {
      const updatedHeading = {
        ...originalHeading,
        defaultProps: { ...originalHeading.defaultProps, text: 'Remodeled text' },
      };
      const store = window.softConfigStore.getState();
      store.setSoftComponent('Heading', '1.0.0', updatedHeading as any);
      store.hydrateTransforms();
    }, heading);

    // Wait for the update to complete
    await expect(async () => {
       const ok = await page.evaluate(() => {
         // Verify the store config changed
         return window.softConfigStore.getState().softConfig.components['Heading']?.defaultProps?.text === 'Remodeled text';
       });
       expect(ok).toBe(true);
    }).toPass({ timeout: 5000 });

    metrics['soft_component_remodel_ms'] = Date.now() - t0;
    console.log(`Soft component remodel: ${metrics['soft_component_remodel_ms']}ms`);
  });

  // ── Benchmark: Edit 100 components simultaneously ─────────────────────────────

  test('Benchmark: Edit 100 components simultaneously', async ({ page }) => {
    await registerSoftComponent(page, 'Heading', '1.0.0', heading);
    await waitForRegistered(page, 'Heading');

    const data = await buildBulkData(page, 'Heading', 100, 'edit-100');
    await dispatchSetData(page, data);

    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBe(100);
    }).toPass({ timeout: 10000 });

    // Edit all 100 components' props
    const t0 = Date.now();
    await page.evaluate(() => {
      const newData = { ...window.puckState.data };
      newData.content = newData.content.map((item: any) => ({
        ...item,
        props: { ...item.props, text: 'Bulk edited text' }
      }));
      window.puckDispatch({ type: 'setData', data: newData });
    });

    // Wait for the change to land
    await expect(async () => {
      const firstText = await page.evaluate(() => window.puckState.data.content[0]?.props?.text);
      expect(firstText).toBe('Bulk edited text');
    }).toPass({ timeout: 5000 });

    metrics['edit_100_components_ms'] = Date.now() - t0;
    console.log(`Edit 100 components: ${metrics['edit_100_components_ms']}ms`);
  });

  // ── Benchmark: Edit 100 normal components simultaneously (baseline) ─────────

  test('Benchmark: Edit 100 normal components simultaneously (baseline)', async ({ page }) => {
    const data = await page.evaluate(() => {
      const content = Array.from({ length: 100 }, (_, i) => ({
        type: 'container',
        props: {
          id: `bench-edit-100-normal-${i}`,
          element: 'h1',
          attributes: [],
          values: {},
          slotItem: [{ type: 'text', props: { id: `bench-edit-100-normal-text-${i}`, text: 'Normal text' } }]
        },
      }));
      return { content, root: { props: {} }, zones: {} };
    });
    await dispatchSetData(page, data);

    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBe(100);
    }).toPass({ timeout: 5000 });

    const t0 = Date.now();
    await page.evaluate(() => {
      const newData = { ...window.puckState.data };
      newData.content = newData.content.map(item => ({
        ...item,
        props: {
          ...item.props,
          slotItem: [{ ...item.props.slotItem[0], props: { ...item.props.slotItem[0].props, text: 'Bulk edited normal text' } }]
        }
      }));
      window.puckDispatch({ type: 'setData', data: newData });
    });

    await expect(async () => {
      const firstText = await page.evaluate(() => window.puckState.data.content[0]?.props?.slotItem?.[0]?.props?.text);
      expect(firstText).toBe('Bulk edited normal text');
    }).toPass({ timeout: 5000 });

    metrics['edit_100_normal_components_ms'] = Date.now() - t0;
    console.log(`Edit 100 normal components: ${metrics['edit_100_normal_components_ms']}ms`);
  });

  // ── Benchmark: 5-level nested component times ─────────────────────────────────

  test('Benchmark: 5-level nested component insert and edit', async ({ page }) => {
    // Dynamically build a 5-level deep soft component container
    const buildDeep = (levels: number) => {
      let inner: any = {
        type: 'text',
        map: [{ mode: 'simple', from: 'text', to: 'text' }],
        fixedProps: {},
        components: {},
        enabledSlots: []
      };
      for (let i = levels; i > 0; i--) {
        inner = {
          type: 'container',
          map: [],
          fixedProps: { element: 'div', values: { className: `level-${i}` } },
          components: { slotItem: [inner] },
          enabledSlots: []
        };
      }
      return {
        name: `Deep${levels}`,
        defaultVersion: '1.0.0',
        versions: {
          '1.0.0': {
            name: `Deep${levels}`,
            fields: { text: { type: 'text', label: 'Text' } },
            fieldSettings: { text: { defaultValue: 'Deep text' } },
            defaultProps: { text: 'Deep text' },
            rootProps: {},
            components: [inner],
            slots: {}
          }
        }
      };
    };

    const deepComponent = buildDeep(5);
    const componentDef = deepComponent.versions['1.0.0'];
    
    await registerSoftComponent(page, 'Deep5', '1.0.0', componentDef);
    await waitForRegistered(page, 'Deep5');

    // Time the insert action
    let t0 = Date.now();
    await page.evaluate(() => {
      window.puckDispatch({
        type: 'insert',
        componentType: 'Deep5',
        destinationZone: 'root:default-zone',
        destinationIndex: 0,
        id: 'bench-deep-5',
      });
    });
    await waitForPlaced(page, 'Deep5');
    metrics['insert_5_level_nested_ms'] = Date.now() - t0;
    console.log(`Insert 5-level nested component: ${metrics['insert_5_level_nested_ms']}ms`);

    // Time the prop replace action
    t0 = Date.now();
    await page.evaluate(() => {
      const item = window.puckState.data.content.find((n: any) => n.type === 'Deep5');
      if (!item) throw new Error('Deep5 not found');
      window.puckDispatch({
        type: 'replace',
        destinationZone: 'root:default-zone',
        destinationIndex: 0,
        data: { ...item, props: { ...item.props, text: 'Edited deep text' } },
      });
    });

    await expect(async () => {
      const text = await page.evaluate(() => {
        const item = window.puckState.data.content.find((n: any) => n.type === 'Deep5');
        return item?.props?.text;
      });
      expect(text).toBe('Edited deep text');
    }).toPass({ timeout: 5000 });
    
    metrics['edit_5_level_nested_ms'] = Date.now() - t0;
    console.log(`Edit 5-level nested component: ${metrics['edit_5_level_nested_ms']}ms`);
  });

  // ── Benchmark: 5-level nested normal component times (baseline) ─────────────

  test('Benchmark: 5-level nested normal component insert and edit (baseline)', async ({ page }) => {
    let t0 = Date.now();
    await page.evaluate(() => {
      const content = [{
        type: 'container',
        props: {
          id: 'bench-deep-normal-5',
          element: 'div',
          attributes: [],
          values: {},
          slotItem: [{
            type: 'container',
            props: {
              id: 'bench-deep-normal-4',
              element: 'div',
              attributes: [],
              values: {},
              slotItem: [{
                type: 'container',
                props: {
                  id: 'bench-deep-normal-3',
                  element: 'div',
                  attributes: [],
                  values: {},
                  slotItem: [{
                    type: 'container',
                    props: {
                      id: 'bench-deep-normal-2',
                      element: 'div',
                      attributes: [],
                      values: {},
                      slotItem: [{
                        type: 'container',
                        props: {
                          id: 'bench-deep-normal-1',
                          element: 'div',
                          attributes: [],
                          values: {},
                          slotItem: [{ type: 'text', props: { id: 'bench-deep-normal-text', text: 'Deep normal text' } }]
                        }
                      }]
                    }
                  }]
                }
              }]
            }
          }]
        }
      }];
      window.puckDispatch({ type: 'setData', data: { content, zones: {}, root: { props: {} } } });
    });

    await expect(async () => {
      const text = await page.evaluate(() => window.puckState.data.content[0]?.props?.slotItem?.[0]?.props?.slotItem?.[0]?.props?.slotItem?.[0]?.props?.slotItem?.[0]?.props?.slotItem?.[0]?.props?.text);
      expect(text).toBe('Deep normal text');
    }).toPass({ timeout: 5000 });
    
    metrics['insert_5_level_nested_normal_ms'] = Date.now() - t0;
    console.log(`Insert 5-level nested normal component: ${metrics['insert_5_level_nested_normal_ms']}ms`);

    t0 = Date.now();
    await page.evaluate(() => {
      const c5 = window.puckState.data.content[0];
      const c4 = c5.props.slotItem[0];
      const c3 = c4.props.slotItem[0];
      const c2 = c3.props.slotItem[0];
      const c1 = c2.props.slotItem[0];
      const item = c1.props.slotItem[0];

      const newItem = { ...item, props: { ...item.props, text: 'Edited deep normal text' } };
      const newC1 = { ...c1, props: { ...c1.props, slotItem: [newItem] } };
      const newC2 = { ...c2, props: { ...c2.props, slotItem: [newC1] } };
      const newC3 = { ...c3, props: { ...c3.props, slotItem: [newC2] } };
      const newC4 = { ...c4, props: { ...c4.props, slotItem: [newC3] } };
      const newC5 = { ...c5, props: { ...c5.props, slotItem: [newC4] } };

      const newData = { ...window.puckState.data, content: [newC5] };
      window.puckDispatch({ type: 'setData', data: newData });
    });

    await expect(async () => {
      const text = await page.evaluate(() => window.puckState.data.content[0]?.props?.slotItem?.[0]?.props?.slotItem?.[0]?.props?.slotItem?.[0]?.props?.slotItem?.[0]?.props?.slotItem?.[0]?.props?.text);
      expect(text).toBe('Edited deep normal text');
    }).toPass({ timeout: 5000 });
    
    metrics['edit_5_level_nested_normal_ms'] = Date.now() - t0;
    console.log(`Edit 5-level nested normal component: ${metrics['edit_5_level_nested_normal_ms']}ms`);
  });

  // ── Benchmark: Edit single item (10 components registered) ────────────────────

  test('Benchmark: Edit single item with 10 components registered', async ({ page }) => {
    // Register 10 variants
    for (let i = 0; i < 10; i++) {
      await registerSoftComponent(page, `Heading${i}`, '1.0.0', {
        ...heading,
        name: `Heading${i}`,
      });
    }
    for (let i = 0; i < 10; i++) {
      await waitForRegistered(page, `Heading${i}`);
    }

    // Insert one item
    await insertComponent(page, 'Heading0', 'bench-single');
    await waitForPlaced(page, 'Heading0');

    // Time edit action
    const t0 = Date.now();
    await page.evaluate(() => {
      const item = window.puckState.data.content.find((n: any) => n.type === 'Heading0');
      if (!item) throw new Error('Heading0 not found');
      window.puckDispatch({
        type: 'replace',
        destinationZone: 'root:default-zone',
        destinationIndex: 0,
        data: { ...item, props: { ...item.props, text: 'Edited single text' } },
      });
    });

    await expect(async () => {
      const text = await page.evaluate(() => {
        const item = window.puckState.data.content.find((n: any) => n.type === 'Heading0');
        return item?.props?.text;
      });
      expect(text).toBe('Edited single text');
    }).toPass({ timeout: 5000 });

    metrics['edit_single_item_10_registered_ms'] = Date.now() - t0;
    console.log(`Edit single item (10 components): ${metrics['edit_single_item_10_registered_ms']}ms`);
  });

  // ── Benchmark: Edit single normal item (baseline) ───────────────────────────

  test('Benchmark: Edit single normal item (baseline)', async ({ page }) => {
    const data = await page.evaluate(() => {
      return {
        content: [{ type: 'container', props: { id: 'bench-single-normal', element: 'h1', attributes: [], values: {}, slotItem: [{ type: 'text', props: { id: 'bench-single-normal-text', text: 'Normal text' } }] } }],
        zones: {},
        root: { props: {} }
      };
    });
    await dispatchSetData(page, data);

    const t0 = Date.now();
    await page.evaluate(() => {
      const newData = { ...window.puckState.data };
      const c0 = newData.content[0];
      const item = c0.props.slotItem[0];
      const newItem = { ...item, props: { ...item.props, text: 'Edited single normal text' } };
      const newC0 = { ...c0, props: { ...c0.props, slotItem: [newItem] } };
      newData.content = [newC0];
      window.puckDispatch({ type: 'setData', data: newData });
    });

    await expect(async () => {
      const text = await page.evaluate(() => window.puckState.data.content[0]?.props?.slotItem?.[0]?.props?.text);
      expect(text).toBe('Edited single normal text');
    }).toPass({ timeout: 5000 });

    metrics['edit_single_normal_item_ms'] = Date.now() - t0;
    console.log(`Edit single normal item: ${metrics['edit_single_normal_item_ms']}ms`);
  });

  // ── Benchmark: 100 components operations ──────────────────────────────────────

  test('Benchmark: 100 components operations (edit, add, remove)', async ({ page }) => {
    await registerSoftComponent(page, 'Heading', '1.0.0', heading);
    await waitForRegistered(page, 'Heading');

    const data = await buildBulkData(page, 'Heading', 100, 'bench-ops');
    await dispatchSetData(page, data);

    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBeGreaterThanOrEqual(100);
    }).toPass({ timeout: 10000 });

    // 1. Edit one item of 100 components
    let t0 = Date.now();
    await page.evaluate(() => {
      const item = window.puckState.data.content[0];
      window.puckDispatch({
        type: 'replace',
        destinationZone: 'root:default-zone',
        destinationIndex: 0,
        data: { ...item, props: { ...item.props, title: 'Single edit in 100' } },
      });
    });
    await expect(async () => {
      const title = await page.evaluate(() => window.puckState.data.content[0]?.props?.title);
      expect(title).toBe('Single edit in 100');
    }).toPass({ timeout: 5000 });
    metrics['edit_one_of_100_ms'] = Date.now() - t0;
    console.log(`Edit one item of 100 components: ${metrics['edit_one_of_100_ms']}ms`);

    // 2. Add one new component to the 100
    t0 = Date.now();
    await page.evaluate(() => {
      window.puckDispatch({
        type: 'insert',
        componentType: 'Heading',
        destinationZone: 'root:default-zone',
        destinationIndex: 100,
        id: 'bench-ops-new',
      });
    });
    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBe(101);
    }).toPass({ timeout: 5000 });
    metrics['add_one_to_100_ms'] = Date.now() - t0;
    console.log(`Add one component to 100: ${metrics['add_one_to_100_ms']}ms`);

    // 3. Remove component from the 100
    t0 = Date.now();
    await page.evaluate(() => {
      window.puckDispatch({
        type: 'remove',
        index: 100,
        zone: 'root:default-zone',
      } as any);
    });
    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBe(100);
    }).toPass({ timeout: 5000 });
    metrics['remove_one_from_100_ms'] = Date.now() - t0;
    console.log(`Remove one component from 100: ${metrics['remove_one_from_100_ms']}ms`);
  });

  // ── Benchmark: 100 normal components operations (baseline) ──────────────────

  test('Benchmark: 100 normal components operations (baseline)', async ({ page }) => {
    test.setTimeout(60000);
    const data = await page.evaluate(() => {
      const content = Array.from({ length: 100 }, (_, i) => ({
        type: 'container',
        props: {
          id: `bench-ops-normal-${i}`,
          element: 'h1',
          attributes: [],
          values: {},
          slotItem: [{ type: 'text', props: { id: `bench-ops-normal-text-${i}`, text: 'Normal text' } }]
        },
      }));
      return { content, root: { props: {} }, zones: {} };
    });
    await dispatchSetData(page, data);

    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBeGreaterThanOrEqual(100);
    }).toPass({ timeout: 10000 });

    // 1. Edit one item
    let t0 = Date.now();
    await page.evaluate(() => {
      const newData = { ...window.puckState.data };
      const c0 = newData.content[0];
      const item = c0.props.slotItem[0];
      const newItem = { ...item, props: { ...item.props, text: 'Single normal edit in 100' } };
      const newC0 = { ...c0, props: { ...c0.props, slotItem: [newItem] } };
      newData.content = [newC0, ...newData.content.slice(1)];
      window.puckDispatch({ type: 'setData', data: newData });
    });
    await expect(async () => {
      const text = await page.evaluate(() => window.puckState.data.content[0]?.props?.slotItem?.[0]?.props?.text);
      expect(text).toBe('Single normal edit in 100');
    }).toPass({ timeout: 5000 });
    metrics['edit_one_of_100_normal_ms'] = Date.now() - t0;
    console.log(`Edit one normal item of 100: ${metrics['edit_one_of_100_normal_ms']}ms`);

    // 2. Add one new component
    t0 = Date.now();
    await page.evaluate(() => {
      window.puckDispatch({
        type: 'insert',
        componentType: 'container',
        destinationZone: 'root:default-zone',
        destinationIndex: 100,
        id: 'bench-ops-normal-new',
      });
    });
    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBe(101);
    }).toPass({ timeout: 5000 });
    metrics['add_one_to_100_normal_ms'] = Date.now() - t0;
    console.log(`Add one normal component to 100: ${metrics['add_one_to_100_normal_ms']}ms`);

    // 3. Remove component
    t0 = Date.now();
    await page.evaluate(() => {
      window.puckDispatch({
        type: 'remove',
        index: 100,
        zone: 'root:default-zone',
      } as any);
    });
    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBe(100);
    }).toPass({ timeout: 5000 });
    metrics['remove_one_from_100_normal_ms'] = Date.now() - t0;
    console.log(`Remove one normal component from 100: ${metrics['remove_one_from_100_normal_ms']}ms`);
  });

  // ── Benchmark: Move component ────────────────────────────────────────────────
  test('Benchmark: Move component within zone', async ({ page }) => {
    await registerSoftComponent(page, 'Heading', '1.0.0', heading);
    await waitForRegistered(page, 'Heading');

    const data = await buildBulkData(page, 'Heading', 2, 'bench-move');
    await dispatchSetData(page, data);

    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 10000 });

    const t0 = Date.now();
    await page.evaluate(() => {
      window.puckDispatch({
        type: 'move',
        sourceIndex: 0,
        sourceZone: 'root:default-zone',
        destinationIndex: 1,
        destinationZone: 'root:default-zone',
      });
    });

    await expect(async () => {
      const id = await page.evaluate(() => window.puckState.data.content[1]?.props?.id);
      expect(id).toBe('bench-move-0');
    }).toPass({ timeout: 5000 });

    metrics['move_component_ms'] = Date.now() - t0;
    console.log(`Move component: ${metrics['move_component_ms']}ms`);
  });

  // ── Benchmark: Move normal component (baseline) ──────────────────────────────
  test('Benchmark: Move normal component within zone (baseline)', async ({ page }) => {
    const data = await page.evaluate(() => {
      const content = Array.from({ length: 2 }, (_, i) => ({
        type: 'container',
        props: { id: `bench-move-normal-${i}`, element: 'h1', attributes: [], values: {} },
      }));
      return { content, root: { props: {} }, zones: {} };
    });
    await dispatchSetData(page, data);

    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 10000 });

    const t0 = Date.now();
    await page.evaluate(() => {
      window.puckDispatch({
        type: 'move',
        sourceIndex: 0,
        sourceZone: 'root:default-zone',
        destinationIndex: 1,
        destinationZone: 'root:default-zone',
      });
    });

    await expect(async () => {
      const id = await page.evaluate(() => window.puckState.data.content[1]?.props?.id);
      expect(id).toBe('bench-move-normal-0');
    }).toPass({ timeout: 5000 });

    metrics['move_normal_component_ms'] = Date.now() - t0;
    console.log(`Move normal component: ${metrics['move_normal_component_ms']}ms`);
  });

  // ── Benchmark: Duplicate component ───────────────────────────────────────────
  test('Benchmark: Duplicate component', async ({ page }) => {
    await registerSoftComponent(page, 'Heading', '1.0.0', heading);
    await waitForRegistered(page, 'Heading');

    await insertComponent(page, 'Heading', 'bench-dup-0');
    await waitForPlaced(page, 'Heading');

    const t0 = Date.now();
    await page.evaluate(() => {
      window.puckDispatch({
        type: 'duplicate',
        sourceIndex: 0,
        sourceZone: 'root:default-zone',
      });
    });

    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 5000 });

    metrics['duplicate_component_ms'] = Date.now() - t0;
    console.log(`Duplicate component: ${metrics['duplicate_component_ms']}ms`);
  });

  // ── Benchmark: Duplicate normal component (baseline) ─────────────────────────
  test('Benchmark: Duplicate normal component (baseline)', async ({ page }) => {
    const data = await page.evaluate(() => {
      const content = [{
        type: 'container',
        props: {
          id: 'bench-dup-normal-0',
          element: 'h1',
          attributes: [],
          values: {},
          slotItem: [{ type: 'text', props: { id: 'bench-dup-normal-text-0', text: 'Normal dup text' } }]
        }
      }];
      return { content, root: { props: {} }, zones: {} };
    });
    await dispatchSetData(page, data);

    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBe(1);
    }).toPass({ timeout: 5000 });

    const t0 = Date.now();
    await page.evaluate(() => {
      window.puckDispatch({
        type: 'duplicate',
        sourceIndex: 0,
        sourceZone: 'root:default-zone',
      });
    });

    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 5000 });

    metrics['duplicate_normal_component_ms'] = Date.now() - t0;
    console.log(`Duplicate normal component: ${metrics['duplicate_normal_component_ms']}ms`);
  });

  // ── Benchmark: Deep nested component deletion ────────────────────────────────
  test('Benchmark: Deep nested component deletion', async ({ page }) => {
    const buildDeep = (levels: number) => {
      let inner: any = {
        type: 'text',
        map: [{ mode: 'simple', from: 'text', to: 'text' }],
        fixedProps: {},
        components: {},
        enabledSlots: []
      };
      for (let i = levels; i > 0; i--) {
        inner = {
          type: 'container',
          map: [],
          fixedProps: { element: 'div', values: { className: `level-${i}` } },
          components: { slotItem: [inner] },
          enabledSlots: []
        };
      }
      return {
        name: `DeepDel5`,
        defaultVersion: '1.0.0',
        versions: {
          '1.0.0': {
            name: `DeepDel5`,
            fields: { text: { type: 'text', label: 'Text' } },
            fieldSettings: { text: { defaultValue: 'Deep text' } },
            defaultProps: { text: 'Deep text' },
            rootProps: {},
            components: [inner],
            slots: {}
          }
        }
      };
    };

    const deepComponent = buildDeep(5);
    await registerSoftComponent(page, 'DeepDel5', '1.0.0', deepComponent.versions['1.0.0']);
    await waitForRegistered(page, 'DeepDel5');

    await insertComponent(page, 'DeepDel5', 'bench-deep-del');
    await waitForPlaced(page, 'DeepDel5');

    const t0 = Date.now();
    await page.evaluate(() => {
      window.puckDispatch({
        type: 'remove',
        index: 0,
        zone: 'root:default-zone',
      });
    });

    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBe(0);
    }).toPass({ timeout: 5000 });

    metrics['delete_deep_nested_ms'] = Date.now() - t0;
    console.log(`Delete deep nested component: ${metrics['delete_deep_nested_ms']}ms`);
  });

  // ── Benchmark: Deep nested normal component deletion (baseline) ──────────────
  test('Benchmark: Deep nested normal component deletion (baseline)', async ({ page }) => {
    await page.evaluate(() => {
      const content = [{
        type: 'container',
        props: {
          id: 'bench-deep-del-normal-5',
          element: 'div',
          attributes: [],
          values: {},
          slotItem: [{
            type: 'container',
            props: {
              id: 'bench-deep-del-normal-4',
              element: 'div',
              attributes: [],
              values: {},
              slotItem: [{
                type: 'container',
                props: {
                  id: 'bench-deep-del-normal-3',
                  element: 'div',
                  attributes: [],
                  values: {},
                  slotItem: [{
                    type: 'container',
                    props: {
                      id: 'bench-deep-del-normal-2',
                      element: 'div',
                      attributes: [],
                      values: {},
                      slotItem: [{
                        type: 'container',
                        props: {
                          id: 'bench-deep-del-normal-1',
                          element: 'div',
                          attributes: [],
                          values: {},
                          slotItem: [{ type: 'text', props: { id: 'bench-deep-del-normal-text', text: 'Deep normal text' } }]
                        }
                      }]
                    }
                  }]
                }
              }]
            }
          }]
        }
      }];
      window.puckDispatch({ type: 'setData', data: { content, zones: {}, root: { props: {} } } });
    });

    await expect(async () => {
      const text = await page.evaluate(() => window.puckState.data.content[0]?.props?.slotItem?.[0]?.props?.slotItem?.[0]?.props?.slotItem?.[0]?.props?.slotItem?.[0]?.props?.slotItem?.[0]?.props?.text);
      expect(text).toBe('Deep normal text');
    }).toPass({ timeout: 5000 });

    const t0 = Date.now();
    await page.evaluate(() => {
      window.puckDispatch({
        type: 'remove',
        index: 0,
        zone: 'root:default-zone',
      });
    });

    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBe(0);
    }).toPass({ timeout: 5000 });

    metrics['delete_deep_nested_normal_ms'] = Date.now() - t0;
    console.log(`Delete deep nested normal component: ${metrics['delete_deep_nested_normal_ms']}ms`);
  });

  // ── Benchmark: Hydration with 50 components ──────────────────────────────────
  test('Benchmark: hydrateTransforms with 50 registered components', async ({ page }) => {
    for (let i = 0; i < 50; i++) {
      await registerSoftComponent(page, `HeadingHyd${i}`, '1.0.0', {
        ...heading,
        name: `HeadingHyd${i}`,
      });
    }

    // Wait for all to be registered
    for (let i = 0; i < 50; i++) {
      await waitForRegistered(page, `HeadingHyd${i}`, 10000);
    }

    const elapsed = await page.evaluate(() => {
      const t0 = performance.now();
      window.softConfigStore.getState().hydrateTransforms();
      return performance.now() - t0;
    });

    metrics['hydrateTransforms_50_components_ms'] = elapsed;
    console.log(`hydrateTransforms 50 components: ${elapsed.toFixed(2)}ms`);

    const count = await page.evaluate(() =>
      Object.keys(window.softConfigStore.getState().softConfig.components).filter(
        (k) => k.startsWith('HeadingHyd'),
      ).length,
    );
    expect(count).toBeGreaterThanOrEqual(50);
  });


  // ── Benchmark: setData 100 normal no slots (baseline) ────────────────

  test('Benchmark: setData 100 normal no slots (baseline)', async ({ page }) => {
    const data = await page.evaluate(() => {
      const content = Array.from({ length: 100 }, (_, i) => ({
        type: 'flatContainer',
        props: { id: `bench-100-noslot-${i}`, text: 'Normal text' },
      }));
      return { content, root: { props: {} }, zones: {} };
    });

    const elapsed = await page.evaluate(async (testData) => {
      const t0 = performance.now();
      window.puckDispatch({ type: 'setData', data: testData });
      // return when 100 items exist
      return new Promise<number>((resolve) => {
        const check = () => {
          if (window.puckState.data.content.length === 100) {
            resolve(performance.now() - t0);
          } else {
            requestAnimationFrame(check);
          }
        };
        check();
      });
    }, data);

    metrics['setData_100_normal_no_slots_ms'] = elapsed;
    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBe(100);
    }).toPass({ timeout: 10000 });

    console.log(`setData 100 Normal No Slots (Baseline): ${elapsed}ms`);
  });

  // ── Benchmark: Edit 100 normal no slots simultaneously (baseline) ─────────

  test('Benchmark: Edit 100 normal no slots simultaneously (baseline)', async ({ page }) => {
    const data = await page.evaluate(() => {
      const content = Array.from({ length: 100 }, (_, i) => ({
        type: 'flatContainer',
        props: { id: `bench-edit-100-noslot-${i}`, text: 'Normal text' },
      }));
      return { content, root: { props: {} }, zones: {} };
    });
    await dispatchSetData(page, data);

    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBe(100);
    }).toPass({ timeout: 10000 });

    const t0 = Date.now();
    await page.evaluate(() => {
      const newData = { ...window.puckState.data };
      newData.content = newData.content.map(c => ({...c, props: {...c.props, text: 'Bulk edited normal text'}}));
      window.puckDispatch({ type: 'setData', data: newData });
    });

    await expect(async () => {
      const firstText = await page.evaluate(() => window.puckState.data.content[0]?.props?.text);
      expect(firstText).toBe('Bulk edited normal text');
    }).toPass({ timeout: 5000 });

    metrics['edit_100_normal_no_slots_ms'] = Date.now() - t0;
    console.log(`Edit 100 normal no slots: ${metrics['edit_100_normal_no_slots_ms']}ms`);
  });

  // ── Benchmark: 5-level nested normal no slots insert and edit (baseline) ─────────────

  test('Benchmark: 5-level nested normal no slots insert and edit (baseline)', async ({ page }) => {
    let t0 = Date.now();
    await page.evaluate(() => {
      const content = [{ type: 'deepFlatContainer', props: { id: 'bench-deep-noslot-1', text: 'Deep normal text' } }];
      window.puckDispatch({ type: 'setData', data: { content, zones: {}, root: { props: {} } } });
    });

    await expect(async () => {
      const text = await page.evaluate(() => window.puckState.data.content[0]?.props?.text);
      expect(text).toBe('Deep normal text');
    }).toPass({ timeout: 5000 });
    
    metrics['insert_5_level_nested_normal_no_slots_ms'] = Date.now() - t0;
    console.log(`Insert 5-level nested normal no slots: ${metrics['insert_5_level_nested_normal_no_slots_ms']}ms`);

    t0 = Date.now();
    await page.evaluate(() => {
      const item = window.puckState.data.content[0];
      window.puckDispatch({
        type: 'replace',
        destinationZone: 'root:default-zone',
        destinationIndex: 0,
        data: { ...item, props: { ...item.props, text: 'Edited deep normal text' } },
      });
    });

    await expect(async () => {
      const text = await page.evaluate(() => window.puckState.data.content[0]?.props?.text);
      expect(text).toBe('Edited deep normal text');
    }).toPass({ timeout: 5000 });
    
    metrics['edit_5_level_nested_normal_no_slots_ms'] = Date.now() - t0;
    console.log(`Edit 5-level nested normal no slots: ${metrics['edit_5_level_nested_normal_no_slots_ms']}ms`);
  });

  // ── Benchmark: Edit single normal no slots item (baseline) ───────────────────────────

  test('Benchmark: Edit single normal no slots item (baseline)', async ({ page }) => {
    const data = await page.evaluate(() => {
      return {
        content: [{ type: 'flatContainer', props: { id: 'bench-single-noslot', text: 'Normal text' } }],
        zones: {},
        root: { props: {} }
      };
    });
    await dispatchSetData(page, data);

    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBe(1);
    }).toPass({ timeout: 5000 });

    const t0 = Date.now();
    await page.evaluate(() => {
      const item = window.puckState.data.content[0];
      window.puckDispatch({
        type: 'replace',
        destinationZone: 'root:default-zone',
        destinationIndex: 0,
        data: { ...item, props: { ...item.props, text: 'Edited single normal text' } },
      });
    });

    await expect(async () => {
      const text = await page.evaluate(() => window.puckState.data.content[0]?.props?.text);
      expect(text).toBe('Edited single normal text');
    }).toPass({ timeout: 5000 });

    metrics['edit_single_normal_no_slots_ms'] = Date.now() - t0;
    console.log(`Edit single normal no slots item: ${metrics['edit_single_normal_no_slots_ms']}ms`);
  });

  // ── Benchmark: 100 normal no slots components operations (baseline) ──────────────────

  test('Benchmark: 100 normal no slots components operations (baseline)', async ({ page }) => {
    const data = await page.evaluate(() => {
      const content = Array.from({ length: 100 }, (_, i) => ({
        type: 'flatContainer',
        props: { id: `bench-ops-noslot-${i}`, text: 'Normal text' },
      }));
      return { content, root: { props: {} }, zones: {} };
    });
    await dispatchSetData(page, data);

    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBeGreaterThanOrEqual(100);
    }).toPass({ timeout: 10000 });

    // 1. Edit one item
    let t0 = Date.now();
    await page.evaluate(() => {
      const item = window.puckState.data.content[0];
      window.puckDispatch({
        type: 'replace',
        destinationZone: 'root:default-zone',
        destinationIndex: 0,
        data: { ...item, props: { ...item.props, text: 'Single normal edit in 100' } },
      });
    });
    await expect(async () => {
      const text = await page.evaluate(() => window.puckState.data.content[0]?.props?.text);
      expect(text).toBe('Single normal edit in 100');
    }).toPass({ timeout: 5000 });
    metrics['edit_one_of_100_normal_no_slots_ms'] = Date.now() - t0;
    console.log(`Edit one normal no slots item of 100: ${metrics['edit_one_of_100_normal_no_slots_ms']}ms`);

    // 2. Add one new component
    t0 = Date.now();
    await page.evaluate(() => {
      window.puckDispatch({
        type: 'insert',
        componentType: 'flatContainer',
        destinationZone: 'root:default-zone',
        destinationIndex: 100,
        id: 'bench-ops-noslot-new',
      });
    });
    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBe(101);
    }).toPass({ timeout: 5000 });
    metrics['add_one_to_100_normal_no_slots_ms'] = Date.now() - t0;
    console.log(`Add one normal no slots component to 100: ${metrics['add_one_to_100_normal_no_slots_ms']}ms`);

    // 3. Remove component
    t0 = Date.now();
    await page.evaluate(() => {
      window.puckDispatch({
        type: 'remove',
        index: 100,
        zone: 'root:default-zone',
      } as any);
    });
    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBe(100);
    }).toPass({ timeout: 5000 });
    metrics['remove_one_from_100_normal_no_slots_ms'] = Date.now() - t0;
    console.log(`Remove one normal no slots component from 100: ${metrics['remove_one_from_100_normal_no_slots_ms']}ms`);
  });

  // ── Benchmark: Move normal no slots component (baseline) ──────────────────────────────
  test('Benchmark: Move normal no slots component within zone (baseline)', async ({ page }) => {
    const data = await page.evaluate(() => {
      const content = Array.from({ length: 2 }, (_, i) => ({
        type: 'flatContainer',
        props: { id: `bench-move-noslot-${i}`, text: 'Normal text' },
      }));
      return { content, root: { props: {} }, zones: {} };
    });
    await dispatchSetData(page, data);

    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 10000 });

    const t0 = Date.now();
    await page.evaluate(() => {
      window.puckDispatch({
        type: 'move',
        sourceIndex: 0,
        sourceZone: 'root:default-zone',
        destinationIndex: 1,
        destinationZone: 'root:default-zone',
      });
    });

    await expect(async () => {
      const id = await page.evaluate(() => window.puckState.data.content[1]?.props?.id);
      expect(id).toBe('bench-move-noslot-0');
    }).toPass({ timeout: 5000 });

    metrics['move_normal_no_slots_component_ms'] = Date.now() - t0;
    console.log(`Move normal no slots component: ${metrics['move_normal_no_slots_component_ms']}ms`);
  });

  // ── Benchmark: Duplicate normal no slots component (baseline) ─────────────────────────
  test('Benchmark: Duplicate normal no slots component (baseline)', async ({ page }) => {
    const data = await page.evaluate(() => {
      const content = [{ type: 'flatContainer', props: { id: 'bench-dup-noslot-0', text: 'Normal dup text' } }];
      return { content, root: { props: {} }, zones: {} };
    });
    await dispatchSetData(page, data);

    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBe(1);
    }).toPass({ timeout: 5000 });

    const t0 = Date.now();
    await page.evaluate(() => {
      window.puckDispatch({
        type: 'duplicate',
        sourceIndex: 0,
        sourceZone: 'root:default-zone',
      });
    });

    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 5000 });

    metrics['duplicate_normal_no_slots_component_ms'] = Date.now() - t0;
    console.log(`Duplicate normal no slots component: ${metrics['duplicate_normal_no_slots_component_ms']}ms`);
  });

  // ── Benchmark: Deep nested normal no slots component deletion (baseline) ──────────────
  test('Benchmark: Deep nested normal no slots component deletion (baseline)', async ({ page }) => {
    await page.evaluate(() => {
      const content = [{ type: 'deepFlatContainer', props: { id: 'bench-deep-del-noslot-1', text: 'Deep normal text' } }];
      window.puckDispatch({ type: 'setData', data: { content, zones: {}, root: { props: {} } } });
    });

    await expect(async () => {
      const text = await page.evaluate(() => window.puckState.data.content[0]?.props?.text);
      expect(text).toBe('Deep normal text');
    }).toPass({ timeout: 5000 });

    const t0 = Date.now();
    await page.evaluate(() => {
      window.puckDispatch({
        type: 'remove',
        index: 0,
        zone: 'root:default-zone',
      });
    });

    await expect(async () => {
      const count = await page.evaluate(() => window.puckState.data.content.length);
      expect(count).toBe(0);
    }).toPass({ timeout: 5000 });

    metrics['delete_deep_nested_normal_no_slots_ms'] = Date.now() - t0;
    console.log(`Delete deep nested normal no slots component: ${metrics['delete_deep_nested_normal_no_slots_ms']}ms`);
  });
});

