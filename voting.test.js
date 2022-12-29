const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Unit tests for Voting.sol smartcontract", async function () {
        let accounts;
        let voting;
        let demoProposal = "Demo proposal";

        before(async () => {
            accounts = await ethers.getSigners()
            deployer = accounts[0]
            registeredUser = accounts[2]
            notDeployerNorRegisteredUser = accounts[1]
        })

        describe("getVoter", async function() {
            beforeEach(async() => {
                // Deployment
                await deployments.fixture(["voting"])
                voting = await ethers.getContract("Voting")

                // Registers demo user
                await voting.addVoter(registeredUser.getAddress())
            })

            it("... should NOT 'getVoter' if NOT registered", async function () {
                await expect(voting.connect(notDeployerNorRegisteredUser).getVoter(registeredUser.getAddress()))
                    .to.be.revertedWith("You're not a voter")
            })

            it("... should 'getVoter' if registered", async function () {
                let demoVoter = await voting.connect(registeredUser).getVoter(registeredUser.getAddress())
                assert(demoVoter.isRegistered)
            })
        })

        describe("getOneProposal", async function() {
            beforeEach(async() => {
                // Deployment
                await deployments.fixture(["voting"])
                voting = await ethers.getContract("Voting")

                // Registers demo user
                await voting.addVoter(registeredUser.getAddress())

                // Set the appropiate status, which also creates a GENESIS proposal
                await voting.startProposalsRegistering()
            })

            it("... should NOT 'getOneProposal' if NOT registered", async function () {
                await expect(voting.connect(notDeployerNorRegisteredUser).getOneProposal(0))
                .to.be.revertedWith("You're not a voter")
            })

            it("... should 'getOneProposal' if registered", async function () {
                let retrievedProposal = await voting.connect(registeredUser).getOneProposal(0);
                assert(retrievedProposal.description == "GENESIS");
            })
        })

        describe("addVoter", async function() {
            beforeEach(async() => {
                // Deployment
                await deployments.fixture(["voting"])
                voting = await ethers.getContract("Voting")
            })

            it("... should NOT 'addvoter' if NOT the owner", async function () {
                await expect(voting.connect(notDeployerNorRegisteredUser).addVoter(registeredUser.getAddress()))
                    .to.be.revertedWith("Ownable: caller is not the owner")
            })

            it("... should NOT 'addvoter' if the owner but is NOT 'registeringVotersPeriod'", async function () {
                // Set an inappropiate status, which also creates a GENESIS proposal
                await voting.startProposalsRegistering()

                await expect(voting.addVoter(registeredUser.getAddress()))
                    .to.be.revertedWith("Voters registration is not open yet")
            })

            it("... should NOT 'addvoter' if the owner and 'registeringVotersPeriod' but address is ALREADY registered", async function () {
                // Register for the first time
                await voting.addVoter(registeredUser.getAddress())

                await expect(voting.addVoter(registeredUser.getAddress()))
                    .to.be.revertedWith("Already registered")
            })

            it("... should 'addvoter' if the owner, 'registeringVotersPeriod' and address is not registered", async function () {
                await expect(voting.addVoter(registeredUser.getAddress()))
                    .to.emit(voting, "VoterRegistered")
                    .withArgs(await registeredUser.getAddress())

                // Post-conditions evaluation
                voter = await voting.connect(registeredUser).getVoter(registeredUser.getAddress())
                assert(voter.isRegistered == true)
            })
        })

        describe("addProposal", async function() {
            beforeEach(async() => {
                // Deployment
                await deployments.fixture(["voting"])
                voting = await ethers.getContract("Voting")

                // Registers demo user
                await voting.addVoter(registeredUser.getAddress())
            })

            it("... should NOT 'addProposal' if NOT registered", async function () {
                await expect(voting.connect(notDeployerNorRegisteredUser).addProposal(demoProposal))
                    .to.be.revertedWith("You're not a voter")
            })

            it("... should NOT 'addProposal' if registered but is NOT 'ProposalsRegistrationStarted'", async function () {
                await expect(voting.connect(registeredUser).addProposal(demoProposal))
                    .to.be.revertedWith("Proposals are not allowed yet")
            })

            it("... should NOT 'addProposal' if registered and is 'ProposalsRegistrationStarted' but description is EMPTY", async function () {
                // Set the appropiate status, which also creates a GENESIS proposal
                await voting.startProposalsRegistering()

                await expect(voting.connect(registeredUser).addProposal(""))
                    .to.be.revertedWith("Vous ne pouvez pas ne rien proposer")
            })

            it("... should 'addProposal' if registered, is 'ProposalsRegistrationStarted' and description is NOT EMPTY", async function () {
                // Set the appropiate status, which also creates a GENESIS proposal
                await voting.startProposalsRegistering() // [0 = GENESIS]

                // Add demo proposal
                await expect(voting.connect(registeredUser).addProposal(demoProposal))
                    .to.emit(voting, "ProposalRegistered")
                    .withArgs(1) // [0 = GENESIS, 1 = demoProposal]

                let retrievedProposal = await voting.connect(registeredUser).getOneProposal(0);
                assert(retrievedProposal.description == "GENESIS");
                retrievedProposal = await voting.connect(registeredUser).getOneProposal(1);
                assert(retrievedProposal.description == demoProposal);
            })
        })

        describe("setVote", async function() {
            beforeEach(async() => {
                // Deployment
                await deployments.fixture(["voting"])
                voting = await ethers.getContract("Voting")

                // Registers demo user
                await voting.addVoter(registeredUser.getAddress())

                // Set the appropiate status, which also creates a GENESIS proposal
                await voting.startProposalsRegistering()

                // Add demo proposal
                await voting.connect(registeredUser).addProposal(demoProposal)

                // Set the appropiate status
                await voting.endProposalsRegistering()
                await voting.startVotingSession()
            })

            it("... should NOT 'setVote' if NOT registered", async function() {
                await expect(voting.connect(notDeployerNorRegisteredUser).setVote(1))
                    .to.be.revertedWith("You're not a voter")
            })

            it("... should NOT 'setVote' if registered but is NOT 'VotingSessionStarted'", async function () {
                // Set inappropiate status
                await voting.endVotingSession()

                await expect(voting.connect(registeredUser).setVote(1))
                    .to.be.revertedWith("Voting session havent started yet")
            })

            it("... should NOT 'setVote' if registered, is 'VotingSessionStarted' but ALREADY VOTED", async function () {
                // First vote of 'registeredUser'
                await voting.connect(registeredUser).setVote(1);

                // Second vote of 'registeredUser'
                await expect(voting.connect(registeredUser).setVote(1))
                    .to.be.revertedWith("You have already voted")
            })

            it("... should NOT 'setVote' if registered, is 'VotingSessionStarted', not voted YET but proposal does NOT EXIST", async function () {
                await expect(voting.connect(registeredUser).setVote(2))
                    .to.be.revertedWith("Proposal not found")
            })

            it("... should 'setVote' if registered, is 'VotingSessionStarted', not voted YET and proposal does EXIST", async function () {
                // Pre-conditions evaluation
                let voter = await voting.connect(registeredUser).getVoter(registeredUser.getAddress())
                assert(voter.hasVoted == false)
                assert(voter.votedProposalId == 0)
                let retrievedProposal = await voting.connect(registeredUser).getOneProposal(1);
                assert(retrievedProposal.voteCount == 0);

                await expect(voting.connect(registeredUser).setVote(1))
                    .to.emit(voting, "Voted")
                    .withArgs(await registeredUser.getAddress(), 1)

                // Post-conditions evaluation
                voter = await voting.connect(registeredUser).getVoter(registeredUser.getAddress())
                assert(voter.hasVoted == true)
                assert(voter.votedProposalId == 1)
                retrievedProposal = await voting.connect(registeredUser).getOneProposal(1);
                assert(retrievedProposal.voteCount == 1);
            })
        })

        describe("startProposalsRegistering", async function() {
            beforeEach(async() => {
                // Deployment
                await deployments.fixture(["voting"])
                voting = await ethers.getContract("Voting")
            })

            it("... should NOT 'startProposalsRegistering' if NOT the owner", async function () {
                await expect(voting.connect(notDeployerNorRegisteredUser).startProposalsRegistering())
                    .to.be.revertedWith("Ownable: caller is not the owner")
            })

            it("... should NOT 'startProposalsRegistering' if is NOT 'RegisteringVoters'", async function () {
                // Set an inappropiate status, which also creates a GENESIS proposal
                await voting.startProposalsRegistering()

                await expect(voting.startProposalsRegistering())
                    .to.be.revertedWith("Registering proposals cant be started now")
            })

            it("... should 'startProposalsRegistering' if 'RegisteringVoters'", async function() {
                // Registers demo user
                await voting.addVoter(registeredUser.getAddress())

                await expect(voting.startProposalsRegistering())
                    .to.emit(voting, "WorkflowStatusChange")
                    .withArgs(0, 1)

                let retrievedProposal = await voting.connect(registeredUser).getOneProposal(0);
                assert(retrievedProposal.description == "GENESIS");

                let demoStatus = await voting.workflowStatus()
                assert(demoStatus == "1") // ProposalsRegistrationStarted
            })
        })

        describe("endProposalsRegistering", async function() {
            beforeEach(async() => {
                // Deployment
                await deployments.fixture(["voting"])
                voting = await ethers.getContract("Voting")
            })

            it("... should NOT 'endProposalsRegistering' if NOT the owner", async function () {
                await expect(voting.connect(notDeployerNorRegisteredUser).endProposalsRegistering())
                    .to.be.revertedWith("Ownable: caller is not the owner")
            })

            it("... should NOT 'endProposalsRegistering' but is NOT 'ProposalsRegistrationStarted'", async function () {
                await expect(voting.endProposalsRegistering())
                    .to.be.revertedWith("Registering proposals havent started yet")
            })

            it("... should 'endProposalsRegistering' if 'ProposalsRegistrationStarted'", async function() {
                // Set the appropiate status, which also creates a GENESIS proposal
                await voting.startProposalsRegistering()

                await expect(voting.endProposalsRegistering())
                    .to.emit(voting, "WorkflowStatusChange")
                    .withArgs(1, 2)

                let demoStatus = await voting.workflowStatus()
                assert(demoStatus == "2") // ProposalsRegistrationEnded
            })
        })

        describe("startVotingSession", async function() {
            beforeEach(async() => {
                // Deployment
                await deployments.fixture(["voting"])
                voting = await ethers.getContract("Voting")
            })

            it("... should NOT 'startVotingSession' if NOT the owner", async function () {
                await expect(voting.connect(notDeployerNorRegisteredUser).startVotingSession())
                    .to.be.revertedWith("Ownable: caller is not the owner")
            })

            it("... should NOT 'startVotingSession' but is NOT 'ProposalsRegistrationEnded'", async function () {
                await expect(voting.startVotingSession())
                    .to.be.revertedWith("Registering proposals phase is not finished")
            })

            it("... should 'startVotingSession' if 'ProposalsRegistrationEnded'", async function() {
                // Set the appropiate status, which also creates a GENESIS proposal
                await voting.startProposalsRegistering()
                await voting.endProposalsRegistering()

                await expect(voting.startVotingSession())
                    .to.emit(voting, "WorkflowStatusChange")
                    .withArgs(2, 3)

                let demoStatus = await voting.workflowStatus()
                assert(demoStatus == "3") // VotingSessionStarted
            })
        })

        describe("endVotingSession", async function() {
            beforeEach(async() => {
                // Deployment
                await deployments.fixture(["voting"])
                voting = await ethers.getContract("Voting")
            })

            it("... should NOT 'endVotingSession' if NOT the owner", async function () {
                await expect(voting.connect(notDeployerNorRegisteredUser).endVotingSession())
                    .to.be.revertedWith("Ownable: caller is not the owner")
            })

            it("... should NOT 'endVotingSession' but is NOT 'VotingSessionStarted'", async function () {
                await expect(voting.endVotingSession())
                    .to.be.revertedWith("Voting session havent started yet")
            })

            it("... should 'endVotingSession' if 'VotingSessionStarted'", async function() {
                // Set the appropiate status, which also creates a GENESIS proposal
                await voting.startProposalsRegistering()
                await voting.endProposalsRegistering()
                await voting.startVotingSession()

                await expect(voting.endVotingSession())
                    .to.emit(voting, "WorkflowStatusChange")
                    .withArgs(3, 4)

                let demoStatus = await voting.workflowStatus()
                assert(demoStatus == "4") // VotingSessionEnded
            })
        })

        describe("tallyVotes", async function() {
            beforeEach(async() => {
                // Deployment
                await deployments.fixture(["voting"])
                voting = await ethers.getContract("Voting")
            })

            it("... should NOT 'tallyVotes' if NOT the owner", async function () {
                await expect(voting.connect(notDeployerNorRegisteredUser).tallyVotes())
                .to.be.revertedWith("Ownable: caller is not the owner")
            })

            it("... should NOT 'tallyVotes' but is NOT 'VotingSessionEnded'", async function () {
                await expect(voting.tallyVotes())
                .to.be.revertedWith("Current status is not voting session ended")
            })

            it("... should 'tallyVotes' if 'VotingSessionEnded'", async function () {
                // Registers demo user
                await voting.addVoter(registeredUser.getAddress())
                // Set the appropiate status, which also creates a GENESIS proposal
                await voting.startProposalsRegistering()
                // Add demo proposal
                await voting.connect(registeredUser).addProposal(demoProposal)
                // Set the appropiate status
                await voting.endProposalsRegistering()
                await voting.startVotingSession()

                // Pre-conditions evaluation
                let demoWinningProposalID = await voting.winningProposalID();
                expect(demoWinningProposalID).eq(ethers.BigNumber.from("0"))

                // Demo vote
                await voting.connect(registeredUser).setVote(1)

                // Set the appropiate status
                await voting.endVotingSession()

                await expect(voting.tallyVotes())
                .to.emit(voting, "WorkflowStatusChange")
                .withArgs(4, 5)

                // Post-conditions evaluation
                demoWinningProposalID = await voting.winningProposalID()
                expect(demoWinningProposalID).eq(ethers.BigNumber.from("1"))

                let demoStatus = await voting.workflowStatus()
                assert(demoStatus == "5") // VotesTallied
            })
        })

        describe("Workflow status Tests", function () {
            before(async() => {
                // Deployment
                await deployments.fixture(["voting"])
                voting = await ethers.getContract("Voting")
            })

            it("1. Owner add voters", async function () {
                await expect(voting.addVoter(registeredUser.getAddress()))
                    .to.emit(voting, "VoterRegistered")
                    .withArgs(await registeredUser.getAddress())
                await expect(voting.addVoter(accounts[4].getAddress()))
                    .to.emit(voting, "VoterRegistered")
                    .withArgs(await accounts[4].getAddress())
                await expect(voting.addVoter(accounts[6].getAddress()))
                    .to.emit(voting, "VoterRegistered")
                    .withArgs(await accounts[6].getAddress())
                await expect(voting.addVoter(accounts[8].getAddress()))
                    .to.emit(voting, "VoterRegistered")
                    .withArgs(await accounts[8].getAddress())

                // Post-conditions evaluation
                voter = await voting.connect(registeredUser).getVoter(registeredUser.getAddress())
                assert(voter.isRegistered == true)
                voter4 = await voting.connect(registeredUser).getVoter(accounts[4].getAddress())
                assert(voter4.isRegistered == true)
                voter6 = await voting.connect(registeredUser).getVoter(accounts[6].getAddress())
                assert(voter6.isRegistered == true)
                voter8 = await voting.connect(registeredUser).getVoter(accounts[8].getAddress())
                assert(voter8.isRegistered == true)
            })

            it("2. Owner start proposals registering", async function () {
                await expect(voting.startProposalsRegistering())
                    .to.emit(voting, "WorkflowStatusChange")
                    .withArgs(0, 1)

                // Post-conditions evaluation
                let retrievedProposal = await voting.connect(registeredUser).getOneProposal(0);
                assert(retrievedProposal.description == "GENESIS");

                let demoStatus = await voting.workflowStatus()
                assert(demoStatus == "1") // ProposalsRegistrationStarted
            })

            it("3. Voters add proposals", async function () {
                // Add demo proposals
                await expect(voting.connect(registeredUser).addProposal(demoProposal))
                    .to.emit(voting, "ProposalRegistered")
                    .withArgs(1) // [0 = GENESIS, 1 = demoProposal]
                await expect(voting.connect(accounts[4]).addProposal("I am 4 and propose A"))
                    .to.emit(voting, "ProposalRegistered")
                    .withArgs(2) // [0 = GENESIS, 1 = demoProposal, 2 = A]
                await expect(voting.connect(accounts[6]).addProposal("I am 6 and propose B"))
                    .to.emit(voting, "ProposalRegistered")
                    .withArgs(3) // [0 = GENESIS, 1 = demoProposal, 2 = A, 3 = B]
                await expect(voting.connect(accounts[8]).addProposal("I am 8 and propose C"))
                    .to.emit(voting, "ProposalRegistered")
                    .withArgs(4) // [0 = GENESIS, 1 = demoProposal, 2 = A, 3 = B, 4 = C]

                // Post-conditions evaluation
                let retrievedProposal = await voting.connect(registeredUser).getOneProposal(0);
                assert(retrievedProposal.description == "GENESIS");
                retrievedProposal = await voting.connect(registeredUser).getOneProposal(1);
                assert(retrievedProposal.description == demoProposal);
                retrievedProposal = await voting.connect(accounts[4]).getOneProposal(2);
                assert(retrievedProposal.description == "I am 4 and propose A");
                retrievedProposal = await voting.connect(accounts[6]).getOneProposal(3);
                assert(retrievedProposal.description == "I am 6 and propose B");
                retrievedProposal = await voting.connect(accounts[8]).getOneProposal(4);
                assert(retrievedProposal.description == "I am 8 and propose C");
            })

            it("4. Owner end proposals registering", async function () {
                await expect(voting.endProposalsRegistering())
                    .to.emit(voting, "WorkflowStatusChange")
                    .withArgs(1, 2)

                // Post-conditions evaluation
                let demoStatus = await voting.workflowStatus()
                assert(demoStatus == "2") // ProposalsRegistrationEnded
            })

            it("5. Owner start voting session", async function () {
                await expect(voting.startVotingSession())
                    .to.emit(voting, "WorkflowStatusChange")
                    .withArgs(2, 3)

                // Post-conditions evaluation
                let demoStatus = await voting.workflowStatus()
                assert(demoStatus == "3") // VotingSessionStarted
            })

            it("6. Voters vote", async function () {
                // No need to test "voters getting proposals" as it was tested in
                // the Post-conditions evaluation of "3. Voters add proposals"

                await expect(voting.connect(registeredUser).setVote(1))
                    .to.emit(voting, "Voted")
                    .withArgs(await registeredUser.getAddress(), 1)
                await expect(voting.connect(accounts[4]).setVote(2))
                    .to.emit(voting, "Voted")
                    .withArgs(await accounts[4].getAddress(), 2)
                await expect(voting.connect(accounts[6]).setVote(2))
                    .to.emit(voting, "Voted")
                    .withArgs(await accounts[6].getAddress(), 2)
                await expect(voting.connect(accounts[8]).setVote(2))
                    .to.emit(voting, "Voted")
                    .withArgs(await accounts[8].getAddress(), 2)
                // demoProposal = 1 (1 vote), "I am 4 and propose A" = 2 (3 votes)

                // Post-conditions evaluation
                voter = await voting.connect(registeredUser).getVoter(accounts[4].getAddress())
                assert(voter.hasVoted == true)
                assert(voter.votedProposalId == 2)
                retrievedProposal = await voting.connect(registeredUser).getOneProposal(0);
                assert(retrievedProposal.voteCount == 0);

                voter = await voting.connect(accounts[4]).getVoter(accounts[6].getAddress())
                assert(voter.hasVoted == true)
                assert(voter.votedProposalId == 2)
                retrievedProposal = await voting.connect(accounts[4]).getOneProposal(1);
                assert(retrievedProposal.voteCount == 1);

                voter = await voting.connect(accounts[6]).getVoter(accounts[8].getAddress())
                assert(voter.hasVoted == true)
                assert(voter.votedProposalId == 2)
                retrievedProposal = await voting.connect(accounts[6]).getOneProposal(2);
                assert(retrievedProposal.voteCount == 3);

                voter = await voting.connect(accounts[8]).getVoter(registeredUser.getAddress())
                assert(voter.hasVoted == true)
                assert(voter.votedProposalId == 1)
                retrievedProposal = await voting.connect(accounts[8]).getOneProposal(3);
                assert(retrievedProposal.voteCount == 0);
            })

            it("7. Owner end voting session", async function () {
                await expect(voting.endVotingSession())
                    .to.emit(voting, "WorkflowStatusChange")
                    .withArgs(3, 4)

                // Post-conditions evaluation
                let demoStatus = await voting.workflowStatus()
                assert(demoStatus == "4") // VotingSessionEnded
            })

            it("8. Owner tally votes", async function () {
                // No need to test "get voters" as it was tested in
                // the Post-conditions evaluation of "6. Voters vote"

                await expect(voting.tallyVotes())
                    .to.emit(voting, "WorkflowStatusChange")
                    .withArgs(4, 5)

                // Post-conditions evaluation
                let demoStatus = await voting.workflowStatus()
                assert(demoStatus == "5") // VotesTallied
            })

            it("9. Everybody can see the winner proposal", async function () {
                demoWinningProposalID = await voting.winningProposalID()
                expect(demoWinningProposalID).eq(ethers.BigNumber.from("2"))
                demoWinningProposalID = await voting.connect(registeredUser).winningProposalID()
                expect(demoWinningProposalID).eq(ethers.BigNumber.from("2"))
                demoWinningProposalID = await voting.connect(notDeployerNorRegisteredUser).winningProposalID()
                expect(demoWinningProposalID).eq(ethers.BigNumber.from("2"))
            })
        })
    })