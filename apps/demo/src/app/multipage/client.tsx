"use client";

import React, { useCallback, useMemo } from "react";
import {
  Puck,
  Data,
  Config,
  Fields,
  AppState,
  PuckAction,
  createUsePuck,
  PuckComponent,
  WithChildren,
  DefaultComponentProps,
  Button,
} from "@measured/puck";
import { initTailwind, TailwindProcessor } from "@netlisian/tailwind";
import {
  puckDataToCollection,
  collectionToPuckData,
} from "./components/converters";
import { createMultipagePlugin } from "./components/plugin";
import { softConfigOverrides } from "../../puck/overrides/softconfig";
import { useDemoCollection } from "../../lib/use-demo-data";
import { config as baseConfig } from "../../config";
import "@measured/puck/puck.css";
import "@netlisian/outline/dist/index.css";
import {
  createMultipageRootConfig,
  MultipageRoot,
} from "./components/MultipageRoot";

import {
  ActionBar,
  HeaderActions,
  SoftConfigProvider,
  createUseSoftConfig,
  DrawerItem,
  useSoftConfigStore,
  createActionCallback,
} from "@netlisian/softconfig/puck";
import "@netlisian/softconfig/puck/index.css";
const useSoftConfig = createUseSoftConfig();
const useCustomPuck = createUsePuck();

const PuckLifecycle = ({
  processorRef,
}: {
  processorRef: React.MutableRefObject<TailwindProcessor | null>;
}) => {
  const undo = useCustomPuck((s) => s.history?.back);
  const dispatch = useCustomPuck((s) => s.dispatch);
  const setUndoFn = useSoftConfig((s) => s.setUndoFn);
  const setPuckDispatch = useSoftConfig((s) => s.setPuckDispatch);
  const undoFn = useSoftConfig((s) => s.undoFn);
  const setIframeDocForSoftConfig = useSoftConfig((s) => s.setIframeDoc);
  const setContentAreaNames = useSoftConfig((s) => s.setContentAreaNames);
  const collection = useCustomPuck(
    (s) => (s.appState.data?.root?.props as any)?.collection,
  );

  React.useEffect(() => {
    if (undoFn !== undo) {
      setUndoFn(undo);
    }
  }, [undo, setUndoFn, undoFn]);

  React.useEffect(() => {
    setPuckDispatch(dispatch);
  }, [dispatch, setPuckDispatch]);

  React.useEffect(() => {
    // Bind Tailwind to the main document (acting as preview frame) since iframe is disabled
    initTailwind(document).then((_p) => {
      if (_p) processorRef.current = _p;
    });
    setIframeDocForSoftConfig(document);
  }, [processorRef, setIframeDocForSoftConfig]);

  React.useEffect(() => {
    if (collection && Array.isArray(collection)) {
      const paths = collection.map(
        (_, i) => `root.props.collection[${i}].page`,
      );
      setContentAreaNames(paths);
    } else {
      setContentAreaNames(undefined);
    }
  }, [collection, setContentAreaNames]);

  return null;
};

const createOverrides = (
  processorRef: React.MutableRefObject<TailwindProcessor | null>,
) => ({
  headerActions: (props: any) => {
    // Temp data
    const data = useCustomPuck((s) => s.appState.data);
    return (
      <>
        <PuckLifecycle processorRef={processorRef} />
        <HeaderActions {...props} />
        <Button
          onClick={() => {
            console.log(data);
          }}
        >
          Test
        </Button>
      </>
    );
  },
  drawerItem: DrawerItem,
});

const puckPlugins = [
  createMultipagePlugin({
    actionBar: ActionBar,
  }),
];
const puckIframe = { enabled: false };

interface PuckInnerProps {
  multipageConfig: Config;
  initialData: Data;
  collection: any;
  saveBatch: (pages: any) => Promise<void>;
  removePages: (ids: string[]) => Promise<void>;
  processorRef: React.MutableRefObject<TailwindProcessor | null>;
  storeRef?: React.MutableRefObject<any>;
}

