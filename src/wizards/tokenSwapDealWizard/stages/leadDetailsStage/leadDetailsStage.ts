import { IWizardState, WizardService } from "../../../services/WizardService";
import { IStageMeta, WizardType } from "../../dealWizardTypes";
import { EthereumService } from "../../../../services/EthereumService";
import { IDealRegistrationTokenSwap, IProposalLead } from "../../../../entities/DealRegistrationTokenSwap";
import { IContainer, IDisposable, IEventAggregator } from "aurelia";
import { processContent } from "@aurelia/runtime-html";
import { autoSlot } from "../../../../resources/temporary-code";
import { IValidationRules } from "@aurelia/validation";
import { IsEmail, IsEthAddress } from "../../../../resources/validation-rules";

@processContent(autoSlot)
export class LeadDetailsStage {
  wizardManager: any;
  wizardState: IWizardState<IDealRegistrationTokenSwap>;
  isOpenProposalWizard = false;
  isMakeAnOfferWizard = false;
  ethAddress?: string;
  proposalLead: IProposalLead;
  private accountSubscription: IDisposable;

  constructor(
    public wizardService: WizardService,
    @IContainer private container: IContainer,
    private ethereumService: EthereumService,
    @IEventAggregator private eventAggregator: IEventAggregator,
    @IValidationRules private validationRules: IValidationRules,
  ) {
  }

  // @computedFrom("wizardState.registrationData.keepAdminRights", "isMakeAnOfferWizard")// TODO check if this works
  get isMakeAnOfferWizardAndKeepsAdminRights() {
    return this.wizardState.registrationData.keepAdminRights && this.isMakeAnOfferWizard;
  }

  attached(): void {
    this.ethAddress = this.ethereumService.defaultAccountAddress;
    this.accountSubscription = this.eventAggregator.subscribe("Network.Changed.Account", (address: string) => {
      this.ethAddress = address;
    });
  }

  connectToWallet() {
    this.ethereumService.ensureConnected();
  }

  detached() {
    this.accountSubscription.dispose();
  }

  load(stageMeta: IStageMeta): void {
    this.wizardManager = this.container.get("wiz");
    this.isOpenProposalWizard = [WizardType.createOpenProposal, WizardType.editOpenProposal].includes(stageMeta.wizardType);
    this.isMakeAnOfferWizard = stageMeta.wizardType === WizardType.makeAnOffer;

    this.wizardState = this.wizardService.getWizardState(this.wizardManager);
    this.proposalLead = this.wizardState.registrationData.proposalLead;

    this.validationRules
      .on(this.proposalLead)
      .ensure("address")
      .required()
      .withMessage("Wallet address is required")
      .satisfiesRule(new IsEthAddress())
      .withMessage("Please enter a valid ethereum address")
      .ensure("email")
      .required()
      .satisfiesRule(new IsEmail())
      .withMessage("Please enter a valid email address");

  }
}
