import { ComingSoon } from "./comingSoon/comingSoon";
import { Funding } from "./funding/funding";
import { Documentation } from "./documentation/documentation";
import { Initiate } from "./initiate/initiate";
import { IRoute } from "@aurelia/router";
import { Home } from "./home/home";
import { Deals } from "deals/list/deals";
import { DealDashboard } from "./dealDashboard/dealDashboard";
import { Contribute } from "./contribute/contribute";

export const routes: IRoute[] = [
  {
    path: "",
    id: "home",
    title: "Home",
    component: Home,
  },
  {
    path: "home",
    id: "home",
    title: "Home",
    component: Home,
  },
  {
    path: "initiate",
    id: "initiate",
    title: "Initiate",
    component: Initiate,
  },
  {
    path: "initiate/token-swap",
    id: "tokenSwapTypeSelection",
    title: "Select Token Swap Type",
    component: import("./initiate/tokenSwapTypeSelection/tokenSwapTypeSelection"),
  },
  {
    path: "deals",
    id: "deals",
    title: "Deals",
    component: Deals,
  },
  {
    path: "documentation",
    id: "documentation",
    title: "Documentation",
    component: Documentation,
  },
  {
    id: "dealDashboard",
    path: "deal/:id",
    component: DealDashboard,
  },
  {
    id: "contribute",
    path: "contribute",
    title: Contribute,
  },
  {
    component: import("./documentation/officialDocs/termsOfService.html"),
    id: "termsOfService",
    path: ["terms-of-service"],
    title: "Terms of Service",
  },
  {
    component: Funding,
    id: "funding",
    path: "/funding/:id",
    title: "Funding",
  },
  {
    component: ComingSoon,
    id: "comingSoon",
    path: ["comingSoon"],
    title: "Coming Soon!",
  },
  {
    component: import("./playground/playground"),
    id: "playground",
    path: ["playground"],
    title: "Playground",
  },
];
