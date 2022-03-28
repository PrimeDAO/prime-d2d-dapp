﻿import { autoinject, bindingMode, computedFrom, customElement } from "aurelia-framework";
import { bindable } from "aurelia-typed-observable-plugin";
import "./EtherscanLink.scss";
import { IEthereumService } from "services/IEthereumService";

@autoinject
@customElement("etherscanlink")
export class EtherscanLink {
  @bindable({ defaultBindingMode: bindingMode.oneTime }) public address: string;
  @bindable({ defaultBindingMode: bindingMode.oneTime }) public text?: string;
  @bindable({ defaultBindingMode: bindingMode.oneTime }) public type: string;
  /**
   * set add classes on the text
   */
  @bindable({ defaultBindingMode: bindingMode.oneTime }) public css: string;
  @bindable.booleanAttr({ defaultBindingMode: bindingMode.oneTime }) public hideClipboardButton: boolean;
  /**
   * bootstrap config for a tooltip
   */
  // @bindable({ defaultBindingMode: bindingMode.oneTime }) public tooltip?: any;

  private copyMessage: string;
  private internal = false;

  @computedFrom("address")
  private get networkExplorerUri(): string {
    return this.ethereumService.getEtherscanLink(this.address, this.type === "tx");
  }

  constructor(
    private ethereumService: IEthereumService,
  ) { }

  public attached(): void {
    if (this.type === "tx") {
      this.copyMessage = "Hash has been copied to the clipboard";
    } else {
      this.copyMessage = "Address has been copied to the clipboard";
    }
  }
}
