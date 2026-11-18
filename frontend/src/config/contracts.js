// Contract Addresses and Network Metadata for TempoFlow Web Terminal

export const NETWORK_CONFIG = {
  tempoTestnet: {
    chainId: '0xa5bf', // 42431 in hex
    chainIdDecimal: 42431,
    chainName: 'Tempo Testnet (Moderato)',
    nativeCurrency: {
      name: 'USD',
      symbol: 'USD',
      decimals: 6,
    },
    rpcUrls: ['https://rpc.moderato.tempo.xyz'],
    blockExplorerUrls: ['https://explore.testnet.tempo.xyz'],
  },
};

// NOTE: These are the default addresses a fresh local Hardhat node assigns.
// TempoFlow is NOT deployed to Tempo testnet/mainnet yet, so Live Web3 Mode will not
// work against the public Tempo network until real addresses replace these.
export const CONTRACT_ADDRESSES = {
  USDC: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  EURC: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  EnshrinedAMM: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  TempoFlowRouter: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
  TempoPayrollStream: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
  // MerchantSettlementVault is deployed per-merchant; this is the default demo vault
  MerchantSettlementVault: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
};

export const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address recipient, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function mint(address to, uint256 amount) external',
];

export const ROUTER_ABI = [
  'function executePayment(bytes32 orderId, address merchant, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut) external returns (uint256 finalAmount)',
  'function executeSplitPayment(bytes32 orderId, address merchant, address splitRecipient, uint256 splitBps, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut) external returns (uint256 merchantAmount, uint256 splitAmount)',
  'function isOrderExecuted(bytes32 orderId) external view returns (bool)',
  'function protocolFeeBps() external view returns (uint256)',
  'function protocolTreasury() external view returns (address)',
  'function paused() external view returns (bool)',
  'event PaymentSettled(bytes32 indexed orderId, address indexed payer, address indexed merchant, address tokenPaid, address tokenReceived, uint256 amountPaid, uint256 amountReceived, uint256 timestamp)',
];

export const PAYROLL_ABI = [
  'function createStream(bytes32 streamId, address employee, address token, uint256 totalAmount, uint256 durationSeconds) external',
  'function availableToClaim(bytes32 streamId) external view returns (uint256)',
  'function withdrawFromStream(bytes32 streamId) external returns (uint256)',
  'function cancelStream(bytes32 streamId) external returns (uint256, uint256)',
  'function getStreamSummary(bytes32 streamId) external view returns (address employer, address employee, address token, uint256 ratePerSecond, uint256 remainingBalance, uint256 claimableNow, bool isActive)',
  'event StreamWithdrawn(bytes32 indexed streamId, address indexed employee, uint256 amount, uint256 remainingBalance)',
];

export const VAULT_ABI = [
  'function deposit(address token, uint256 amount) external',
  'function withdraw(address token, uint256 amount, address recipient) external',
  'function configureAutoForward(address recipient, uint256 bps) external',
  'function getBalance(address token) external view returns (uint256)',
  'function merchantOwner() external view returns (address)',
  'function autoForwardRecipient() external view returns (address)',
  'function autoForwardBps() external view returns (uint256)',
  'event DepositReceived(address indexed token, address indexed from, uint256 amount)',
  'event FundsWithdrawn(address indexed token, address indexed to, uint256 amount)',
  'event SplitForwardConfigured(address indexed recipient, uint256 bps)',
];
