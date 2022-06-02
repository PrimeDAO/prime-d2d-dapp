import SafeAppsSDK from "@gnosis.pm/safe-apps-sdk";
import { EthereumService } from "services/EthereumService";
import { ethers } from "ethers";
import { fromEventPattern, Observable } from "rxjs";
import { autoinject } from "aurelia-framework";
import axios from "axios";
import { signInWithCustomToken, setPersistence, signOut, onAuthStateChanged, User, Unsubscribe, UserCredential, browserLocalPersistence } from "firebase/auth";
import { Utils } from "services/utils";
import { EventAggregator } from "aurelia-event-aggregator";
import { EventConfigException } from "services/GeneralEvents";
import { FIREBASE_MESSAGE_TO_SIGN } from "./FirestoreTypes";
import { DateService } from "./DateService";
import { BrowserStorageService } from "services/BrowserStorageService";
import { firebaseAuth } from "./firebase-helpers";
import { ConsoleLogService } from "./ConsoleLogService";

const safeAppOpts = {
  allowedDomains: [/gnosis-safe.io/],
};
const RETRY_SAFE_APP_INTERVAL = 4000;
const RETRY_SAFE_APP_TIMEOUT = 999999;

/**
 * TODO: Should define a new place for this type, and all other `Address` imports should take it from there
 * Cause for change: Want to import app code into Cypress code (, because we want to use the acutal code we are testing).
 * Reason: The other dependencies in `EthereumService` got pulled into Cypress webpack build as well.
 *   And the current Cypress webpack does not support, eg. scss files bundling and processing
 */
 type Address = string;

const FIREBASE_AUTHENTICATION_SIGNATURES_STORAGE = "FIREBASE_AUTHENTICATION_SIGNATURES";

interface ISignatureStorage {
  signature: string;
  messageToSign: string;
}

/**
 * Part of the answer in
 * https://stackoverflow.com/questions/71866879/how-to-verify-message-in-wallet-connect-with-ethers-primarily-on-ambire-wallet
 */
function encryptForGnosis(rawMessage: string) {
  const rawMessageLength = new Blob([rawMessage]).size;
  const message = ethers.utils.toUtf8Bytes(
    "\x19Ethereum Signed Message:\n" + rawMessageLength + rawMessage,
  );
  const messageHash = ethers.utils.keccak256(message);
  return messageHash;
}

@autoinject
export class FirebaseService {

  public currentFirebaseUserAddress: string;

  constructor(
    private eventAggregator: EventAggregator,
    private ethereumService: EthereumService,
    private dateService: DateService,
    private browserStorageService: BrowserStorageService,
    private consoleLogService: ConsoleLogService,
  ) {
  }

  public initialize() {
    this.currentFirebaseUserAddress = firebaseAuth?.currentUser?.uid;
    firebaseAuth.onAuthStateChanged(user => {
      if (user) {
        this.currentFirebaseUserAddress = user.uid;
      } else {
        this.currentFirebaseUserAddress = null;
      }
    });
  }

  /**
   * Signs in to Firebase when a wallet is connected.
   * Signs out from the Firebase when wallet is disconnected
   */
  public syncFirebaseAuthentication(address?: Address) : Promise<boolean> {
    // Checks if address is a valid address (if a wallet was disconnected it will be undefined)
    if (Utils.isAddress(address)) {
      try {
        return this.signInToFirebase(address)
          .then(() => true)
          .catch(() => {
            this.eventAggregator.publish("handleFailure", "Authentication failed");
            return false;
          });
      } catch (error) {
        this.eventAggregator.publish("handleException", new EventConfigException("An error occurred signing into the database", error));
      }
    } else {
      return signOut(firebaseAuth).then(() => true);
    }
  }

  /**
   * Firebase authentication state Observable
   * Turns Firebase onAuthStateChanged method into an Observable
   */
  public authStateChanged(): Observable<User> {
    return fromEventPattern(
      (handler) => onAuthStateChanged(firebaseAuth, (user) => {
        handler(user);
      }),
      (handler, unsubscribe: Unsubscribe) => {
        unsubscribe();
      },
    );
  }

  /**
   * Checks if a signature for the provided accountAddress already exists in localStorage
   */
  public hasSignatureForAddress(address: string): boolean {
    return !!this.getExistingSignatureAndMessageForAddress(address).signature;
  }

  private async getMessageToSign(): Promise<string> {
    const date = this.dateService.translateUtcToLocal(new Date());

    return `${FIREBASE_MESSAGE_TO_SIGN} ${date}`;
  }

  private async verifySignedMessageAndCreateCustomToken(address: string, message: string, signature: string): Promise<string> {
    const response = await axios.post(`${process.env.FIREBASE_FUNCTIONS_URL}/CI-verifySignedMessageAndCreateCustomToken`, {address, message, signature, network: EthereumService.targetedNetwork});

    return response.data.token;
  }

