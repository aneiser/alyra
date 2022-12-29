# Unit test
The `voting.test.js` test achieves a 100% coverage.

For each function in the `Voting.sol` file (by Cyril), the `voting.test.js` tests each potential `revertedWith()`, `emit()`, including arguments with `.withArgs()`, and **expected final values**.

This is done in the order those elements appear in the `Voting.sol` file.

Moreover, the `beforeEach`s include the common code nedeed for the rest of the `it`s blocks for each given `describe` and both, **GENESIS** and a **logic created** proposal, are tested.

The `voting.test.js` test also tests a regular **Workflow status Tests** where
- `account[2]` propose `"Demo proposal"` and votes for `"Demo proposal"` (account[2] is used as `registeredUser` and `"Demo proposal"` as `demoProposal`)
- `account[4]` propose `"I am 4 and propose A"` and votes for `"I am 4 and propose A"`
- `account[6]` propose `"I am 6 and propose B"` and votes for `"I am 4 and propose A"`
- `account[8]` propose `"I am 8 and propose C"` and votes for `"I am 4 and propose A"`

resulting in `"I am 4 and propose A"`, which is proposal `#2`, being the `winningProposalID`.