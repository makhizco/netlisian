# Puck Soft Config

Enhanced configuration and UI utilities for Puck that add “soft components” (composable, versioned, and remodelable components) plus ready-to-use UI chrome.

## Packages & Exports

- `@netlisian/softconfig` → bundled CJS/ESM + types (`./dist/index.{js,mjs,d.ts}`)
- `@netlisian/softconfig/puck` → Puck-focused entry (`./dist/puck/index.*`)
- Styles: `@netlisian/softconfig/styles.css` (alias `./dist/index.css`) and `@netlisian/softconfig/puck/index.css`

Peer dependencies: `react@^18`, `@measured/puck@0.20.x`.

## Install

```bash
pnpm add @netlisian/softconfig @measured/puck react
```

## Quick Start

```tsx
import { SoftConfigProvider } from "@netlisian/softconfig/puck";
import "@netlisian/softconfig/styles.css";

const hardConfig = { components: {/* your hard Puck components */} };
const softComponents = {/* optional persisted soft components */};
const overrides = {/* optional UI overrides like map/action bar/etc. */};

export default function App({ children }: { children: React.ReactNode }) {
  return (
    <SoftConfigProvider
      hardConfig={hardConfig}
      softComponents={softComponents}
      overrides={overrides}
    >
      {(softConfig, softComponentsRegistry) => (
        /* render Puck with the soft-config-driven config */
        <YourPuckHost config={softConfig} softComponents={softComponentsRegistry} />
      )}
    </SoftConfigProvider>
  );
}
```

`SoftConfigProvider` accepts an optional `value` prop if you want to bring your own Zustand store (see `src/puck/context/storeProvider.tsx`). Children are rendered via a render-prop to give you the hydrated `softConfig` and `softComponents` to pass directly to Puck.

## Field Mapping & Transforms

- Soft components support `_map` entries with optional transforms or CVA-like configs. Because functions are not persisted, the library regenerates missing transforms at runtime (including during remodel/decompose) using the stored CVA config.
- Field defaults are read from `_fieldSettings` when resolving mappings, so mapped props fall back to configured defaults when source data is absent.

## Styles

Import once in your app root:

```ts
import "@netlisian/softconfig/styles.css";
```

## Overrides

You can supply custom overrides (action bar, headers, map UI, etc.) through the `overrides` prop. See `src/puck/types/Overrides.ts` for the full surface.

## Action Lifecycle Events

`SoftConfigProvider` supports `onActions` for lifecycle callbacks:

- `build` → when build mode starts
- `remodel` → when remodel mode starts
- `complete` → when a build/remodel is finalized
- `inspect` → when inspect is requested
- `demolish` → when a soft component is deleted
- `setDefaultVersion`, `decompose`, `cancel`, `publish`

Version-aware payloads are included for build finalization and inspection flows:

```ts
type ActionEventPayload =
  | {
      type: "remodel";
      payload: {
        id: string;
        version?: string;
        softComponent?: VersionedSoftComponent["versions"][string];
      };
    }
  | {
      type: "complete";
      payload: {
        id: string;
        version: string;
        componentData: Record<string, any>;
        softComponent: VersionedSoftComponent["versions"][string];
      };
    }
  | {
      type: "inspect";
      payload: {
        id: string;
        version?: string;
        softComponent?: VersionedSoftComponent["versions"][string];
      };
    }
  | {
      type: "demolish";
      payload: {
        id: string;
      };
    };
```

This contract allows downstream consumers (for example, save/sync bridges) to persist using exact version metadata without relying on inferred/default versions.

## Development

- Build: `pnpm --filter @netlisian/softconfig build`
- Dev (watch): `pnpm --filter @netlisian/softconfig dev`
- Lint: `pnpm --filter @netlisian/softconfig lint`

## License

MIT
