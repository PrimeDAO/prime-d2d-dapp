import { IDealRegistrationTokenSwap, IRepresentative } from "../../src/entities/DealRegistrationTokenSwap";

function getRandomId (){
  /**
   * "0.g6ck5nyod4".substring(2, 9)
   * -> g6ck5ny
   */
  return Math.random().toString(36).substring(2, 9);
}
const randomId = getRandomId();

export const E2E_ADDRESSES = {
  ConnectedPublicUser: "0x0000000000000000000000000000000000000000",
  ProposalLead: "0x0F73E89617FEDee6cCaB07d1d842FF8a5A1f08CC",
  PrimaryDAOToken: "0x43d4a3cd90ddd2f8f4f693170c9c8098163502ad",
  PrimaryTreasury: "0xe904078dBE5Cb9973869B7bDA1C88189986C77fB",
  PartnerTreasury: "0x0727d9de6838fa17Ce638E3Ba3483e8d25E99276",
  PartnerTreasuryTwo: "0x438992F8fF23d808a1BdA06cEbB9f7388b12EB82",
  RepresentativeOne: "0x15f23CF16Ee88B87019C716eDbFD920B54244a8f",
  RepresentativeTwo: "0x77A9B5d500F24255307e46613904f9b346F22f26",
};

export const E2E_ADDRESSES_PRIVATE_KEYS = {
  [E2E_ADDRESSES.ProposalLead]: "610205a884c29474f492da1fe49dafbb32fbe32f04c9241e4e095937d12bd4e6",
  [E2E_ADDRESSES.RepresentativeOne]: "d9d540c544bfbe55a8c4df588ceaf105c64de65cc4564b2e436042e4903fea5c",
  [E2E_ADDRESSES.RepresentativeTwo]: "b2c1c113477f18450a15267e9973b8dd51982660caf93eb3abcf14fa3cafa2a2",
};

const PROPOSAL_DATA = {
  summary: `${randomId}_summary`,
  description: `${randomId}_description`,
  title: `${randomId}_Open_proposal`,
};

const PROPOSAL_LEAD_DATA = {
  address: E2E_ADDRESSES.ProposalLead,
  email: "",
};

const TOKEN_DATA = {
  symbol: "D2D",
  amount: "500000000000",
  address: E2E_ADDRESSES.PrimaryDAOToken,
  vestedFor: 8640000,
  logoURI:
    "https://assets.coingecko.com/coins/images/21609/thumb/RJD82RrV_400x400.jpg?1639559164",
  vestedTransferAmount: "400000000000",
  instantTransferAmount: "100000000000",
  decimals: 18,
  name: "Prime",
  cliffOf: 864000,
};

const TWITTER_SOCIAL_MEDIA_DATA = {
  url: "https://twitter.com/PrimeDAO_",
  name: "Twitter",
};

const PRIMARY_DAO_DATA = {
  treasury_address: E2E_ADDRESSES.PrimaryTreasury,
  logoURI: "https://picsum.photos/seed/picsum/400/400",
  social_medias: [TWITTER_SOCIAL_MEDIA_DATA],
  name: `${randomId}_PrimeDAO`,
  tokens: [TOKEN_DATA],
  representatives: [
    {
      address: E2E_ADDRESSES.ProposalLead,
    },
  ],
};

const PARTNER_DAO_DATA = {
  name: `${randomId}_PartnerDAO`,
  tokens: [
    {
      address: E2E_ADDRESSES.PrimaryDAOToken,
      name: "Prime (D2D)",
      symbol: "D2D",
      decimals: 18,
      logoURI:
        "https://assets.coingecko.com/coins/images/21609/small/RJD82RrV_400x400.jpg?1639559164",
      amount: "200000",
      instantTransferAmount: "150000",
      vestedTransferAmount: "50000",
      vestedFor: 14 * 24 * 3600, // should be in seconds
      cliffOf: 3 * 24 * 3600, // should be in seconds
    },
  ],
  treasury_address: E2E_ADDRESSES.PartnerTreasury,
  representatives: [{ address: E2E_ADDRESSES.RepresentativeOne }],
  social_medias: [
    { name: "Twitter", url: "http://twitter.com/their-dao" },
    { name: "Telegram", url: "http://telegram.com/their-dao" },
  ],
  logoURI:
    "https://deepdao-uploads.s3.us-east-2.amazonaws.com/assets/dao/logo/uniswap.png",
};

const TERMS_DATA = {
  clauses: [
    {
      id: randomId,
      text: `${randomId}_clause`,
    },
  ],
};

export class DealDataBuilder {
  public deal: IDealRegistrationTokenSwap = {
    version: "0.0.2",
    dealType: "token-swap",
    offersPrivate: false,
    isPrivate: false,
    keepAdminRights: true,
    fundingPeriod: 864000,
    proposal: PROPOSAL_DATA,
    proposalLead: PROPOSAL_LEAD_DATA,
    primaryDAO: PRIMARY_DAO_DATA,
    terms: TERMS_DATA,
  };

  public static create() {
    return new DealDataBuilder();
  }

  public withProposalData = this.withFactory("proposal");
  public withProposalLeadData = this.withFactory("proposalLead");
  public withPrimaryDaoData = this.withFactory("primaryDAO");
  public withPartnerDaoData = this.withFactory("partnerDAO", PARTNER_DAO_DATA);
  public withTermsData = this.withFactory("terms");

  public withPrimaryDaoRepresentative(newRepresentatives: Array<IRepresentative>) {
    this.deal.primaryDAO.representatives.push(...newRepresentatives);
    return this;
  }

  private withFactory<DealKey extends keyof IDealRegistrationTokenSwap>(
    key: DealKey,
    defaultData?: IDealRegistrationTokenSwap[DealKey],
  ) {
    return (
      data?: Partial<IDealRegistrationTokenSwap[DealKey]>,
    ) => {
      if (defaultData !== undefined) {
        this.deal[key] = defaultData;
      }

      // @ts-ignore Spread types may only be created from object types.ts(2698) --> works in ts 4.6.2
      this.deal[key] = { ...this.deal[key], ...data };
      return this;
    };
  }
}

export const MINIMUM_OPEN_PROPOSAL = DealDataBuilder.create().deal;

export const PARTNERED_DEAL = DealDataBuilder
  .create()
  .withProposalData({title: `${randomId}_Partnered_deal`})
  .withPartnerDaoData()
  .deal;

export const PRIVATE_PARTNERED_DEAL = DealDataBuilder
  .create()
  .withProposalData({title: `${randomId}_Private_partnered_deal`})
  .withPartnerDaoData()
  .deal;
PRIVATE_PARTNERED_DEAL.isPrivate = true;
