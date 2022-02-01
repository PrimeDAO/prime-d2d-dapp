import { IWizardState } from "services/WizardService";

export enum WizardType {openProposal, partneredDeal, makeAnOffer}

export interface IBaseWizardStage {
  wizardManager: any;
  wizardState: IWizardState;

  activate;
  attached: () => void;
}

export interface IStageMeta {
  wizardManager: any;
  wizardType: WizardType;
}

export const STAGE_ROUTE_PARAMETER = "stageRoute";