  /**
   * Sign in to Firebase with custom token (generated by a Firebase function)
   */
  private async signInWithCustomToken(token: string): Promise<UserCredential> {
    // TODO handle failure
    return signInWithCustomToken(firebaseAuth, token);
  }

  /**
   * Requests custom token for the address from Firebase function and signs in to Firebase
   */
  private async signInToFirebase(address: string): Promise<UserCredential> {
    /* prettier-ignore */ console.log(">>>> _ >>>> ~ file: FirebaseService.ts ~ line 145 ~ this.currentFirebaseUserAddress", this.currentFirebaseUserAddress);
    if (this.currentFirebaseUserAddress === address) {
      return;
    }

    await signOut(firebaseAuth);

    // Signs out from Firebase in case another user was authenticated
    // (could happen when user disconnect and connect a new wallet)

    let {signature, messageToSign} = this.getExistingSignatureAndMessageForAddress(address);
    /* prettier-ignore */ console.log(">>>> _ >>>> ~ file: FirebaseService.ts ~ line 153 ~ signature", signature);
    /* prettier-ignore */ console.log(">>>> _ >>>> ~ file: FirebaseService.ts ~ line 153 ~ messageToSign", messageToSign);

    if (!signature) {
      const oldMessageToSign = messageToSign;
      messageToSign = await this.getMessageToSign();

      if (await this.ethereumService.isSafeApp()) {
        let messageToCheck = oldMessageToSign;
        if (!oldMessageToSign) {
          messageToCheck = messageToSign;
        }
        /* prettier-ignore */ console.log(">>>> _ >>>> ~ file: FirebaseService.ts ~ line 164 ~ messageToCheck", messageToCheck);

        const appsSdk = new SafeAppsSDK(safeAppOpts);
        try {
          const isSigned = await appsSdk.safe.isMessageSigned(messageToCheck);

          /**
           * Gnosis Safe App signature verification has different flow:
           *   Because Gnosis Safe is a contract, we will have to query until the tx has finished executing.
           *   Only then can we proceed with authenticating to Firebase.
           */
          if (!isSigned) {
            this.eventAggregator.publish("gnosis.safe.transaction.await");
            const { safeTxHash } = await appsSdk.txs.signMessage(messageToCheck);
            this.eventAggregator.publish("transaction.sent");

            await Utils.waitUntilTrue(async() => {
              return await appsSdk.safe.isMessageSigned(messageToCheck);
            }, RETRY_SAFE_APP_TIMEOUT, RETRY_SAFE_APP_INTERVAL);

            const tx = await appsSdk.txs.getBySafeTxHash(safeTxHash);

            signature = encryptForGnosis(messageToCheck);

            this.storeSignatureForAddress(address, signature, messageToCheck);
            this.eventAggregator.publish("transaction.confirmed");
          }
        } catch (error) {
          this.eventAggregator.publish("database.account.signature.cancelled");
          throw error;
        }
      } else {
        try {
          signature = await this.requestSignature(messageToSign);
          this.storeSignatureForAddress(address, signature, messageToSign);
          this.eventAggregator.publish("database.account.signature.successful");

        } catch (error) {
          this.eventAggregator.publish("database.account.signature.cancelled");
          throw error;
        }
      }
    }

    let token: string;
    try {
      token = await this.verifySignedMessageAndCreateCustomToken(address, messageToSign, signature);
    } catch (error) {
      this.eventAggregator.publish("handleFailure", "Signature wasn't verified successfully");
      throw new Error(error);
    }

    // Firebase Authentication will be persisted in the browser storage (IndexedDB)
    // user will be authenticated to Firebase as long as they don't clear the browser storage
    // (or disconnect their wallet account, or switch to another account which will sign them out)
    await setPersistence(firebaseAuth, browserLocalPersistence);

    // Signs in to Firebase with a given custom token
    return this.signInWithCustomToken(token);
  }

  private async requestSignature(messageToSign: string): Promise<string> {
    // Wait up to 30 seconds
    return await Promise.race([
      this.ethereumService.getDefaultSigner().signMessage(messageToSign),
      Utils.timeout(30000),
    ]);
  }

  private getExistingSignatureAndMessageForAddress(address: string): ISignatureStorage {
    const signaturesAndMessages = this.browserStorageService.lsGet<Record<string, ISignatureStorage>>(FIREBASE_AUTHENTICATION_SIGNATURES_STORAGE, {});

    return signaturesAndMessages[address] ? signaturesAndMessages[address] : {signature: null, messageToSign: null};
  }

  private storeSignatureForAddress(address: string, signature: string, messageToSign: string): void {
    const signaturesAndMessages = this.browserStorageService.lsGet<Record<string, ISignatureStorage>>(FIREBASE_AUTHENTICATION_SIGNATURES_STORAGE, {});

    signaturesAndMessages[address] = {signature, messageToSign};

    this.browserStorageService.lsSet(FIREBASE_AUTHENTICATION_SIGNATURES_STORAGE, signaturesAndMessages);
  }
}
