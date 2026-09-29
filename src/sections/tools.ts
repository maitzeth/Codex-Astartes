import type { Section } from "./types";
import { toolsIcon } from "../icons";
import { renderClipboard } from "../tools/clipboard";

export const toolsSection: Section = {
  id: "tools",
  label: "Tools",
  icon: toolsIcon,
  render(_ctx): HTMLElement {
    const root = document.createElement("div");
    root.className = "panel";
    renderClipboard(root);
    return root;
  },
};
