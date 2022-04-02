import { autoinject } from "aurelia-framework";
import { EthereumService } from "services/EthereumService";
import { DealTokenSwap } from "entities/DealTokenSwap";
import { DealService } from "../services/DealService";
import "./dealDashboard.scss";

@autoinject
export class DealDashboard {
  private deal: DealTokenSwap;
  private discussionId: string = null;
  private dealId: string;

  constructor(
    private ethereumService: EthereumService,
    private dealService: DealService,
  ) {
  }

  async activate(_, __, navigationInstruction) {
    this.dealId = navigationInstruction.params.address;
    await this.dealService.ensureInitialized();
    this.deal = this.dealService.deals.get(this.dealId);
    await this.deal.ensureInitialized();
  }
}
