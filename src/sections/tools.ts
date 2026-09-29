import type { Section, SectionController } from "./types";
import { toolsIcon } from "../icons";
import { renderClipboard } from "../tools/clipboard";

export const toolsSection: Section = {
  id: "tools",
  label: "Tools",
  icon: toolsIcon,
  render(_ctx): HTMLElement {
    const root = document.createElement("div");
    root.className = "panel";
    const controller = renderClipboard(root);
    if (controller && typeof (controller as SectionController).destroy === "function") {
      (root as HTMLElement & { _controller?: SectionController })._controller =
        controller as SectionController;
    }
    return root;
  },
};
