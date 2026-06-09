import re

tests = """

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
"""

with open('/home/osamu/Documents/netlisian-soft/apps/e2e/e2e/benchmark.spec.ts', 'r') as f:
    content = f.read()

pos = content.rfind('});')
content = content[:pos] + tests + content[pos:]

with open('/home/osamu/Documents/netlisian-soft/apps/e2e/e2e/benchmark.spec.ts', 'w') as f:
    f.write(content)

