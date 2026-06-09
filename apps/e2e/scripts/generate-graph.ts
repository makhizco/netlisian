import fs from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';

const REPORT_PATH = path.join(__dirname, '..', 'test-results', 'benchmark-report.json');
const PREV_REPORT_PATH = path.join(__dirname, '..', 'benchmark-report-previous.json');
const OUTPUT_DIR = path.join(__dirname, '..', 'test-results');

const GROUPINGS: Record<string, string[]> = {
  'setup-and-hydration': ['hydrateTransforms_10_components_ms', 'hydrateTransforms_50_components_ms', 'soft_component_remodel_ms'],
  'single-operations': [
    'cva_variant_replace_ms', 
    'edit_single_item_10_registered_ms', 
    'insert_5_level_nested_ms', 
    'edit_5_level_nested_ms', 
    'move_component_ms', 
    'duplicate_component_ms', 
    'delete_deep_nested_ms'
  ],
  'bulk-operations': [
    'setData_100_headings_ms', 
    'edit_100_components_ms', 
    'edit_one_of_100_ms', 
    'add_one_to_100_ms', 
    'remove_one_from_100_ms'
  ]
};

const NORMAL_BASELINE_MAP: Record<string, string> = {
  'setData_100_headings_ms': 'setData_100_normal_components_ms',
  'edit_100_components_ms': 'edit_100_normal_components_ms',
  'insert_5_level_nested_ms': 'insert_5_level_nested_normal_ms',
  'edit_5_level_nested_ms': 'edit_5_level_nested_normal_ms',
  'edit_single_item_10_registered_ms': 'edit_single_normal_item_ms',
  'edit_one_of_100_ms': 'edit_one_of_100_normal_ms',
  'add_one_to_100_ms': 'add_one_to_100_normal_ms',
  'remove_one_from_100_ms': 'remove_one_from_100_normal_ms',
  'move_component_ms': 'move_normal_component_ms',
  'duplicate_component_ms': 'duplicate_normal_component_ms',
  'delete_deep_nested_ms': 'delete_deep_nested_normal_ms'
};

const NORMAL_NO_SLOT_BASELINE_MAP: Record<string, string> = {
  'setData_100_headings_ms': 'setData_100_normal_no_slots_ms',
  'edit_100_components_ms': 'edit_100_normal_no_slots_ms',
  'insert_5_level_nested_ms': 'insert_5_level_nested_normal_no_slots_ms',
  'edit_5_level_nested_ms': 'edit_5_level_nested_normal_no_slots_ms',
  'edit_single_item_10_registered_ms': 'edit_single_normal_no_slots_ms',
  'edit_one_of_100_ms': 'edit_one_of_100_normal_no_slots_ms',
  'add_one_to_100_ms': 'add_one_to_100_normal_no_slots_ms',
  'remove_one_from_100_ms': 'remove_one_from_100_normal_no_slots_ms',
  'move_component_ms': 'move_normal_no_slots_component_ms',
  'duplicate_component_ms': 'duplicate_normal_no_slots_component_ms',
  'delete_deep_nested_ms': 'delete_deep_nested_normal_no_slots_ms'
};

