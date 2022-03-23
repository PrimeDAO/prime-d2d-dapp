Feature: Discussions - Wallet
  Background:
    Given I navigate to the Deals home page
    When I'm viewing a public Deal

  Scenario: Wallet - Disconnected - Deal Clauses
    Then I cannot begin a Discussion

  Scenario: Wallet - Disconnected - Threads
    Then I'm informed about who can participate in Discussions

  Scenario: Wallet - Disconnected - Single Comments - Add Comment
    When I choose a Single Comment without replies
    Then I cannot add a Comment

  @focus
  Scenario: Wallet - Disconnected - Single Comments - Comment actions
    When I choose a Single Comment with replies
    Then I cannot add a Comment
    And I cannot reply to a Comment
    # And I cannot dislike a Comment
  #   - no vote, comment, reply, (dis)like
