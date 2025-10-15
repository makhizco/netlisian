import { useState } from "react";
import { Button, IconButton } from "@measured/puck";
import { useDemolish } from "../actions/useDemolish";
import { useSetDefaultVersion } from "../actions/useSetDefaultVersion";
import { useSoftConfig } from "../context/useStore";
import { GripVertical, Check, X, Trash2, Cog } from "lucide-react";
import { confirm } from "../lib/confirm";
import getClassNameFactory from "../lib/get-class-name-factory";
import styles from "./ComponentItem.module.css";
import { Modal } from "../components/modal";

const getClassName = getClassNameFactory("ComponentItem", styles);

export const ComponentItem = (props: {
  name: string;
  children: React.ReactNode;
}): React.ReactElement => {
  const softComponents = new Set(
    Object.keys(useSoftConfig((s) => s.softComponents))
  );
  const removeSoftComponentVersion = useSoftConfig(
    (s) => s.removeSoftComponentVersion
  );

  const { handleDemolish } = useDemolish();
  const { handleSetDefaultVersion, getVersions, getDefaultVersion } =
    useSetDefaultVersion();

  const [isEditing, setIsEditing] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [versionsToDelete, setVersionsToDelete] = useState<Set<string>>(
    new Set()
  );
  const [migrateVersionMap, setMigrateVersionMap] = useState<
    Record<string, string>
  >({});

  const versions = getVersions(props.name);
  const defaultVersion = getDefaultVersion(props.name);

  const handleApply = async () => {
    if (selectedVersion && selectedVersion !== defaultVersion) {
      handleSetDefaultVersion(props.name, selectedVersion);
    }

    if (versionsToDelete.size > 0) {
      for (const version of versionsToDelete) {
        const remaining = versions.filter((v) => !versionsToDelete.has(v));
        if (remaining.length === 0) {
          const shouldDemolish = await confirm(
            `Deleting all versions will remove "${props.name}" entirely. Continue?`
          );
          if (shouldDemolish) {
            handleDemolish(props.name);
          }
          break;
        } else {
          removeSoftComponentVersion(props.name, version);
        }
      }
    }

    setIsEditing(false);
    setSelectedVersion("");
    setVersionsToDelete(new Set());
    setMigrateVersionMap({});
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedVersion("");
    setVersionsToDelete(new Set());
    setMigrateVersionMap({});
  };

  const toggleVersionForDeletion = (version: string) => {
    const newSet = new Set(versionsToDelete);
    if (newSet.has(version)) {
      newSet.delete(version);
    } else {
      newSet.add(version);
    }
    setVersionsToDelete(newSet);
  };

  const handleDemolishClick = async () => {
    const confirmed = await confirm(
      `Demolish "${props.name}" entirely? This will remove all versions.`
    );
    if (confirmed) {
      handleDemolish(props.name);
      setIsEditing(false);
    }
  };

  if (softComponents.has(props.name)) {
    const availableVersions = versions.filter((v) => !versionsToDelete.has(v));

    return (
      <>
        <div
          className={getClassName()}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <div className={getClassName("content")}>
            <div className={getClassName("name")}>{props.name}</div>
            <div className={getClassName("version")}>v{defaultVersion}</div>
          </div>

          <div className={getClassName("actions")}>
            {isHovering && (
              <div className={getClassName("settingsButton")}>
                <IconButton
                  title="Settings"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                    setSelectedVersion(defaultVersion || "");
                  }}
                >
                  <Cog size={14} />
                </IconButton>
              </div>
            )}

            <div className={getClassName("grip")}>
              <GripVertical size={16} />
            </div>
          </div>
        </div>

        <Modal isOpen={isEditing} onClose={handleCancel}>
          <div className={getClassName("modal")}>
            <div className={getClassName("modalHeader")}>
              <h2 className={getClassName("modalTitle")}>{props.name}</h2>
              <p className={getClassName("modalSubtitle")}>
                Manage versions and settings
              </p>
            </div>

            <div className={getClassName("modalBody")}>
              <div className={getClassName("section")}>
                <h3 className={getClassName("sectionTitle")}>Versions</h3>
                <div className={getClassName("versionList")}>
                  {versions.map((version) => {
                    const isDefault = version === (selectedVersion || defaultVersion);
                    const isMarkedForDeletion = versionsToDelete.has(version);
                    
                    let rowClass = getClassName("versionRow");
                    if (isDefault) rowClass += " " + getClassName("versionRow--isDefault");
                    if (isMarkedForDeletion) rowClass += " " + getClassName("versionRow--isMarkedForDeletion");

                    return (
                      <div
                        key={version}
                        className={rowClass}
                      >
                        <div className={getClassName("versionInfo")}>
                          <span className={getClassName("versionNumber")}>
                            Version {version}
                          </span>
                          {isDefault && (
                            <span className={getClassName("defaultBadge")}>
                              Default
                            </span>
                          )}
                          {isMarkedForDeletion && (
                            <span className={getClassName("deleteBadge")}>
                              Marked for deletion
                            </span>
                          )}
                        </div>

                        <div className={getClassName("versionActions")}>
                          {!isDefault && !isMarkedForDeletion && (
                            <Button
                              variant="secondary"
                              onClick={() => setSelectedVersion(version)}
                            >
                              Set as Default
                            </Button>
                          )}

                          <Button
                            variant={isMarkedForDeletion ? "secondary" : "secondary"}
                            onClick={() => toggleVersionForDeletion(version)}
                          >
                            {isMarkedForDeletion ? (
                              <>
                                <X size={14} />
                                Undo
                              </>
                            ) : (
                              <>
                                <Trash2 size={14} />
                                Delete
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {versionsToDelete.size > 0 && availableVersions.length > 0 && (
                <div className={getClassName("section")}>
                  <h3 className={getClassName("sectionTitle")}>
                    Migration Settings
                  </h3>
                  <p className={getClassName("sectionDescription")}>
                    Choose what to do with components using deleted versions
                  </p>

                  <div className={getClassName("migrationOptions")}>
                    <select
                      className={getClassName("select")}
                      value={
                        migrateVersionMap[Array.from(versionsToDelete)[0]] ||
                        "decompose"
                      }
                      onChange={(e) => {
                        const newMap = { ...migrateVersionMap };
                        versionsToDelete.forEach((v) => {
                          newMap[v] = e.target.value;
                        });
                        setMigrateVersionMap(newMap);
                      }}
                    >
                      <option value="decompose">
                        Decompose to basic elements
                      </option>
                      {availableVersions.map((v) => (
                        <option key={v} value={v}>
                          Migrate to Version {v}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className={getClassName("modalFooter")}>
              <div className={getClassName("footerLeft")}>
                <Button size="medium" onClick={handleApply}>
                  <Check size={16} />
                  Apply Changes
                </Button>
                <Button size="medium" variant="secondary" onClick={handleCancel}>
                  <X size={16} />
                  Cancel
                </Button>
              </div>

              <div className={getClassName("footerRight")}>
                <Button
                  size="medium"
                  variant="secondary"
                  onClick={handleDemolishClick}
                >
                  <Trash2 size={16} />
                  Demolish Component
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      </>
    );
  }

  return <>{props.children}</>;
};
