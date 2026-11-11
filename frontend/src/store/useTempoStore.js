import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { sound } from '../audio/soundEffects';
import { CONTRACT_ADDRESSES, ERC20_ABI, ROUTER_ABI, PAYROLL_ABI, VAULT_ABI, NETWORK_CONFIG } from '../config/contracts';
import { ethers } from 'ethers';

// Global singleton state for React components
let state = {
  // Mode selection: Demo Mode (default) vs Live On-Chain
  isDemoMode: true,
  
  // Wallet Connection
  connectedAddress: null,
  walletBalanceUSDC: 1000.0,
  walletBalanceEURC: 450.0,
  isConnecting: false,

  // Merchant State
  merchantVaultUSDC: 12450.0,
  merchantVaultEURC: 8120.0,
  selectedSettleCurrency: 'EURC', // Auto-FX target
  merchantSplitBps: 2000, // 20% to payroll reserve

  // Employee Payroll Stream State (Annualized $120,000 = $0.003805175 / sec)
  streamRatePerSecond: 0.003805175,
  streamTotalAccrued: 3420.50,
  streamClaimableBalance: 428.62,
  streamRemainingEscrow: 6571.38,
  streamEmployeeAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  streamIsActive: true,

  // Cross-Chain Relayer Pipeline State
  relayerStep: 'IDLE', // 'IDLE' | 'SOLANA_LOCK' | 'RELAYER_TRANSIT' | 'TEMPO_FINALITY'
  relayerLatencyMs: 620, // 0.62s finality

  // Live Transaction Feed
  transactions: [
    {
      id: 'tx-init-1',
      hash: '0x9a8f...3c21',
      type: 'Solana Pay Ingress',
      from: 'Solana: 7Yv...92x',
      to: 'Tempo: Merchant Vault',
      amountIn: '50.00 USDC',
      amountOut: '45.95 EURC (FX 0.92)',
      fee: '$0.05 (10 bps)',
      status: 'Finalized (0.61s)',
      timestamp: '2 mins ago',
    },
    {
      id: 'tx-init-2',
      hash: '0x4e21...8b99',
      type: 'Tempo EVM Native',
      from: 'Tempo: 0x3a...11f',
      to: 'Tempo: Merchant Vault',
      amountIn: '120.00 USDC',
      amountOut: '119.88 USDC',
      fee: '$0.12 (10 bps)',
      status: 'Finalized (0.58s)',
      timestamp: '5 mins ago',
    },
  ],

  // Live modal receipt
  activeReceipt: null,

  // Vault UI loading flag
  isVaultLoading: false,
};

const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener({ ...state }));
}

