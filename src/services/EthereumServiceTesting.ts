/* eslint-disable @typescript-eslint/no-empty-function */
const ADDRESS = "0xE834627cDE2dC8F55Fe4a26741D3e91527A8a498";

import detectEthereumProvider from "@metamask/detect-provider";
import { BrowserStorageService } from "./BrowserStorageService";
/* eslint-disable no-console */
import { ConsoleLogService } from "services/ConsoleLogService";
import { ethers, Signer } from "ethers";
import { BaseProvider, ExternalProvider, Web3Provider, Network } from "@ethersproject/providers";
import Web3Modal from "web3modal";
import WalletConnectProvider from "@walletconnect/web3-provider";
import Torus from "@toruslabs/torus-embed";
import { EventAggregator } from "aurelia-event-aggregator";
import { autoinject } from "aurelia-framework";
import { getAddress } from "ethers/lib/utils";
import { DisclaimerService } from "services/DisclaimerService";
import { Address, AllowedNetworks, EthereumService, Hash, IBlockInfo, IChainEventInfo, Networks } from "./EthereumService";

interface IEIP1193 {
  on(eventName: "accountsChanged", handler: (accounts: Array<Address>) => void);
  on(eventName: "chainChanged", handler: (chainId: number) => void);
  on(eventName: "connect", handler: (info: { chainId: number }) => void);
  on(eventName: "disconnect", handler: (error: { code: number; message: string }) => void);
}

@autoinject
export class EthereumServiceTesting {
  constructor(
    private eventAggregator: EventAggregator,
    private disclaimerService: DisclaimerService,
    private consoleLogService: ConsoleLogService,
    private storageService: BrowserStorageService,
  ) { }

  public static ProviderEndpoints = {
    "mainnet": `https://${process.env.RIVET_ID}.eth.rpc.rivet.cloud/`,
    "rinkeby": `https://${process.env.RIVET_ID}.rinkeby.rpc.rivet.cloud/`,
    "kovan": `https://kovan.infura.io/v3/${process.env.INFURA_ID}`,
  };

  public static targetedNetwork: AllowedNetworks;
  public static targetedChainId: number;

  /**
   * provided by ethers
   */
  public readOnlyProvider: BaseProvider;

  public initialize(network: AllowedNetworks): void {

    if (!network) {
      throw new Error("Ethereum.initialize: `network` must be specified");
    }

    EthereumService.targetedNetwork = network;
    EthereumService.targetedChainId = this.chainIdByName.get(network);
    // EthereumService.providerOptions.torus.options.network = network;

    const readonlyEndPoint = EthereumService.ProviderEndpoints[EthereumService.targetedNetwork];
    if (!readonlyEndPoint) {
      throw new Error(`Please connect to either ${Networks.Mainnet} or ${Networks.Rinkeby}`);
    }

    // comment out to run DISCONNECTED
    this.readOnlyProvider = ethers.getDefaultProvider(EthereumService.ProviderEndpoints[EthereumService.targetedNetwork]);
    this.readOnlyProvider.pollingInterval = 15000;
  }

  private web3Modal: Web3Modal;
  /**
   * provided by Web3Modal
   */
  private web3ModalProvider: Web3Provider & IEIP1193 & ExternalProvider;

  private chainNameById = new Map<number, AllowedNetworks>([
    [1, Networks.Mainnet],
    [4, Networks.Rinkeby],
    [42, Networks.Kovan],
  ]);

  private chainIdByName = new Map<AllowedNetworks, number>([
    [Networks.Mainnet, 1],
    [Networks.Rinkeby, 4],
    [Networks.Kovan, 42],
  ]);

  private async getCurrentAccountFromProvider(provider: Web3Provider): Promise<Signer | string> {
    let account: Signer | string;
    if (Signer.isSigner(provider)) {
      account = provider;
    } else {
      const accounts = await provider.listAccounts();

      if (accounts) {
        account = getAddress(accounts[0]);
      } else {
        account = null;
      }
    }
    return account;
  }

