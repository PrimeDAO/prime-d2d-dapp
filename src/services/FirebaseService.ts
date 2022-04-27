import { EthereumService } from "services/EthereumService";
import { fromEventPattern, Observable } from "rxjs";
import { autoinject } from "aurelia-framework";
import axios from "axios";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken, connectAuthEmulator, setPersistence, signOut, onAuthStateChanged, User, Unsubscribe, UserCredential, browserLocalPersistence } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, initializeFirestore } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { Utils } from "services/utils";
import { EventAggregator } from "aurelia-event-aggregator";
import { EventConfigException } from "services/GeneralEvents";
import { FIREBASE_MESSAGE_TO_SIGN } from "./FirestoreTypes";
import { DateService } from "./DateService";

/**
 * TODO: Should define a new place for this type, and all other `Address` imports should take it from there
 * Cause for change: Want to import app code into Cypress code (, because we want to use the acutal code we are testing).
 * Reason: The other dependencies in `EthereumService` got pulled into Cypress webpack build as well.
 *   And the current Cypress webpack does not support, eg. scss files bundling and processing
 */
type Address = string;

// Initialize Firebase
export const firebaseApp = initializeApp({
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  appId: process.env.FIREBASE_APP_ID,
});

/**
 * Fix Cypress specific timeout issue
 *  "Could not reach Cloud Firestore backend. Backend didn't respond within 10 seconds.""
 */
if (process.env.FIREBASE_ENVIRONMENT === "local") {
  initializeFirestore(firebaseApp, { experimentalForceLongPolling: true });
}

export const firebaseDatabase = getFirestore();
export const firebaseAuth = getAuth();
export const firebaseFunctions = getFunctions(firebaseApp);

// Connects to emulators on local environment
if (process.env.FIREBASE_ENVIRONMENT === "local") {
  connectFirestoreEmulator(firebaseDatabase, "localhost", 8080);
  connectAuthEmulator(firebaseAuth, "http://localhost:9099");
  connectFunctionsEmulator(firebaseFunctions, "localhost", 5001);
}

@autoinject
export class FirebaseService {

  public currentFirebaseUserAddress: string;

  constructor(
    private eventAggregator: EventAggregator,
    private ethereumService: EthereumService,
    private dateService: DateService,
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

  private async getMessageToSign(): Promise<string> {
    const date = this.dateService.translateUtcToLocal(new Date());

    return `${FIREBASE_MESSAGE_TO_SIGN} ${date}`;
  }

  private async verifySignedMessageAndCreateCustomToken(address: string, message: string, signature: string): Promise<string> {
    const response = await axios.post(`${process.env.FIREBASE_FUNCTIONS_URL}/verifySignedMessageAndCreateCustomToken`, {address, message, signature});

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
    if (this.currentFirebaseUserAddress === address) {
      return;
    }

    // Signs out from Firebase in case another user was authenticated
    // (could happen when user disconnect and connect a new wallet)
    await signOut(firebaseAuth);

    const messageToSign = await this.getMessageToSign();

    let signature: string;
    try {
      signature = await this.requestSignature(messageToSign);
      this.eventAggregator.publish("handleInfo", "Message was successfully signed");
    } catch {
      this.eventAggregator.publish("database.account.signature.cancelled");
      throw new Error();
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
}