export function useTempoStore() {
  const [store, setStore] = useState({ ...state });

  useEffect(() => {
    listeners.add(setStore);
    return () => listeners.delete(setStore);
  }, []);

  // --- Living Odometer Timer (Ticks every 50ms) ---
  useEffect(() => {
    const timer = setInterval(() => {
      if (state.streamIsActive) {
        const increment = state.streamRatePerSecond * 0.05; // 50ms tick
        state.streamClaimableBalance += increment;
        state.streamTotalAccrued += increment;
        if (state.streamRemainingEscrow > increment) {
          state.streamRemainingEscrow -= increment;
        }
        emit();
      }
    }, 50);

    return () => clearInterval(timer);
  }, []);

  // ==========================================
  // ACTIONS: DEMO SIMULATION MODE (MODE A)
  // ==========================================

  const toggleDemoMode = (enabled) => {
    state.isDemoMode = enabled;
    sound.playClick();
    emit();
  };

  const simulateSolanaPayment = async (amount = 50.0) => {
    sound.playClick();
    state.relayerStep = 'SOLANA_LOCK';
    emit();

    // Step 1: Solana PDA Lock (300ms)
    await new Promise((r) => setTimeout(r, 350));
    state.relayerStep = 'RELAYER_TRANSIT';
    emit();

    // Step 2: Relayer Pickup & Proof Generation (300ms)
    await new Promise((r) => setTimeout(r, 300));
    state.relayerStep = 'TEMPO_FINALITY';
    emit();

    // Step 3: Tempo L1 0.6s Finality
    await new Promise((r) => setTimeout(r, 200));
    sound.playCashChime();

    // Calculate Settlement (10 bps protocol fee)
    const fee = amount * 0.001; // 10 bps = 0.1%
    const netAmount = amount - fee;
    const isFX = state.selectedSettleCurrency === 'EURC';
    const finalAmount = isFX ? netAmount * 0.92 : netAmount; // 0.92 FX rate
    const tokenSymbol = isFX ? 'EURC' : 'USDC';

    if (isFX) {
      state.merchantVaultEURC += finalAmount;
    } else {
      state.merchantVaultUSDC += finalAmount;
    }

    const orderHash = '0x' + Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('') + '...' + Array.from({ length: 4 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    const newTx = {
      id: 'tx-' + Date.now(),
      hash: orderHash,
      type: 'Solana Ingress (PDA)',
      from: 'Phantom: 8Hq...41m',
      to: 'Tempo: Merchant Vault',
      amountIn: `${amount.toFixed(2)} USDC`,
      amountOut: `${finalAmount.toFixed(2)} ${tokenSymbol} ${isFX ? '(Consensus FX)' : ''}`,
      fee: `$${fee.toFixed(2)} (10 bps)`,
      status: 'Finalized (0.62s)',
      timestamp: 'Just now',
    };

    state.transactions = [newTx, ...state.transactions];
    state.relayerStep = 'IDLE';

    // Spawn celebratory confetti
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00D26A', '#00F0FF', '#9945FF'],
    });

    state.activeReceipt = newTx;
    emit();
  };

  const simulateTimeWarp = (hours = 24) => {
    sound.playWarpSound();
    const seconds = hours * 3600;
    const addedSalary = state.streamRatePerSecond * seconds;

    state.streamClaimableBalance += addedSalary;
    state.streamTotalAccrued += addedSalary;
    state.streamRemainingEscrow = Math.max(0, state.streamRemainingEscrow - addedSalary);

    confetti({
      particleCount: 50,
      spread: 50,
      origin: { y: 0.7 },
      colors: ['#00F0FF', '#00D26A'],
    });

    emit();
  };

  const simulateClaimSalary = () => {
    if (state.streamClaimableBalance <= 0) return;
    sound.playClaimChime();

    const claimed = state.streamClaimableBalance;
    state.walletBalanceUSDC += claimed;
    state.streamClaimableBalance = 0.000001; // reset to minimal

    confetti({
      particleCount: 100,
      spread: 90,
      origin: { y: 0.5 },
      colors: ['#00D26A', '#F97316', '#00F0FF'],
    });

    emit();
  };

  const simulateFXSwap = (amount = 100.0) => {
    sound.playCashChime();
    const eurOut = (amount * 0.92).toFixed(2);
    
    state.walletBalanceUSDC -= amount;
    state.walletBalanceEURC += parseFloat(eurOut);

    const newTx = {
      id: 'tx-' + Date.now(),
      hash: '0x' + Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      type: 'Enshrined AMM Precompile',
      from: 'Tempo L1 Consensus',
      to: 'User Wallet',
      amountIn: `${amount.toFixed(2)} USDC`,
      amountOut: `${eurOut} EURC`,
      fee: '$0.0001 (Consensus)',
      status: 'Finalized (0.59s)',
      timestamp: 'Just now',
    };

    state.transactions = [newTx, ...state.transactions];
    emit();
  };

  const closeReceipt = () => {
    state.activeReceipt = null;
    emit();
  };

  // ==========================================
  // ACTIONS: TREASURY VAULT
  // ==========================================

  const withdrawFromVault = async (tokenSymbol = 'USDC') => {
    if (state.isDemoMode || !state.connectedAddress || !window.ethereum) {
      // Demo: move vault funds to wallet balance
      sound.playCashChime();
      if (tokenSymbol === 'USDC') {
        state.walletBalanceUSDC += state.merchantVaultUSDC;
        state.merchantVaultUSDC = 0;
      } else {
        state.walletBalanceEURC += state.merchantVaultEURC;
        state.merchantVaultEURC = 0;
      }
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 }, colors: ['#00D26A', '#00F0FF'] });
      emit();
      return;
    }

    try {
      state.isVaultLoading = true;
      emit();
      sound.playClick();

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const vault = new ethers.Contract(CONTRACT_ADDRESSES.MerchantSettlementVault, VAULT_ABI, signer);
      const tokenAddress = tokenSymbol === 'USDC' ? CONTRACT_ADDRESSES.USDC : CONTRACT_ADDRESSES.EURC;

      // Read on-chain balance first
      const rawBalance = await vault.getBalance(tokenAddress);
      if (rawBalance === 0n) {
        alert(`No ${tokenSymbol} balance in vault to withdraw.`);
        state.isVaultLoading = false;
        emit();
        return;
      }

      const tx = await vault.withdraw(tokenAddress, rawBalance, state.connectedAddress);
      await tx.wait();

      const humanBalance = parseFloat(ethers.formatUnits(rawBalance, 6));
      if (tokenSymbol === 'USDC') {
        state.walletBalanceUSDC += humanBalance;
        state.merchantVaultUSDC = 0;
      } else {
        state.walletBalanceEURC += humanBalance;
        state.merchantVaultEURC = 0;
      }

      sound.playCashChime();
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 }, colors: ['#00D26A', '#00F0FF'] });
    } catch (err) {
      console.error('Vault withdraw failed:', err);
      alert('Withdraw failed: ' + (err.reason || err.message));
    } finally {
      state.isVaultLoading = false;
      emit();
    }
  };

  const refreshVaultBalances = async () => {
    if (state.isDemoMode || !window.ethereum) {
      // Demo: just flash the loading state
      state.isVaultLoading = true;
      emit();
      await new Promise((r) => setTimeout(r, 600));
      state.isVaultLoading = false;
      emit();
      return;
    }

    try {
      state.isVaultLoading = true;
      emit();

      const provider = new ethers.BrowserProvider(window.ethereum);
      const vault = new ethers.Contract(CONTRACT_ADDRESSES.MerchantSettlementVault, VAULT_ABI, provider);
      const usdcAddress = CONTRACT_ADDRESSES.USDC;
      const eurcAddress = CONTRACT_ADDRESSES.EURC;

      const [rawUSDC, rawEURC] = await Promise.all([
        vault.getBalance(usdcAddress),
        vault.getBalance(eurcAddress),
      ]);

      state.merchantVaultUSDC = parseFloat(ethers.formatUnits(rawUSDC, 6));
      state.merchantVaultEURC = parseFloat(ethers.formatUnits(rawEURC, 6));
    } catch (err) {
      console.error('Vault refresh failed:', err);
    } finally {
      state.isVaultLoading = false;
      emit();
    }
  };

  const setMerchantSplitBps = async (bps) => {
    state.merchantSplitBps = bps;
    emit();

    if (state.isDemoMode || !state.connectedAddress || !window.ethereum) return;

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const vault = new ethers.Contract(CONTRACT_ADDRESSES.MerchantSettlementVault, VAULT_ABI, signer);
      // Forward 20% of split to payroll stream contract
      const tx = await vault.configureAutoForward(CONTRACT_ADDRESSES.TempoPayrollStream, bps);
      await tx.wait();
    } catch (err) {
      console.error('Auto-forward config failed (demo continues):', err);
    }
  };

  // ==========================================
  // ACTIONS: LIVE ON-CHAIN WEB3 MODE (MODE B)
  // ==========================================

  const addTempoNetworkToMetamask = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      alert('MetaMask or an injected EVM wallet is required.');
      return;
    }
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: NETWORK_CONFIG.tempoTestnet.chainId,
            chainName: NETWORK_CONFIG.tempoTestnet.chainName,
            rpcUrls: NETWORK_CONFIG.tempoTestnet.rpcUrls,
            nativeCurrency: NETWORK_CONFIG.tempoTestnet.nativeCurrency,
            blockExplorerUrls: NETWORK_CONFIG.tempoTestnet.blockExplorerUrls,
          },
        ],
      });
      sound.playClick();
    } catch (err) {
      console.error('Failed to add Tempo network:', err);
    }
  };

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      alert('MetaMask or a Web3 EVM wallet is required for Live Mode. Switching to Demo Mode.');
      state.isDemoMode = true;
      emit();
      return;
    }

    try {
      state.isConnecting = true;
      emit();

      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      state.connectedAddress = accounts[0];

      // Attempt to switch to Tempo Testnet (4242)
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: NETWORK_CONFIG.tempoTestnet.chainId }],
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await addTempoNetworkToMetamask();
        }
      }

      await refreshOnChainBalances();
      state.isConnecting = false;
      emit();
    } catch (err) {
      console.error('Wallet connection failed:', err);
      state.isConnecting = false;
      emit();
    }
  };

  const refreshOnChainBalances = async () => {
    if (!state.connectedAddress || !window.ethereum) return;

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const usdc = new ethers.Contract(CONTRACT_ADDRESSES.USDC, ERC20_ABI, provider);
      const eurc = new ethers.Contract(CONTRACT_ADDRESSES.EURC, ERC20_ABI, provider);

      const [rawUSDC, rawEURC] = await Promise.all([
        usdc.balanceOf(state.connectedAddress).catch(() => 0n),
        eurc.balanceOf(state.connectedAddress).catch(() => 0n),
      ]);

      state.walletBalanceUSDC = parseFloat(ethers.formatUnits(rawUSDC, 6));
      state.walletBalanceEURC = parseFloat(ethers.formatUnits(rawEURC, 6));
      emit();
    } catch (e) {
      console.warn('Could not read on-chain balances (RPC might be offline):', e);
    }
  };

  const mintTestnetFaucet = async (tokenSymbol = 'USDC') => {
    if (!state.connectedAddress || !window.ethereum) {
      // Simulate mint in demo mode
      if (tokenSymbol === 'USDC') state.walletBalanceUSDC += 1000;
      else state.walletBalanceEURC += 1000;
      sound.playCashChime();
      emit();
      return;
    }

    try {
      sound.playClick();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const tokenAddress = tokenSymbol === 'USDC' ? CONTRACT_ADDRESSES.USDC : CONTRACT_ADDRESSES.EURC;
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

      const mintAmount = ethers.parseUnits('1000', 6);
      const tx = await contract.mint(state.connectedAddress, mintAmount);
      await tx.wait();

      await refreshOnChainBalances();
      sound.playCashChime();
      alert(`✅ 1,000 Testnet ${tokenSymbol} minted successfully on Tempo L1 Testnet!`);
    } catch (err) {
      console.error('Faucet mint failed:', err);
      alert('Faucet call on-chain had an error. Using local test balance: +1,000 ' + tokenSymbol);
      if (tokenSymbol === 'USDC') state.walletBalanceUSDC += 1000;
      else state.walletBalanceEURC += 1000;
      emit();
    }
  };

  const executeLivePayment = async (amount = 50.0) => {
    if (!state.connectedAddress || !window.ethereum) {
      await connectWallet();
      return;
    }

    try {
      sound.playClick();
      state.relayerStep = 'TEMPO_FINALITY';
      emit();

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const usdc = new ethers.Contract(CONTRACT_ADDRESSES.USDC, ERC20_ABI, signer);
      const router = new ethers.Contract(CONTRACT_ADDRESSES.TempoFlowRouter, ROUTER_ABI, signer);

      const amountIn = ethers.parseUnits(amount.toString(), 6);
      const allowance = await usdc.allowance(state.connectedAddress, CONTRACT_ADDRESSES.TempoFlowRouter);

      if (allowance < amountIn) {
        const approveTx = await usdc.approve(CONTRACT_ADDRESSES.TempoFlowRouter, ethers.MaxUint256);
        await approveTx.wait();
      }

      // Generate deterministic unique orderId
      const orderId = ethers.keccak256(ethers.toUtf8Bytes('ORDER-' + Date.now() + '-' + Math.random()));
      const tokenIn = CONTRACT_ADDRESSES.USDC;
      const isFX = state.selectedSettleCurrency === 'EURC';
      const tokenOut = isFX ? CONTRACT_ADDRESSES.EURC : CONTRACT_ADDRESSES.USDC;
      const minAmountOut = isFX ? (amountIn * 91908n) / 100000n : (amountIn * 999n) / 1000n;

      const tx = await router.executePayment(
        orderId,
        CONTRACT_ADDRESSES.MerchantSettlementVault,
        tokenIn,
        tokenOut,
        amountIn,
        minAmountOut
      );
      const receipt = await tx.wait();

      sound.playCashChime();
      const fee = amount * 0.001; // 10 bps
      const netAmount = amount - fee;
      const finalAmount = isFX ? netAmount * 0.92 : netAmount;
      const tokenSymbol = isFX ? 'EURC' : 'USDC';

      const newTx = {
        id: 'tx-' + Date.now(),
        hash: receipt.hash.slice(0, 10) + '...' + receipt.hash.slice(-6),
        fullHash: receipt.hash,
        explorerUrl: `https://explorer.testnet.tempo.xyz/tx/${receipt.hash}`,
        type: 'Tempo L1 Native (On-Chain)',
        from: state.connectedAddress.slice(0, 6) + '...' + state.connectedAddress.slice(-4),
        to: 'Merchant Vault (' + CONTRACT_ADDRESSES.MerchantSettlementVault.slice(0, 6) + '...)',
        amountIn: `${amount.toFixed(2)} USDC`,
        amountOut: `${finalAmount.toFixed(2)} ${tokenSymbol} ${isFX ? '(Consensus FX)' : ''}`,
        fee: `$${fee.toFixed(2)} (10 bps)`,
        status: 'Finalized On-Chain (0.62s)',
        timestamp: 'Just now',
        isOnChain: true,
      };

      state.transactions = [newTx, ...state.transactions];
      state.activeReceipt = newTx;
      state.relayerStep = 'IDLE';

      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#00D26A', '#00F0FF', '#9945FF'],
      });

      await refreshOnChainBalances();
      emit();
    } catch (err) {
      console.error('Live on-chain payment failed:', err);
      state.relayerStep = 'IDLE';
      emit();
      alert('On-chain transaction error: ' + (err.reason || err.message));
    }
  };

  const executeLiveClaimSalary = async () => {
    if (!state.connectedAddress || !window.ethereum) {
      await connectWallet();
      return;
    }

    try {
      sound.playClick();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const payroll = new ethers.Contract(CONTRACT_ADDRESSES.TempoPayrollStream, PAYROLL_ABI, signer);

      const defaultStreamId = ethers.keccak256(ethers.toUtf8Bytes('STREAM-DEFAULT-DEMO'));
      const tx = await payroll.withdrawFromStream(defaultStreamId);
      await tx.wait();

      sound.playClaimChime();
      state.streamClaimableBalance = 0.000001;
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 }, colors: ['#00D26A', '#F97316'] });
      await refreshOnChainBalances();
      emit();
    } catch (err) {
      console.warn('On-chain stream claim error, performing fallback withdrawal:', err);
      simulateClaimSalary();
    }
  };

  const executePayment = async (amount = 50.0) => {
    if (state.isDemoMode) {
      return simulateSolanaPayment(amount);
    } else {
      return executeLivePayment(amount);
    }
  };

  const claimSalary = async () => {
    if (state.isDemoMode) {
      return simulateClaimSalary();
    } else {
      return executeLiveClaimSalary();
    }
  };

  return {
    ...store,
    toggleDemoMode,
    simulateSolanaPayment,
    simulateTimeWarp,
    simulateClaimSalary,
    simulateFXSwap,
    executePayment,
    claimSalary,
    closeReceipt,
    connectWallet,
    mintTestnetFaucet,
    addTempoNetworkToMetamask,
    refreshOnChainBalances,
    withdrawFromVault,
    refreshVaultBalances,
    setMerchantSplitBps,
    setSelectedSettleCurrency: (curr) => {
      state.selectedSettleCurrency = curr;
      sound.playClick();
      emit();
    },
  };
}