  private async fireAccountsChangedHandler(account: Address) {
    if (account && !(await this.disclaimerService.ensurePrimeDisclaimed(account))) {
      this.disconnect({ code: -1, message: "User declined the Prime Deals disclaimer" });
      account = null;
    }
    console.info(`account changed: ${account}`);
    this.eventAggregator.publish("Network.Changed.Account", ADDRESS);
  }
  private fireChainChangedHandler(info: IChainEventInfo) {
    console.info(`chain changed: ${info.chainId}`);
    this.eventAggregator.publish("Network.Changed.Id", info);
  }
  private fireConnectHandler(info: IChainEventInfo) {
    console.info(`connected: ${info.chainName}`);
    this.eventAggregator.publish("Network.Changed.Connected", info);
  }
  private fireDisconnectHandler(error: { code: number; message: string }) {
    console.info(`disconnected: ${error?.code}: ${error?.message}`);
    this.eventAggregator.publish("Network.Changed.Disconnect", error);
  }

  /**
   * address, even if signer
   */
  private async getDefaultAccountAddress(): Promise<Address | undefined> {
    if (Signer.isSigner(this.defaultAccount)) {
      return await this.defaultAccount.getAddress();
    } else {
      return getAddress(this.defaultAccount);
    }
  }

  /**
   * signer or address
   */
  private defaultAccount: Signer | Address;

  public getDefaultSigner(): Signer {
    return this.walletProvider.getSigner(this.defaultAccountAddress);
  }

  /**
   * provided by ethers given provider from Web3Modal
   */
  public walletProvider: Web3Provider;
  public defaultAccountAddress: Address;

  private async connect(): Promise<void> {
    if (!this.walletProvider) {
      this.ensureWeb3Modal();
      // const web3ModalProvider = await this.web3Modal.connect();
      this.setProvider();
    }
  }

  public ensureConnected(): boolean {
    if (!this.defaultAccountAddress) {
      // TODO: make this await until we're either connected or not?
      this.connect();
      return false;
    }
    else {
      return true;
    }
  }

  /**
   * silently connect to metamask if a metamask account is already connected,
   * without invoking Web3Modal nor MetaMask popups.
   */
  public async connectToConnectedProvider(): Promise<void> {
    // const cachedProvider = this.cachedProvider;
    // const cachedAccount = this.cachedWalletAccount;

    this.ensureWeb3Modal();

    const provider = detectEthereumProvider ? (await detectEthereumProvider({ mustBeMetaMask: true })) as any : undefined;

    /**
     * at this writing, `_metamask.isUnlocked` is "experimental", according to MetaMask.
     * It tells us that the user has logged into Metamask.
     * However, it doesn't tell us whether an account is connected to this dApp.
     * but it sure helps us know whether we can connect without MetaMask asking the user to log in.
     */
    if (provider && provider._metamask.isUnlocked && (await provider._metamask.isUnlocked())) {
      const chainId = this.chainNameById.get(Number(await provider.request({ method: "eth_chainId" })));
      if (chainId === EthereumService.targetedNetwork) {
        const accounts = await provider.request({ method: "eth_accounts" });
        if (accounts?.length) {
          const account = getAddress(accounts[0]);
          if (this.disclaimerService.getPrimeDisclaimed(account)) {
            this.consoleLogService.logMessage(`autoconnecting to ${account}`, "info");
            this.setProvider(provider);
          }
        }
      }
    }
  }

  private ensureWeb3Modal(): void {
    if (!this.web3Modal) {
      this.web3Modal = new Web3Modal({
        // network: Networks.Mainnet,
        cacheProvider: false,
        // providerOptions: EthereumService.providerOptions, // required
        theme: "dark",
      });
      /**
       * If a provider has been cached before, and is still set, Web3Modal will use it even
       * if we have pass `cachedProvider: false` above. `cachedProvider: true` only controls
       * whether the provider should be cached, not whether it should be used.
       * So call clearCachedProvider() here to clear it, just in case it has ever been set.
       */
      this.web3Modal?.clearCachedProvider();
    }
  }

