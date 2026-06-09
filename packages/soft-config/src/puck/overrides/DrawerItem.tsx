"use client";
import { useState } from "react";
import { Button, IconButton, createUsePuck } from "@puckeditor/core";
const useCustomPuck = createUsePuck();
import { useDemolish } from "../actions/useDemolish";
import { useSetDefaultVersion } from "../actions/useSetDefaultVersion";
import { useSoftConfig } from "../context/useStore";
import { GripVertical, Check, X, Trash2, Cog } from "lucide-react";
import { confirm } from "../lib/confirm";
import getClassNameFactory from "../lib/get-class-name-factory";
import styles from "./DrawerItem.module.css";
import { Modal } from "../components/modal";
import { shallow } from "zustand/shallow";
import { useActionEvent } from "../hooks/useActionEvent";

const getClassName = getClassNameFactory("DrawerItem", styles);

export const DrawerItem = (props: {
  name: string;
  label?: string;
  children: React.ReactNode;
}): React.ReactElement => {
  const componentMeta = useSoftConfig((s) => s.softComponents[props.name]);
  const displayName = props.label || componentMeta?.name || props.name;

  const softComponents = new Set(
    Object.keys(useSoftConfig((s) => s.softComponents, shallow)),
  );
  const getPermissions = useCustomPuck((s) => s.getPermissions);

  const insertAllowed = getPermissions({ type: props.name }).insert;

  const removeSoftComponentVersion = useSoftConfig(
    (s) => s.removeSoftComponentVersion,
  );

  const { handleDemolish } = useDemolish();
  const { handleSetDefaultVersion, getVersions, getDefaultVersion } =
    useSetDefaultVersion();
  const { triggerAction } = useActionEvent();

  const [isEditing, setIsEditing] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [versionsToDelete, setVersionsToDelete] = useState<Set<string>>(
    new Set(),
  );
  const [migrationTarget, setMigrationTarget] = useState<string>("decompose");
  const useVersioning = useSoftConfig((s) => s.showVersionFields);

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
            `Deleting all versions will remove "${props.name}" entirely. Continue?`,
          );
          if (shouldDemolish) {
            handleDemolish(props.name);
          }
          break;
        } else {
          removeSoftComponentVersion(props.name, version);
          void triggerAction({
            type: "deleteVersion",
            payload: {
              id: props.name,
              version,
              migrateToVersion: migrationTarget,
            },
          });
        }
      }
    }

    setIsEditing(false);
    setSelectedVersion("");
    setVersionsToDelete(new Set());
    setMigrationTarget("decompose");
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedVersion("");
    setVersionsToDelete(new Set());
    setMigrationTarget("decompose");
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
      `Demolish "${displayName}" entirely? This will remove all versions.`,
    );
    if (confirmed) {
      handleDemolish(props.name);
      setIsEditing(false);
    }
  };

  if (softComponents.has(props.name)) {
    const availableVersions = versions.filter((v) => !versionsToDelete.has(v));
    const migrationTargets = [
      { value: "decompose", label: "Decompose to basic elements" },
      ...availableVersions.map((version) => ({
        value: version,
        label: `Migrate to Version ${version}`,
      })),
    ];

    return (
      <>
        <div
          className={getClassName({ insertDisabled: !insertAllowed })}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          {props.label}
          <div className={getClassName("content")}>
            <div className={getClassName("name")}>{displayName}</div>
            {/* Only show version badge if versioning is enabled */}
            {useVersioning && (
              <div className={getClassName("version")}>v{defaultVersion}</div>
            )}
          </div>

          <div className={getClassName("actions")}>
            {isHovering && (
              <div className={getClassName("settingsButton")}>
                <IconButton
                  title="Settings"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                    setSelectedVersion(defaultVersion || "");
                  }}
                >
                  <Cog size={12} />
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
              <h2 className={getClassName("modalTitle")}>{displayName}</h2>
              <p className={getClassName("modalSubtitle")}>
                Component Settings
              </p>
            </div>

            <div className={getClassName("modalBody")}>
              {/* VERSIONING FIELDS: CONDITIONAL RENDERING */}
              {useVersioning ? (
                <>
                  <div className={getClassName("section")}>
                    <h3 className={getClassName("sectionTitle")}>Versions</h3>
                    <div className={getClassName("versionList")}>
                      {versions.map((version) => {
                        const isDefault =
                          version === (selectedVersion || defaultVersion);
                        const isMarkedForDeletion =
                          versionsToDelete.has(version);

                        let rowClass = getClassName("versionRow");
                        if (isDefault)
                          rowClass +=
                            " " + getClassName("versionRow--isDefault");
                        if (isMarkedForDeletion)
                          rowClass +=
                            " " +
                            getClassName("versionRow--isMarkedForDeletion");

                        return (
                          <div key={version} className={rowClass}>
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
                                variant="secondary"
                                onClick={() =>
                                  toggleVersionForDeletion(version)
                                }
                              >
                                {isMarkedForDeletion ? (
                                  <>
                                    <X size={14} /> Undo
                                  </>
                                ) : (
                                  <>
                                    <Trash2 size={14} /> Delete
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {versionsToDelete.size > 0 && (
                    <div className={getClassName("section")}>
                      <h3 className={getClassName("sectionTitle")}>
                        Migration Settings
                      </h3>
                      <div className={getClassName("migrationOptions")}>
                        <div
                          className={getClassName("migrationList")}
                          role="radiogroup"
                          aria-label="Migration target"
                        >
                          {migrationTargets.map((target) => {
                            const isSelected = migrationTarget === target.value;

                            return (
                              <button
                                aria-label={target.label}
                                key={target.value}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                className={`${getClassName("migrationOption")} ${
                                  isSelected
                                    ? getClassName(
                                        "migrationOption--isSelected",
                                      )
                                    : ""
                                }`}
                                onClick={() => setMigrationTarget(target.value)}
                              >
                                <span
                                  className={getClassName(
                                    "migrationOptionLabel",
                                  )}
                                >
                                  {target.label}
                                </span>
                                {isSelected && <Check size={14} />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <p className={getClassName("helpText")}>
                        Choose where to move existing instances of the deleted
                        versions.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className={getClassName("section")}>
                  <p>
                    Manage high-level settings for the{" "}
                    <strong>{displayName}</strong> component.
                  </p>
                </div>
              )}
            </div>

            <div className={getClassName("modalFooter")}>
              <div className={getClassName("footerLeft")}>
                {/* Only show Apply if versioning is active, otherwise just Close/Cancel */}
                {useVersioning ? (
                  <Button size="medium" onClick={handleApply}>
                    <Check size={16} /> Apply Changes
                  </Button>
                ) : (
                  <Button size="medium" onClick={handleCancel}>
                    Close
                  </Button>
                )}
                {useVersioning && (
                  <Button
                    size="medium"
                    variant="secondary"
                    onClick={handleCancel}
                  >
                    <X size={16} /> Cancel
                  </Button>
                )}
              </div>

              <div className={getClassName("footerRight")}>
                <Button
                  size="medium"
                  variant="secondary"
                  onClick={handleDemolishClick}
                >
                  <Trash2 size={16} /> Demolish Component
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
