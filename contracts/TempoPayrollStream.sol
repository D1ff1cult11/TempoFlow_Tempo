// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/ITIP20.sol";
import "./interfaces/ITempoPayrollStream.sol";

/**
 * @title TempoPayrollStream
 * @notice Per-second streaming payroll on Tempo with TIP-20 stablecoins.
 * @dev The employer escrows the full amount; pay accrues linearly every second and the employee can withdraw at
 *      any time. Every token movement (funding, withdrawals, cancellation payouts and refunds) carries the
 *      streamId as its TIP-20 memo, so streams reconcile in explorers and ledgers. Use a readable streamId
 *      (e.g. "S-2026-11-priya" as 32 bytes) for human-readable memos.
 */
contract TempoPayrollStream is ITempoPayrollStream {
    mapping(bytes32 => Stream) public streams;

    // Lightweight reentrancy protection
    uint256 private _unlocked = 1;

    modifier nonReentrant() {
        require(_unlocked == 1, "REENTRANCY_GUARD");
        _unlocked = 2;
        _;
        _unlocked = 1;
    }

    constructor() {}

    /**
     * @notice Creates and funds a new continuous payroll stream
     * @param streamId Unique deterministic identifier for the stream
     * @param employee Recipient contractor or employee wallet address
     * @param token TIP-20 stablecoin (supports transferWithMemo / transferFromWithMemo)
     * @param totalAmount Total deposit amount to stream
     * @param durationSeconds Total duration of the payroll cycle in seconds
     */
    function createStream(
        bytes32 streamId,
        address employee,
        address token,
        uint256 totalAmount,
        uint256 durationSeconds
    ) external override nonReentrant {
        require(streams[streamId].employer == address(0), "Stream already exists");
        require(employee != address(0) && token != address(0), "Zero address");
        require(durationSeconds > 0, "Invalid duration");
        require(totalAmount >= durationSeconds, "Deposit must cover at least 1 unit/sec");

        // 1. Effects
        uint256 rate = totalAmount / durationSeconds;
        uint256 startTime = block.timestamp;
        uint256 stopTime = block.timestamp + durationSeconds;

        streams[streamId] = Stream({
            employer: msg.sender,
            employee: employee,
            token: token,
            ratePerSecond: rate,
            startTime: startTime,
            stopTime: stopTime,
            remainingBalance: totalAmount,
            lastClaimTime: startTime,
            isActive: true
        });

        // 2. Interactions: escrow tokens into this contract, tagged with the stream id
        require(ITIP20(token).transferFromWithMemo(msg.sender, address(this), totalAmount, streamId), "TRANSFER_FAILED");

        emit StreamCreated(
            streamId,
            msg.sender,
            employee,
            token,
            rate,
            totalAmount,
            startTime,
            stopTime
        );
    }

    /**
     * @notice View the current claimable amount for a given stream down to the exact second
     */
    function availableToClaim(bytes32 streamId) public view override returns (uint256) {
        Stream memory s = streams[streamId];
        if (!s.isActive || s.employer == address(0)) {
            return 0;
        }

        if (block.timestamp <= s.lastClaimTime) {
            return 0;
        }

        // If current time has reached or exceeded stopTime, all remaining balance is claimable
        if (block.timestamp >= s.stopTime) {
            return s.remainingBalance;
        }

        uint256 elapsed = block.timestamp - s.lastClaimTime;
        uint256 claimable = elapsed * s.ratePerSecond;

        return claimable > s.remainingBalance ? s.remainingBalance : claimable;
    }

    /**
     * @notice Withdraw accrued salary from the stream
     */
    function withdrawFromStream(bytes32 streamId) external override nonReentrant returns (uint256 claimable) {
        Stream storage s = streams[streamId];
        require(s.isActive, "Stream is not active");
        require(msg.sender == s.employee, "Only employee");

        claimable = availableToClaim(streamId);
        require(claimable > 0, "Zero claimable balance");

        // Effects
        s.remainingBalance -= claimable;
        s.lastClaimTime = block.timestamp > s.stopTime ? s.stopTime : block.timestamp;

        if (s.remainingBalance == 0) {
            s.isActive = false;
        }

        // Interactions
        ITIP20(s.token).transferWithMemo(s.employee, claimable, streamId); // reverts on failure

        emit StreamWithdrawn(streamId, s.employee, claimable, s.remainingBalance);
    }

    /**
     * @notice Cancel a stream with fair, mathematically exact escrow settlement
     * @dev Pays employee for all seconds worked up to block.timestamp, and refunds remainder to employer
     */
    function cancelStream(bytes32 streamId)
        external
        override
        nonReentrant
        returns (uint256 employeePayout, uint256 employerRefund)
    {
        Stream storage s = streams[streamId];
        require(s.isActive, "Stream is not active");
        require(
            msg.sender == s.employer || msg.sender == s.employee,
            "Only stream participants"
        );

        employeePayout = availableToClaim(streamId);
        employerRefund = s.remainingBalance > employeePayout ? s.remainingBalance - employeePayout : 0;

        // Effects
        s.isActive = false;
        s.remainingBalance = 0;
        s.lastClaimTime = block.timestamp;

        address emp = s.employer;
        address worker = s.employee;
        address token = s.token;

        // Interactions
        if (employeePayout > 0) {
            ITIP20(token).transferWithMemo(worker, employeePayout, streamId);
        }

        if (employerRefund > 0) {
            ITIP20(token).transferWithMemo(emp, employerRefund, streamId);
        }

        emit StreamCancelled(streamId, emp, worker, employeePayout, employerRefund);
    }

    function getStream(bytes32 streamId) external view override returns (Stream memory) {
        return streams[streamId];
    }

    /**
     * @notice Alias view for availableToClaim
     */
    function getClaimableBalance(bytes32 streamId) external view returns (uint256) {
        return availableToClaim(streamId);
    }

    /**
     * @notice Returns comprehensive summary of a stream for frontend odometers and dashboards
     */
    function getStreamSummary(bytes32 streamId)
        external
        view
        returns (
            address employer,
            address employee,
            address token,
            uint256 ratePerSecond,
            uint256 remainingBalance,
            uint256 claimableNow,
            bool isActive
        )
    {
        Stream memory s = streams[streamId];
        return (
            s.employer,
            s.employee,
            s.token,
            s.ratePerSecond,
            s.remainingBalance,
            availableToClaim(streamId),
            s.isActive
        );
    }
}