  private async getNetwork(provider: Web3Provider): Promise<Network> {
    let network = await provider.getNetwork();
    network = Object.assign({}, network);
    if (network.name === "homestead") {
      network.name = "mainnet";
    }
    return network;
  }

  private async setProvider(web3ModalProvider?: Web3Provider & IEIP1193 & ExternalProvider): Promise<void> {
    this.defaultAccountAddress = ADDRESS;
    this.fireAccountsChangedHandler(ADDRESS);

    return;
  }

  public disconnect(error: { code: number; message: string }): void {
    // this.cachedProvider = null;
    // this.cachedWalletAccount = null;
    // this.web3Modal?.clearCachedProvider(); // so web3Modal will let the user reconnect
    this.defaultAccount = undefined;
    this.defaultAccountAddress = undefined;
    this.fireAccountsChangedHandler(null);
    this.walletProvider = undefined;
    this.fireDisconnectHandler(error);
  }

  /**
   *
   * @param provider should be a Web3Provider
   * @returns
   */
  public async switchToTargetedNetwork(provider: ExternalProvider): Promise<boolean> {
    const hexChainId = `0x${EthereumService.targetedChainId.toString(16)}`;
    try {
      if (provider.request) {
        /**
         * note this will simply throw an exception when the website is running on localhost
         */
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: hexChainId }],
        });
        this.setProvider(provider as any);
        return true;
      }
    } catch (err) {
      // user rejected request
      if (err.code === 4001) {
        // return false;
      }
      // chain does not exist, let's add it (see balancer)
      // if (err.code === 4902) {
      //   return importNetworkDetailsToWallet(provider);
      // }
    }
    return false;
  }

  public async addTokenToMetamask(
    _tokenAddress: Address,
    _tokenSymbol: string,
    _tokenDecimals: number,
    _tokenImage: string,
  ): Promise<boolean> {
    return Promise.resolve(false);
  }

  public getMetamaskHasToken(_tokenAddress: Address): boolean {
    return false;
  }

  public lastBlock: IBlockInfo;

  /**
   * so unit tests will be able to complete
   */
  public dispose(): void {}

  private async getBlock(blockNumber: number): Promise<IBlockInfo> {
    const block = await this.readOnlyProvider.getBlock(blockNumber) as unknown as IBlockInfo;
    block.blockDate = new Date(block.timestamp * 1000);
    return block;
  }

  public getEtherscanLink(addressOrHash: Address | Hash, tx = false): string {
    let targetedNetwork = EthereumService.targetedNetwork as string;
    if (targetedNetwork === Networks.Mainnet) {
      targetedNetwork = "";
    } else {
      targetedNetwork = targetedNetwork + ".";
    }

    return `http://${targetedNetwork}etherscan.io/${tx ? "tx" : "address"}/${addressOrHash}`;
  }
}

// /* eslint-disable @typescript-eslint/no-unused-vars */
// /* eslint-disable no-console */
// import { ConsoleLogService } from "services/ConsoleLogService";
// import { BigNumber, BigNumberish, ethers, Signer } from "ethers";
// import {
//   BaseProvider,
//   ExternalProvider,
//   Web3Provider,
//   Network,
// } from "@ethersproject/providers";
// import Web3Modal from "web3modal";
// import WalletConnectProvider from "@walletconnect/web3-provider";
// import Torus from "@toruslabs/torus-embed";
// import { EventAggregator } from "aurelia-event-aggregator";
// import { autoinject } from "aurelia-framework";
// import { formatUnits, getAddress, parseUnits } from "ethers/lib/utils";
// import { DisclaimerService } from "services/DisclaimerService";
// import { Utils } from "services/utils";
// import { EthereumService } from "./EthereumService";
// import { BrowserStorageService } from "./BrowserStorageService";

