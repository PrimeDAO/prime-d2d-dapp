import shortUuid from "short-uuid";
import { IDealTokenSwapDocument, IDealVotingSummary } from "./../entities/IDealTypes";
import { DefaultTestAddressForSignIn } from "./../../test/data/configuration";
import { firebaseDatabase, signInToFirebase } from "../services/firebase-helpers";
import { collection, doc, writeBatch, getDocs, deleteDoc, addDoc, setDoc } from "firebase/firestore";
import { IDealRegistrationTokenSwap } from "entities/DealRegistrationTokenSwap";

export const DEALS_TOKEN_SWAP_COLLECTION = "deals-token-swap";
export const PRIMARY_DAO_VOTES_COLLECTION = "primary-dao-votes";
export const PARTNER_DAO_VOTES_COLLECTION = "partner-dao-votes";

/**
 * Creates a collection and adds a set of documents
 * @param collectionKey
 * @param arrayOfObjectsToAdd
 * @returns
 */
export const addCollectionAndDocuments = async <T>(
  collectionKey: string,
  arrayOfObjectsToAdd: T[],
) => {
  const collectionRef = collection(firebaseDatabase, collectionKey);
  const batch = writeBatch(firebaseDatabase);
  arrayOfObjectsToAdd.forEach((obj) => {
    const docRef = doc(collectionRef);
    batch.set(docRef, obj);
  });

  return await batch.commit().catch(e => {
    console.log(e);
  });
};

/**
 * Clears an entire collection from the store
 * @param collectionKey
 */
export const clearCollection = async (
  collectionKey: string,
) => {
  const collectionRef = collection(firebaseDatabase, collectionKey);
  const queryResult = await getDocs(collectionRef);
  await Promise.all(queryResult.docs.map(doc => deleteDoc(doc.ref)));
};

/**
 * Removes a document from the firebase store
 * @param collectionKey
 * @param id
 */
export const deleteDocument = (
  collectionKey: string,
  id: string,
) => {
  deleteDoc(doc(firebaseDatabase, collectionKey, id));
};

/**
 * Adds a document to the firebase store
 * @param collectionKey
 * @param data
 * @param dealId
 * @returns
 */
export const addDocument = async (
  collectionKey: string,
  data: Record<string, unknown>,
  dealId?: string,
): Promise<string> => {
  if (dealId) {
    await setDoc(doc(firebaseDatabase, collectionKey, String(dealId)), data);
    return dealId;
  }
  const result = await addDoc(collection(firebaseDatabase, collectionKey), data);
  return result.id;
};
try {
  signInToFirebase(DefaultTestAddressForSignIn);
} catch {
  //swallow
}

type ResetDeal = { dealId: string, quorumReached: boolean } & IDealRegistrationTokenSwap
/**
 * Called from the front end in non prod
 * @param resetDeals
 */
export async function resetDeals(registrationData: ResetDeal[] = []) {
  await clearCollection(DEALS_TOKEN_SWAP_COLLECTION);

  await Promise.all(registrationData.map(async (data) => {
    const primaryDaoRepresentativesAddresses = data.primaryDAO?.representatives?.map(item => item.address) ?? [];
    const partnerDaoRepresentativesAddresses = data.partnerDAO?.representatives?.map(item => item.address) ?? [];
    const date = new Date().toISOString();
    const { dealId, quorumReached, ...registrationData } = data;
    const existingOrGeneratedDealId = dealId ?? shortUuid.generate();

    const votingSummary = quorumReached
      ? await initializeVotingSummaryWithQuorumReached(existingOrGeneratedDealId, primaryDaoRepresentativesAddresses, partnerDaoRepresentativesAddresses)
      : initializeVotingSummary(primaryDaoRepresentativesAddresses, partnerDaoRepresentativesAddresses);

    const dealData: Partial<IDealTokenSwapDocument> = {
      id: existingOrGeneratedDealId as string,
      registrationData: registrationData,
      createdByAddress: "created-by-test-data",
      createdAt: date,
      modifiedAt: date,
      representativesAddresses: [...primaryDaoRepresentativesAddresses, ...partnerDaoRepresentativesAddresses],
      votingSummary,
      isWithdrawn: false,
      isRejected: false,
    };

    addDocument(DEALS_TOKEN_SWAP_COLLECTION, dealData, existingOrGeneratedDealId as string);
  }));
}