function formatLabel(key: string) {
  // Remove trailing _ms and replace underscores with spaces
  let formatted = key.replace(/_ms$/, '').replace(/_/g, ' ');
  // Clean up specific labels for clarity
  formatted = formatted.replace(/setData 100 headings/i, 'setData 100');
  // Convert camelCase to spaces (e.g. setData -> set Data)
  formatted = formatted.replace(/([a-z])([A-Z])/g, '$1 $2');
  // Title Case
  return formatted.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

async function run() {
  if (!fs.existsSync(REPORT_PATH)) {
    console.error(`Report file not found: ${REPORT_PATH}`);
    process.exit(1);
  }

  const currentData = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8'));
  let previousData: Record<string, number> = {};

  if (fs.existsSync(PREV_REPORT_PATH)) {
    previousData = JSON.parse(fs.readFileSync(PREV_REPORT_PATH, 'utf-8'));
    console.log('Found previous benchmark report. Will compare speeds.');
  }

  const browser = await chromium.launch({ headless: true });

  for (const [groupName, keys] of Object.entries(GROUPINGS)) {
    const page = await browser.newPage();
    const labels: string[] = [];
    const softCurrentValues: number[] = [];
    const softPreviousValues: number[] = [];
    const normalCurrentValues: number[] = [];
    const normalNoSlotCurrentValues: number[] = [];

    // Filter keys that actually exist in the current run
    for (const key of keys) {
      if (currentData[key] !== undefined) {
        labels.push(formatLabel(key));
        
        // Soft Component (Current)
        softCurrentValues.push(Number(currentData[key].toFixed(2)));
        
        // Soft Component (Previous)
        if (previousData[key] !== undefined) {
          softPreviousValues.push(Number(previousData[key].toFixed(2)));
        } else {
          softPreviousValues.push(0);
        }

        // Normal Component (Current)
        const normalKey = NORMAL_BASELINE_MAP[key];
        if (normalKey && currentData[normalKey] !== undefined) {
          normalCurrentValues.push(Number(currentData[normalKey].toFixed(2)));
        } else {
          normalCurrentValues.push(0);
        }

        // Normal Component No Slot (Current)
        const normalNoSlotKey = NORMAL_NO_SLOT_BASELINE_MAP[key];
        if (normalNoSlotKey && currentData[normalNoSlotKey] !== undefined) {
          normalNoSlotCurrentValues.push(Number(currentData[normalNoSlotKey].toFixed(2)));
        } else {
          normalNoSlotCurrentValues.push(0);
        }
      }
    }

    if (labels.length === 0) {
      await page.close();
      continue;
    }

    const datasets = [];

    const hasPrevious = softPreviousValues.some(v => v > 0);
    if (hasPrevious) {
      datasets.push({
        label: 'Soft Comp (Prev ms)',
        data: softPreviousValues,
        backgroundColor: 'rgba(200, 200, 200, 0.7)',
        borderColor: 'rgba(150, 150, 150, 1)',
        borderWidth: 1,
        datalabels: { align: 'end', anchor: 'end' }
      });
    }

    datasets.push({
      label: 'Soft Comp (Current ms)',
      data: softCurrentValues,
      backgroundColor: 'rgba(54, 162, 235, 0.7)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1,
      datalabels: { align: 'end', anchor: 'end' }
    });

    const hasNormal = normalCurrentValues.some(v => v > 0);
    if (hasNormal) {
      datasets.push({
        label: 'Normal Comp (Baseline ms)',
        data: normalCurrentValues,
        backgroundColor: 'rgba(255, 159, 64, 0.7)',
        borderColor: 'rgba(255, 159, 64, 1)',
        borderWidth: 1,
        datalabels: { align: 'end', anchor: 'end' }
      });
    }

    const hasNormalNoSlot = normalNoSlotCurrentValues.some(v => v > 0);
    if (hasNormalNoSlot) {
      datasets.push({
        label: 'Normal No Slot (Baseline ms)',
        data: normalNoSlotCurrentValues,
        backgroundColor: 'rgba(75, 192, 192, 0.7)', // Teal
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
        datalabels: { align: 'end', anchor: 'end' }
      });
    }

    const title = groupName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0"></script>
          <style>
            body { font-family: sans-serif; background: white; margin: 0; padding: 20px; }
            .chart-container { width: 900px; height: 500px; }
          </style>
        </head>
        <body>
          <div class="chart-container">
            <canvas id="myChart"></canvas>
          </div>
          <script>
            Chart.register(ChartDataLabels);
            const ctx = document.getElementById('myChart').getContext('2d');
            new Chart(ctx, {
              type: 'bar',
              data: {
                labels: ${JSON.stringify(labels)},
                datasets: ${JSON.stringify(datasets)}
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                layout: {
                  padding: {
                    top: 30 // Make room for labels
                  }
                },
                plugins: {
                  title: { display: true, text: '${title} Benchmarks', font: { size: 24 } },
                  datalabels: {
                    color: '#444',
                    font: { weight: 'bold' },
                    formatter: function(value) {
                      return value > 0 ? value + 'ms' : '';
                    }
                  }
                },
                scales: {
                  y: { beginAtZero: true, title: { display: true, text: 'Time (ms)' }, suggestedMax: Math.max(...${JSON.stringify([...softCurrentValues, ...softPreviousValues, ...normalCurrentValues, ...normalNoSlotCurrentValues])}) * 1.15 }
                }
              }
            });
            window.chartRendered = true;
          </script>
        </body>
      </html>
    `;

    await page.setContent(htmlContent, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.chartRendered === true);
    await page.waitForTimeout(500);

    const outputPath = path.join(OUTPUT_DIR, `benchmark-graph-${groupName}.png`);
    const element = await page.locator('.chart-container');
    await element.screenshot({ path: outputPath });
    console.log(`✅ Generated graph: ${outputPath}`);
    await page.close();
  }

  await browser.close();
}

run().catch(err => {
  console.error('Error generating graph:', err);
  process.exit(1);
});
