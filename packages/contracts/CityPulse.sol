// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CityPulse - Decentralized Hazard Reporting
/// @author CrowdPulse City
/// @notice Kitle kaynaklı şehir erişilebilirlik engelleri için akıllı sözleşme
/// @dev Gas optimizasyonu ve double voting önlemesi ile

contract CityPulse {
    struct Hazard {
        int32 latE6;
        int32 lonE6;
        uint8 category;
        uint8 severity; // 1-5
        address reporter;
        uint40 timestamp;
        bool closed;
        uint16 upvotes;
        uint16 downvotes;
    }

    Hazard[] public hazards;
    mapping(uint256 => mapping(address => bool)) private hasVoted;

    event HazardReported(uint256 indexed hazardId, int32 latE6, int32 lonE6, uint8 category, uint8 severity, address reporter, string noteURI);
    event HazardVoted(uint256 indexed hazardId, address indexed voter, bool up);
    event HazardClosed(uint256 indexed hazardId);

    /// @notice Engeli raporla
    function reportHazard(int32 latE6, int32 lonE6, uint8 category, uint8 severity, string calldata noteURI) external {
        require(severity >= 1 && severity <= 5, "sev");
        Hazard memory h = Hazard({
            latE6: latE6,
            lonE6: lonE6,
            category: category,
            severity: severity,
            reporter: msg.sender,
            timestamp: uint40(block.timestamp),
            closed: false,
            upvotes: 0,
            downvotes: 0
        });
        hazards.push(h);
        emit HazardReported(hazards.length - 1, latE6, lonE6, category, severity, msg.sender, noteURI);
    }

    /// @notice Engeli oyla (up=true: olumlu, up=false: olumsuz)
    function voteHazard(uint256 hazardId, bool up) external {
        require(hazardId < hazards.length, "id");
        Hazard storage h = hazards[hazardId];
        require(!h.closed, "cls");
        require(!hasVoted[hazardId][msg.sender], "dv");
        hasVoted[hazardId][msg.sender] = true;
        if (up) {
            unchecked { h.upvotes++; }
        } else {
            unchecked { h.downvotes++; }
        }
        emit HazardVoted(hazardId, msg.sender, up);
    }

    /// @notice Engeli topluluk threshold ile kapat
    function closeHazard(uint256 hazardId) external {
        require(hazardId < hazards.length, "id");
        Hazard storage h = hazards[hazardId];
        require(!h.closed, "cls");
        require(uint16(h.upvotes) + uint16(h.downvotes) >= 10, "th");
        h.closed = true;
        emit HazardClosed(hazardId);
    }

    /// @notice Engellerin sayısı
    function hazardCount() external view returns (uint256) {
        return hazards.length;
    }
}