const PuckInner = React.memo(
  ({
    multipageConfig,
    initialData,
    collection,
    saveBatch,
    removePages,
    processorRef,
    storeRef,
  }: PuckInnerProps) => {
    const softConfig = useSoftConfig((s) => s.softConfig);
    const store = useSoftConfigStore();

    React.useEffect(() => {
      if (storeRef) storeRef.current = store;
    }, [store, storeRef]);

    const onAction = useCallback(
      (action: PuckAction, appState: AppState, previousState: AppState) => {
        const { state, validateAction, undoFn, rootActionHandler } =
          store.getState();

        // Create the action guard using softconfig's validation and undo functions
        // Perform validation and undo if necessary
        const actionValidator = createActionCallback(validateAction, undoFn);

        if (state !== "ready") {
          console.log(12, action);
          actionValidator(action);
          rootActionHandler?.(action, appState, previousState);
        } else {
          console.log(101, action);
        }
      },
      [store],
    );

    const mergedConfig = useMemo(() => {
      const resolveFields: NonNullable<
        Config["root"]
      >["resolveFields"] = async (
        data: Parameters<
          Exclude<NonNullable<Config["root"]>["resolveFields"], undefined>
        >[0],
        params: Parameters<
          Exclude<NonNullable<Config["root"]>["resolveFields"], undefined>
        >[1],
      ) => {
        let newFields = { ...params.fields };
        // Read the latest state directly from the store
        if (softConfig.root?.resolveFields) {
          newFields = {
            ...((softConfig.root.fields || {}) as Fields),
            ...(await softConfig.root.resolveFields(data, {
              ...params,
              fields: newFields,
            })),
          };
        }
        delete newFields.title;
        return newFields;
      };

      const finalConfig: Config = {
        ...multipageConfig,
        ...softConfig,
        root: {
          ...multipageConfig.root,
          fields: {
            ...multipageConfig.root?.fields,
            ...softConfig.root?.fields,
          },
          defaultProps: {
            ...multipageConfig.root?.defaultProps,
            ...softConfig.root?.defaultProps,
          },
          resolveFields,
        },
      };
      delete finalConfig.root?.fields?.title;

      return finalConfig;
    }, [multipageConfig, softConfig]);

    const onPublish = useCallback(
      async (newData: Data) => {
        const rawOriginalCollection = Object.fromEntries(
          Object.entries(collection).map(([k, v]: [string, any]) => [
            k,
            v.data as Data,
          ]),
        );

        const separatedPages = puckDataToCollection(
          newData,
          rawOriginalCollection,
          { collectionName: "collection", pageName: "page" },
        );

        console.log("Published multipage data:", newData);
        console.log(
          "Converted back to individual pages (only changes):",
          separatedPages,
        );

        await saveBatch(separatedPages);

        const currentIds = new Set(
          (newData.root?.props as any)?.collection?.map((p: any) => p.id) || [],
        );
        const removedIds = Object.keys(rawOriginalCollection).filter(
          (id) => !currentIds.has(id),
        );

        if (removedIds.length > 0) {
          console.log("Removing deleted pages:", removedIds);
          await removePages(removedIds);
        }
      },
      [collection, saveBatch, removePages],
    );

    const puckOverrides = useMemo(
      () => createOverrides(processorRef),
      [processorRef],
    );

    return (
      <Puck
        config={mergedConfig}
        data={initialData}
        onAction={onAction}
        onPublish={onPublish}
        plugins={puckPlugins}
        iframe={puckIframe}
        overrides={puckOverrides}
      />
    );
  },
);
PuckInner.displayName = "PuckInner";

export default function MultipageClient() {
  const [isMounted, setIsMounted] = React.useState(false);
  const {
    collection,
    saveBatch,
    removePages,
    softComponents,
    saveSoftComponents,
  } = useDemoCollection();
  const processorRef = React.useRef<TailwindProcessor | null>(null);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Convert individual collection items into a monolithic puck data structure
  // We only do this ONCE on mount (initialData). If we update this when `collection`
  // changes (e.g. after publishing/saving), Puck receives a new `data` object reference
  // and triggers a global `setData` action, which forces EVERY component to re-render.
  const [initialData] = React.useState(() => {
    const rawCollection = Object.fromEntries(
      Object.entries(collection).map(([k, v]) => [k, v.data as Data]),
    );
    const pagesList = Object.keys(rawCollection).map((path) => ({
      id: path,
      title: rawCollection[path]?.root?.props?.title || path,
      slug: path,
    }));
    return collectionToPuckData(rawCollection, pagesList, {
      collectionName: "collection",
      pageName: "page",
    });
  });

  const multipageConfig = useMemo(() => {
    const {
      fields: multipageFields,
      defaultProps: multipageDefaultProps,
      render,
    } = createMultipageRootConfig();

    return {
      ...baseConfig,
      root: {
        ...baseConfig.root,
        fields: {
          ...baseConfig.root?.fields,
          ...multipageFields,
        },
        defaultProps: {
          ...baseConfig.root?.defaultProps,
          ...multipageDefaultProps,
        },
        render,
      },
    } as Config;
  }, []);

  const storeRef = React.useRef<any>(null);

  if (!isMounted) {
    return null;
  }

  const handleSoftActions = async (event: any) => {
    const eventType = event.type;
    if (["demolish", "deleteVersion", "complete"].includes(eventType)) {
      setTimeout(() => {
        if (storeRef.current) {
          const storeState = storeRef.current.getState();
          if (storeState && storeState.softComponents) {
            saveSoftComponents(storeState.softComponents);
          }
        }
      }, 0);
    }
  };

  return (
    <SoftConfigProvider
      hardConfig={baseConfig}
      overrides={softConfigOverrides}
      softComponents={softComponents}
      onActions={handleSoftActions}
    >
      {() => (
        <PuckInner
          storeRef={storeRef}
          multipageConfig={multipageConfig}
          initialData={initialData as Data}
          collection={collection}
          saveBatch={saveBatch}
          removePages={removePages}
          processorRef={processorRef}
        />
      )}
    </SoftConfigProvider>
  );
}
