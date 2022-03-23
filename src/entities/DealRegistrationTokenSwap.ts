// Importing external dependencies in this file breaks firebase function which import interfaces from here

export interface IProposal {
  title: string,
  summary: string,
  description: string;
}

export enum Platforms {
  "Independent",
  "DAOstack",
  "Moloch",
  "OpenLaw",
  "Aragon",
  "Colony",
  "Compound Governance",
  "Snapshot",
  "Gnosis Safe / Snapshot",
  "Substrate",
}

export interface IToken {
  address: string,

  name: string,
  symbol: string,
  decimals: number,
  logoURI: string,

  amount: string
  instantTransferAmount: string
  vestedTransferAmount: string
  vestedFor: number
  cliffOf: number
}

export interface ISocialMedia {
  name: string,
  url: string,
}

export interface IRepresentative {
  address: string;
}
export interface IDAO {
  name: string;
  treasury_address: string;
  logoURI: string;
  social_medias: Array<ISocialMedia>;
  representatives: Array<IRepresentative>;
  id?: string;
  tokens?: Array<IToken>;
  platform?: Platforms;
}

export interface IProposalLead {
  address: string,
  email?: string;
  // dao?: IDAO /* Deprecated: Proposal lead does not need to be part of the a DAO */
}

export interface IClause {
  id: string,
  text: string,
}

export interface ITerms {
  clauses: Array<IClause>,
}

// We cannot import Timestamp from firebase, therefore we create our own
// because importing external dependencies in this file breaks firebase functions which import interfaces from here
export interface IFirestoreTimestamp {
  toDate(): Date;
}

export interface IDealRegistrationTokenSwap {
  version: string;
  proposal: IProposal;
  primaryDAO: IDAO;
  partnerDAO: IDAO;
  proposalLead: IProposalLead; // this contains to address
  terms: ITerms;
  keepAdminRights: boolean;
  offersPrivate: boolean;
  isPrivate: boolean;
  createdAt: IFirestoreTimestamp | Date | null; // @TODO remove "Date" as it's needed temporary for the mocked data
  modifiedAt: IFirestoreTimestamp | null;
  createdByAddress: string | null;
  executionPeriodInDays: number;
  dealType: "token-swap"/* | "co-liquidity"*/;
}

export function emptyDaoDetails(): IDAO {
  return {
    name: "",
    tokens: [],
    treasury_address: "",
    representatives: [{address: ""}],
    social_medias: [],
    logoURI: null,
  };
}

export class DealRegistrationTokenSwap implements IDealRegistrationTokenSwap {
  public version: string;
  public proposal: IProposal;
  public primaryDAO: IDAO;
  public partnerDAO: IDAO;
  public proposalLead: IProposalLead; // this maps to address
  public terms: ITerms;
  public keepAdminRights: boolean;
  public offersPrivate: boolean;
  public isPrivate: boolean;
  public createdAt: IFirestoreTimestamp | null;
  public modifiedAt: IFirestoreTimestamp | null;
  public createdByAddress: string | null;
  public executionPeriodInDays: number;
  public dealType: "token-swap"/* | "co-liquidity" */;

  constructor(isPartneredDeal = false) {
    this.clearState(isPartneredDeal);
  }

  clearState(isPartneredDeal: boolean): void {
    this.version = "0.0.1";
    this.proposal = {
      title: "",
      summary: "",
      description: "",
    };
    this.primaryDAO = emptyDaoDetails();
    this.partnerDAO = isPartneredDeal ? emptyDaoDetails() : undefined;
    this.proposalLead = {
      address: "",
      email: "",
    };
    this.terms = {
      clauses: [{
        id: "",
        text: "",
      }],
    };
    this.keepAdminRights = true;
    this.offersPrivate = false;
    this.isPrivate = false;
    this.createdAt = null;
    this.modifiedAt = null;
    this.createdByAddress = null;
  }
}
