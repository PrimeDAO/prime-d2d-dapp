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

  public authenticationIsSynced = true;

  constructor(
    private eventAggregator: EventAggregator,
    private ethereumService: EthereumService,
  ) {
  }

  public initialize(): void {
    this.eventAggregator.subscribe("Network.Changed.Account", (address: Address) => {
      this.syncFirebaseAuthentication(address);
    });
  }

  /**
   * Signs in to Firebase when a wallet is connected.
   * Signs out from the Firebase when wallet is disconnected
   */
  public syncFirebaseAuthentication(address?: Address) : Promise<boolean> {
    this.authenticationIsSynced = false;
    // Checks if address is a valid address (if a wallet was disconnected it will be undefined)
    if (Utils.isAddress(address)) {
      try {
        return this.signInToFirebase(address).then(() => this.authenticationIsSynced = true);
      } catch (error) {
        this.eventAggregator.publish("handleException", new EventConfigException("An error occurred signing into the database", error));
      }
    } else {
      return signOut(firebaseAuth).then(() => this.authenticationIsSynced = true);
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
   * Calls Firebase function which creates a Timestamp that is going to be a part of the signed message
   * Later used to verify if user owns account address
   */
  private async getDateToSign(address: string): Promise<string> {
    const response = await axios.post(`${process.env.FIREBASE_FUNCTIONS_URL}/getDateToSign`, {address});

    return response.data.authenticationRequestDate;
  }

  private async getMessageToSign(address: string): Promise<string> {
    const date = await this.getDateToSign(address);

    return `${FIREBASE_MESSAGE_TO_SIGN} ${date}`;
  }

  private async verifySignedMessageAndCreateCustomToken(address: string, signature: string): Promise<string> {
    const response = await axios.post(`${process.env.FIREBASE_FUNCTIONS_URL}/verifySignedMessageAndCreateCustomToken`, {address, signature});

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
    if (firebaseAuth.currentUser && firebaseAuth.currentUser.uid === address) {
      return;
    }

    // Signs out from Firebase in case another user was authenticated
    // (could happen when user disconnect and connect a new wallet)
    await signOut(firebaseAuth);

    const messageToSign = await this.getMessageToSign(address);

    this.eventAggregator.publish("firebase.signature", true);

    let signature: string;
    try {
      signature = await this.ethereumService.getDefaultSigner().signMessage(messageToSign);
    } catch (error) {
      this.ethereumService.disconnect({ code: 0, message: "User requested" });
      this.eventAggregator.publish("handleFailure", "Signature was rejected. Authentication to Prime Deals failed");
      return;
    } finally {
      this.eventAggregator.publish("firebase.signature", false);
    }

    const token = await this.verifySignedMessageAndCreateCustomToken(address, signature);

    // Firebase Authentication will be persisted in the browser storage (IndexedDB)
    // user will be authenticated to Firebase as long as they don't clear the browser storage
    // (or disconnect their wallet account, or switch to another account which will sign them out)
    await setPersistence(firebaseAuth, browserLocalPersistence);

    // Signs in to Firebase with a given custom token
    return this.signInWithCustomToken(token);
  }
}
