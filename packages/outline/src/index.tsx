import { Layers } from "lucide-react";
import { Outline } from "./Outline";
import { Plugin } from "@measured/puck";
import styles from "./styles.module.css";

// export const outlinePlugin: () => Plugin = () => ({
//   name: "outline",
//   label: "Outline",
//   render: () => (
//     <div className={styles.OutlinePlugin}>
//       <Outline />
//     </div>
//   ),
//   icon: <Layers />,
// });

export const outlinePlugin: () => Plugin = () => ({
  overrides: {
    outline: () => (
      <div className={styles.OutlinePlugin}>
        <Outline />
      </div>
    ),
  },
});

export { Outline };
