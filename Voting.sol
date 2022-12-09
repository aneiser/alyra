// SPDX-License-Identifier: MIT


// Pragma statements
pragma solidity 0.8.17;


// Import statements
import "@openzeppelin/contracts/access/Ownable.sol"; // https://docs.openzeppelin.com/contracts/4.x/api/access#Ownable


// Contracts
contract Voting is Ownable {
    // Type declarations
    struct Vote {
        address voterAddress;
        uint votedProposalId;
        string description;
    }

    struct Voter {
        bool isRegistered;
        bool hasVoted;
        uint votedProposalId;
    }

    struct Proposal {
        string description;
        uint voteCount;
    }

    enum WorkflowStatus {
        RegisteringVoters,
        ProposalsRegistrationStarted,
        ProposalsRegistrationEnded,
        VotingSessionStarted,
        VotingSessionEnded,
        VotesTallied
    }

    // State variables
    // Creates the whitelist of Voters identified by their Ethereum address, ...
    mapping(address => Voter) whitelistedVoters; // Change to an array?
    // ...the proposal list to be filled along the winner proposal, ...
    Proposal [] proposals;
    uint256 winningProposalId;
    // a list of votes that will contain the resulting votes and ...
    Vote[] votes;
    // ... the Workflow that sets the voters registration period
    WorkflowStatus votingStatus;

    // Events
    event VoterRegistered(address voterAddress);
    event WorkflowStatusChange(WorkflowStatus previousStatus, WorkflowStatus newStatus);
    event ProposalRegistered(uint proposalId);
    event Voted(address voter, uint proposalId);

    // Voters logic
    // Only registered voters are allowed to submit their proposals while the proposal registration period is open.
    function submitProposal(string memory _proposalDescription) public {
        require(whitelistedVoters[msg.sender].isRegistered, "Only whitelisted addresses can submit a proposal");
        require(votingStatus == WorkflowStatus.ProposalsRegistrationStarted, "The proposal registration period is not open yet");
        proposals.push(Proposal(_proposalDescription,0)); // Proposal = description, voteCount.
        emit ProposalRegistered(proposals.length - 1);
    }

    // To vote, registered voters first need to see the options they can vote among
    function getProposals() public view returns (Proposal[] memory){
        require(whitelistedVoters[msg.sender].isRegistered, "Only whitelisted addresses can vote and thus, see proposals");
        require(votingStatus > WorkflowStatus.ProposalsRegistrationEnded, "You cannot see proposals yet");
        return proposals;
    }

    // Registered voters can vote once they see the options
    function vote(uint256 _votedProposalId) public {
        require(whitelistedVoters[msg.sender].isRegistered, "Only whitelisted addresses can vote");
        require(!whitelistedVoters[msg.sender].hasVoted, "You can only vote once");
        require(votingStatus == WorkflowStatus.VotingSessionStarted, "You cannot vote yet");
        whitelistedVoters[msg.sender].hasVoted = true;
        whitelistedVoters[msg.sender].votedProposalId = _votedProposalId;
        proposals[_votedProposalId].voteCount++;
        votes.push(Vote(msg.sender, _votedProposalId, proposals[_votedProposalId].description));
        emit Voted(msg.sender, _votedProposalId);
    }

    // Registered voters can see others' votes
    function getVotes() public view returns (Vote[] memory){
        require(whitelistedVoters[msg.sender].isRegistered, "Only whitelisted addresses can vote and thus, see others' votes");
        require(votingStatus >= WorkflowStatus.VotingSessionStarted, "The voting period is not open yet");
        return votes;
    }

    // Everyone can check the final details of the winning proposal.
    function getWinner() public view returns (Proposal memory) {
        require(votingStatus == WorkflowStatus.VotesTallied, "There is no winner yet. Wait for votes to be counted");
        return proposals[winningProposalId]; // Returns the proposal description and votes received
    }

    // Admin logic
    // Only the admin/owner of the contract can register voters
    function whitelistAddress(address _address) external onlyOwner {
        require(votingStatus == WorkflowStatus.RegisteringVoters, "It is not the voters registration period");
        require(!whitelistedVoters[_address].isRegistered, "This address is already registered");
        whitelistedVoters[_address] = Voter(true, false, 0); // Voter = isRegistered, hasVoted, votedProposalId. ¿isRegisted means whitelisted or voter has made a proposal?
        emit VoterRegistered(_address);
    }

    // Only the admin/owner of the contract can open the proposal registration period
    function openProposalRegistrationPeriod() external onlyOwner {
        require(votingStatus == WorkflowStatus.RegisteringVoters, "To open the proposal registration period first you must set the voters registration period");
        votingStatus = WorkflowStatus.ProposalsRegistrationStarted;
        emit WorkflowStatusChange(WorkflowStatus.RegisteringVoters, WorkflowStatus.ProposalsRegistrationStarted);
    }

    // Only the admin/owner of the contract can close the proposal registration period
    function closeProposalRegistrationPeriod() external onlyOwner {
        require(votingStatus == WorkflowStatus.ProposalsRegistrationStarted, "To close the proposal registration period first you must open it");
        votingStatus = WorkflowStatus.ProposalsRegistrationEnded;
        emit WorkflowStatusChange(WorkflowStatus.ProposalsRegistrationStarted, WorkflowStatus.ProposalsRegistrationEnded);
    }

    // Only the admin/owner of the contract can open the voting period
    function openVotingPeriod() external onlyOwner {
        require(votingStatus == WorkflowStatus.ProposalsRegistrationEnded, "To open the voting period first you must close the proposal registration period");
        votingStatus = WorkflowStatus.VotingSessionStarted;
        emit WorkflowStatusChange(WorkflowStatus.ProposalsRegistrationEnded, WorkflowStatus.VotingSessionStarted);
    }
    // Only the admin/owner of the contract can close the voting period
    function closeVotingPeriod() external onlyOwner {
        require(votingStatus == WorkflowStatus.VotingSessionStarted, "To close the voting first you must open it");
        votingStatus = WorkflowStatus.VotingSessionEnded;
        emit WorkflowStatusChange(WorkflowStatus.VotingSessionStarted, WorkflowStatus.VotingSessionEnded);
    }

    // Only the admin/owner of the contract can finish the voting and counts votes
    function finishAndCountVotes() external onlyOwner {
        require(votingStatus == WorkflowStatus.VotingSessionEnded, "You cannot count votes until the voting period is closed");
        votingStatus = WorkflowStatus.VotesTallied;
        emit WorkflowStatusChange(WorkflowStatus.VotingSessionEnded, WorkflowStatus.VotesTallied);

        // Count votes.
        for (uint256 i=0; i < proposals.length-1; i++) {
            // In the case of several proposal having the same amount of votes, the latest proposal wins
            if (proposals[i].voteCount >= proposals[winningProposalId].voteCount) {
                winningProposalId = i;
            }
        }
    }

}