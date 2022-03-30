import { IDealTokenSwapDocument } from "../../../src/entities/IDealTypes";
import { IDealRegistrationTokenSwap } from "../../../src/entities/DealRegistrationTokenSwap";
import { FirestoreService } from "../../../src/services/FirestoreService";
import { E2eNavbar, E2eWallet } from "../tests/wallet.e2e";
import { E2eNavigation } from "./navigate";
import { IFirebaseDocument } from "../../../src/services/FirestoreTypes";

interface IDealOptions {
  address?: string;
  isLead?: boolean;
}

const defaultDealOptions: IDealOptions = {
  isLead: false,
};

export class E2eDealsApi {
  private static getDealService(): FirestoreService<
  IDealTokenSwapDocument,
  IDealRegistrationTokenSwap
  > {
    // @ts-ignore - Hack to access firestore inside Cypress
    return Cypress.firestoreService;
  }

  public static getDeals(
    options: IDealOptions = defaultDealOptions,
  ): Cypress.Chainable<IDealTokenSwapDocument[]> {
    const { isLead } = options;
    let { address } = options;
    if (address === undefined) {
      address = E2eWallet.currentWalletAddress;
    }

    cy.log("[Test] Navigate to home page, and wait for app boostrapping");
    /**
     * Need to have the app bootstrapped, in order to use firestore
     */
    cy.window().then((window) => {
      const { pathname } = window.location;
      if (!E2eNavigation.isHome(pathname)) {
        E2eNavigation.navigateToHomePage();
        console.log("TCL ~ file: deal-api.ts ~ line 44 ~ E2eDealsApi ~ cy.window ~ address", address);
        E2eNavbar.connectToWallet(address);
      }
    });

    return cy.then(async () => {
      const firestoreDealsService = E2eDealsApi.getDealService();
      await firestoreDealsService.ensureAuthenticationIsSynced();

      let deals: IFirebaseDocument<IDealTokenSwapDocument>[];

      if (isLead) {
        deals = await firestoreDealsService.getProposalLeadDeals(address);
      } else {
        deals = await firestoreDealsService.getAllDealsForTheUser(address);
      }

      console.log(
        "TCL ~ file: deal-api.ts ~ line 30 ~ E2eDealsApi ~ returncy.then ~ address",
        address,
      );
      console.log(
        "TCL ~ file: deal-api.ts ~ line 30 ~ E2eDealsApi ~ returncy.then ~ deals",
        deals,
      );
      return deals.map((deal) => deal.data);
    });
  }

  public static getOpenProposals(options?: IDealOptions) {
    return cy.then(() => {
      return this.getDeals(options).then((deals) => {
        return deals.filter((deal) => {
          return !deal.registrationData.partnerDAO;
        });
      });
    });
  }

  public static getPartneredDeals(options?: IDealOptions) {
    return cy.then(() => {
      return this.getDeals(options).then((deals) => {
        return deals.filter((deal) => {
          return deal.registrationData.partnerDAO;
        });
      });
    });
  }

  public static getFirstOpenProposalId(options?: IDealOptions) {
    return cy.then(() => {
      return this.getOpenProposals(options).then((openProposals) => {
        const id = openProposals[0].id;
        if (id === undefined) {
          throw new Error("[TEST] No Open Proposal found");
        }

        return id;
      });
    });
  }

  public static getFirstPartneredDealId(options?: IDealOptions) {
    return cy.then(() => {
      return this.getPartneredDeals(options).then((partneredDeals) => {
        const id = partneredDeals[0].id;
        if (id === undefined) {
          throw new Error("[TEST] No Open Proposal found");
        }

        return id;
      });
    });
  }
}
