// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IERC20.sol";

/**
 * @title ITIP20
 * @notice Tempo's TIP-20 stablecoin standard: ERC-20 plus 32-byte memos on transfers.
 * @dev Matches Tempo's ABI exactly: transferWithMemo returns nothing (it reverts on failure), while
 *      transferFromWithMemo returns bool. Declaring a return value that the precompile doesn't send would revert.
 */
interface ITIP20 is IERC20 {
    function transferWithMemo(address to, uint256 amount, bytes32 memo) external;
    function transferFromWithMemo(address from, address to, uint256 amount, bytes32 memo) external returns (bool);

    event TransferWithMemo(address indexed from, address indexed to, uint256 amount, bytes32 indexed memo);
}