// const ADDRESS = "0xE834627cDE2dC8F55Fe4a26741D3e91527A8a498";

// /* eslint-disable @typescript-eslint/no-empty-function */
// interface IEIP1193 {
//   on(eventName: "accountsChanged", handler: (accounts: Array<Address>) => void);
//   on(eventName: "chainChanged", handler: (chainId: number) => void);
//   on(eventName: "connect", handler: (info: { chainId: number }) => void);
//   on(
//     eventName: "disconnect",
//     handler: (error: { code: number; message: string }) => void
//   );
// }

// export type Address = string;
// export type Hash = string;

// export interface IBlockInfoNative {
//   hash: Hash;
//   /**
//    * previous block
//    */
//   parentHash: Hash;
//   /**
//    *The height(number) of this
//    */
//   number: number;
//   timestamp: number;
//   /**
//    * The maximum amount of gas that this block was permitted to use. This is a value that can be voted up or voted down by miners and is used to automatically adjust the bandwidth requirements of the network.
//    */
//   gasLimit: BigNumber;
//   /**
//    * The total amount of gas used by all transactions in this
//    */
//   gasUsed: BigNumber;
//   transactions: Array<Hash>;
// }

// export interface IBlockInfo extends IBlockInfoNative {
//   blockDate: Date;
// }

// export type AllowedNetworks = "mainnet" | "kovan" | "rinkeby";

// export enum Networks {
//   Mainnet = "mainnet",
//   Rinkeby = "rinkeby",
//   Kovan = "kovan",
// }

// export interface IChainEventInfo {
//   chainId: number;
//   chainName: AllowedNetworks;
//   provider: Web3Provider;
// }

// @autoinject
// export class EthereumServiceTesting {
//   constructor(
//     private eventAggregator: EventAggregator,
//     private disclaimerService: DisclaimerService,
//     private consoleLogService: ConsoleLogService,
//     private storageService: BrowserStorageService,
//   ) { }

//   readOnlyProvider: ethers.providers.BaseProvider;
//   initialize(network: AllowedNetworks): void {
//     console.log("TCL ~ file: IEthereumService.ts ~ line 129 ~ IEthereumService ~ initialize ~ initialize");
//     EthereumService.targetedNetwork = network;
//   }
//   getDefaultSigner(): ethers.Signer {
//     return;
//   }
//   walletProvider: ethers.providers.Web3Provider;
//   public defaultAccountAddress: string;

//   private connect() {
//     this.setProvider();
//   }
//   public ensureConnected(): boolean {
//     this.connect();
//     throw new Error("Method not implemented.");
//   }

//   private async setProvider(web3ModalProvider?: Web3Provider & IEIP1193 & ExternalProvider): Promise<void> {
//     this.defaultAccountAddress = ADDRESS;
//     this.fireAccountsChangedHandler(ADDRESS);
//   }
//   private fireAccountsChangedHandler(account: string) {
//     console.info(`account changed: ${account}`);
//     this.eventAggregator.publish("Network.Changed.Account", account);
//   }

//   public async connectToConnectedProvider(): Promise<void> {
//     await this.setProvider();
//   }

//   public disconnect(error: { code: number; message: string; }): void {
//     this.defaultAccountAddress = undefined;
//   }
//   public async switchToTargetedNetwork(provider: ethers.providers.ExternalProvider): Promise<boolean> {
//     await this.setProvider(provider as any);

//     return true;
//   }
//   public addTokenToMetamask(tokenAddress: string, tokenSymbol: string, tokenDecimals: number, tokenImage: string): Promise<boolean> {
//     return Promise.resolve(true);
//   }
//   public getMetamaskHasToken(tokenAddress: string): boolean {
//     return false;
//   }
//   lastBlock: IBlockInfo;
//   dispose(): void {
//   }
//   getEtherscanLink(addressOrHash: string, tx?: boolean): string {
//     return "eth service mock";
//   }
// }
