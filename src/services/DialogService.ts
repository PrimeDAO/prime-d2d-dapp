import { ConsoleLogService } from "./ConsoleLogService";
import { DialogCloseResult, DialogDeactivationStatuses, IDialogService, inject } from "aurelia";
import { Constructable } from "@aurelia/kernel";

@inject()
export class DialogService {

  constructor(
    @IDialogService private dialogService: IDialogService,
    private consoleLogService: ConsoleLogService,
  ) {
  }

  public open(
    viewModule: () => Constructable<object>, // result of `import {view} from "path to module files"`
    model: unknown, // object that is given to the module's `activate` function
    settings: object = {},
  ): Promise<DialogCloseResult> {

    /**
     * hack we gotta go through to set styling on ux-dialog-container specific
     * to the desired dialog type.
     */
    let theContainer: Element;
    return this.dialogService.open({
      model,
      component: viewModule,
      ...settings,
    })
      .whenClosed(
        (result: DialogCloseResult) => {
          return result;
        },
        // not sure if this always gets called
        (error: string) => {
          this.consoleLogService.logMessage(error, "error");
          // return {output: error, wasCancelled: false};
          return {value: error, status: DialogDeactivationStatuses.Error}; // TODO update other components to use status instead of `wasCancelled`
        },
      );
  }
}

export { DialogCloseResult };
