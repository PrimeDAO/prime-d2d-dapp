import { bindable, children, customElement } from "aurelia";

@customElement("pinput-group")
export class PInputGroup {
  element: Element;
  @bindable disabled = false;
  @children({ query: x => x.host.querySelectorAll("[au-slot='before']") }) beforeSlots;
  @children({ query: x => x.host.querySelectorAll("[au-slot='after']")}) afterSlots;

  constructor(element: Element) {
    this.element = element;
  }
}
