import { useSoftConfig } from "../context/useStore";

export const useSetDefaultVersion = () => {
  const setSoftComponentDefaultVersion = useSoftConfig(
    (s) => s.setSoftComponentDefaultVersion
  );
  const softComponents = useSoftConfig((s) => s.softComponents);
  const status = useSoftConfig((s) => s.state);

  const handleSetDefaultVersion = (componentName: string, version: string) => {
    if (status !== "ready") {
      return;
    }

    if (!Object.keys(softComponents).includes(componentName)) {
      return;
    }

    const component = softComponents[componentName];
    if (!component?.versions[version]) {
      return;
    }

    setSoftComponentDefaultVersion(componentName, version);
  };

  const canSetDefaultVersion = (componentName: string, version: string) => {
    const component = softComponents[componentName];
    return (
      status === "ready" &&
      component !== undefined &&
      component.versions[version] !== undefined &&
      component.defaultVersion !== version
    );
  };

  const getVersions = (componentName: string) => {
    return Object.keys(softComponents[componentName]?.versions || {});
  };

  const getDefaultVersion = (componentName: string) => {
    return softComponents[componentName]?.defaultVersion;
  };

  return {
    handleSetDefaultVersion,
    canSetDefaultVersion,
    getVersions,
    getDefaultVersion,
  };
};