/**
  * Initializes the voting summary object with default values
  *
  * Used to create an initial voting summary as well as to reset the existing one
  */
function initializeVotingSummary(
  primaryDaoRepresentativesAddresses: string[],
  partnerDaoRepresentativesAddresses: string[],
): IDealVotingSummary {
  return {
    primaryDAO: {
      totalSubmittable: primaryDaoRepresentativesAddresses.length,
      acceptedVotesCount: 0,
      rejectedVotesCount: 0,
      votes: Object.assign({}, ...primaryDaoRepresentativesAddresses.map(address => ({ [address]: null }))),
    },
    partnerDAO: {
      totalSubmittable: partnerDaoRepresentativesAddresses.length,
      acceptedVotesCount: 0,
      rejectedVotesCount: 0,
      votes: Object.assign({}, ...partnerDaoRepresentativesAddresses.map(address => ({ [address]: null }))),
    },
    totalSubmittable: primaryDaoRepresentativesAddresses.length + partnerDaoRepresentativesAddresses.length,
    totalSubmitted: 0,
  };
}

/**
  * Initializes the voting summary object with every party voting "Accepted"
  */
async function initializeVotingSummaryWithQuorumReached(
  existingOrGeneratedDealId: string,
  primaryDaoRepresentativesAddresses: string[],
  partnerDaoRepresentativesAddresses: string[],
): Promise<IDealVotingSummary> {
  primaryDaoRepresentativesAddresses.forEach(async (address) => {
    const voteRef = await doc(firebaseDatabase, `/${DEALS_TOKEN_SWAP_COLLECTION}/${existingOrGeneratedDealId}/${PRIMARY_DAO_VOTES_COLLECTION}/${address}`);
    setDoc(voteRef, {vote: true});
  });

  partnerDaoRepresentativesAddresses.forEach(async (address) => {
    const voteRef = await doc(firebaseDatabase, `/${DEALS_TOKEN_SWAP_COLLECTION}/${existingOrGeneratedDealId}/${PARTNER_DAO_VOTES_COLLECTION}/${address}`);
    setDoc(voteRef, {vote: true});
  });

  return {
    primaryDAO: {
      totalSubmittable: primaryDaoRepresentativesAddresses.length,
      acceptedVotesCount: primaryDaoRepresentativesAddresses.length,
      rejectedVotesCount: 0,
      votes: Object.assign({}, ...primaryDaoRepresentativesAddresses.map(address => ({ [address]: true }))),
    },
    partnerDAO: {
      totalSubmittable: partnerDaoRepresentativesAddresses.length,
      acceptedVotesCount: partnerDaoRepresentativesAddresses.length,
      rejectedVotesCount: 0,
      votes: Object.assign({}, ...partnerDaoRepresentativesAddresses.map(address => ({ [address]: true }))),
    },
    totalSubmittable: primaryDaoRepresentativesAddresses.length + partnerDaoRepresentativesAddresses.length,
    totalSubmitted: primaryDaoRepresentativesAddresses.length + partnerDaoRepresentativesAddresses.length,
  };
}

export default resetDeals;
if (module.exports) {
  module.exports.resetDeals = resetDeals;
}

// addCollectionAndDocuments("deals-token-swap", [PRIVATE_PARTNERED_DEAL]);
// deleteDocument("deals-token-swap", "3HWCTLjBvjmcc4K78B36em");

// addCollectionAndDocuments("deals-token-swap", [{ ...PRIVATE_PARTNERED_DEAL, id: "3HWCTLjBvjmcc4K78B36em", terms: "asdfasdasdf" }]);
