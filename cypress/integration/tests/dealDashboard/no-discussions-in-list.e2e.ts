import { Given, Then } from "@badeball/cypress-cucumber-preprocessor/methods";
import { openProposalId1 } from "../../../fixtures/dealFixtures";

Given("I navigate to a Deal Dashboard", () => {
  cy.visit(`/deal/${openProposalId1}`);

  cy.get(".dealDashboardContainer", {timeout: 10000}).should("be.visible");
});
Given("No thread is created for this deal", () => {
  cy.contains("discussions-list", "Discuss").should("be.visible");
  cy.contains("section", "None of the clauses are currently being discussed.").should("be.visible");
});

Then("I should see a no discussions for deal message", () => {
  cy.log("todo");
});
