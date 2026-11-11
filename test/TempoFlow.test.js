const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("⚡ TempoFlow Protocol Master Test Suite", function () {
  let owner, treasury, merchant, employee, customer, stranger;
  let usdc, eurc, amm, router, payroll, vault;

  // 6 decimals standard for stablecoins on Tempo L1
  const DECIMALS = 6;
  const parseStable = (amount) => ethers.parseUnits(amount.toString(), DECIMALS);
  const formatStable = (amount) => ethers.formatUnits(amount, DECIMALS);

  beforeEach(async function () {
    [owner, treasury, merchant, employee, customer, stranger] = await ethers.getSigners();

    // 1. Deploy Mock Stablecoins (USDC and EURC)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    usdc = await MockERC20.deploy("USD Coin", "USDC", DECIMALS);
    eurc = await MockERC20.deploy("Euro Coin", "EURC", DECIMALS);

    // 2. Deploy Mock Enshrined AMM Precompile
    const MockEnshrinedAMM = await ethers.getContractFactory("MockEnshrinedAMM");
    amm = await MockEnshrinedAMM.deploy();

    // Set FX Rate: 1 USDC = 0.92 EURC (scaled by 1e18)
    const fxRate = ethers.parseEther("0.92");
    await amm.setExchangeRate(await usdc.getAddress(), await eurc.getAddress(), fxRate);

    // Provide initial liquidity to Enshrined AMM
    await eurc.mint(await amm.getAddress(), parseStable(1000000));
    await usdc.mint(await amm.getAddress(), parseStable(1000000));

    // 3. Deploy TempoFlowRouter
    const TempoFlowRouter = await ethers.getContractFactory("TempoFlowRouter");
    router = await TempoFlowRouter.deploy(await amm.getAddress(), treasury.address);

    // 4. Deploy TempoPayrollStream
    const TempoPayrollStream = await ethers.getContractFactory("TempoPayrollStream");
    payroll = await TempoPayrollStream.deploy();

    // 5. Deploy MerchantSettlementVault
    const MerchantSettlementVault = await ethers.getContractFactory("MerchantSettlementVault");
    vault = await MerchantSettlementVault.deploy(merchant.address);

    // Mint tokens to customer and owner (for payroll)
    await usdc.mint(customer.address, parseStable(10000));
    await eurc.mint(customer.address, parseStable(10000));
    await usdc.mint(owner.address, parseStable(50000));

    // Approvals
    await usdc.connect(customer).approve(await router.getAddress(), ethers.MaxUint256);
    await eurc.connect(customer).approve(await router.getAddress(), ethers.MaxUint256);
    await usdc.connect(owner).approve(await payroll.getAddress(), ethers.MaxUint256);
  });

  describe("1. Merchant Settlement & FX Engine (TempoFlowRouter)", function () {
    it("TC-01: Instant Payment in Same Currency (USDC -> USDC minus 10 bps fee)", async function () {
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("ORDER-001"));
      const payAmount = parseStable(100); // $100 USDC

      const merchantPre = await usdc.balanceOf(merchant.address);
      const treasuryPre = await usdc.balanceOf(treasury.address);

      // 10 bps on 100 USDC = 0.10 USDC fee -> 99.90 USDC net to merchant
      const tx = await router.connect(customer).executePayment(
        orderId,
        merchant.address,
        await usdc.getAddress(),
        await usdc.getAddress(),
        payAmount,
        parseStable(99.9)
      );

      await expect(tx)
        .to.emit(router, "PaymentSettled")
        .withArgs(
          orderId,
          customer.address,
          merchant.address,
          await usdc.getAddress(),
          await usdc.getAddress(),
          payAmount,
          parseStable(99.9),
          await ethers.provider.getBlock("latest").then(b => b.timestamp)
        );

      const merchantPost = await usdc.balanceOf(merchant.address);
      const treasuryPost = await usdc.balanceOf(treasury.address);

      expect(merchantPost - merchantPre).to.equal(parseStable(99.9));
      expect(treasuryPost - treasuryPre).to.equal(parseStable(0.1));
    });

    it("TC-02: Instant Payment with Enshrined AMM FX Conversion (USDC -> EURC)", async function () {
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("ORDER-002-FX"));
      const payAmount = parseStable(100); // 100 USDC

      // Net 99.90 USDC converted at 0.92 rate = 91.908 EURC
      const expectedEurc = parseStable(91.908);

      const merchantEurcPre = await eurc.balanceOf(merchant.address);

      await router.connect(customer).executePayment(
        orderId,
        merchant.address,
        await usdc.getAddress(),
        await eurc.getAddress(),
        payAmount,
        expectedEurc
      );

      const merchantEurcPost = await eurc.balanceOf(merchant.address);
      expect(merchantEurcPost - merchantEurcPre).to.equal(expectedEurc);
    });

    it("TC-03: Order Replay Protection Prevents Double Spending", async function () {
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("ORDER-REPLAY-ATTACK"));
      const payAmount = parseStable(50);

      // First execution succeeds
      await router.connect(customer).executePayment(
        orderId,
        merchant.address,
        await usdc.getAddress(),
        await usdc.getAddress(),
        payAmount,
        parseStable(49)
      );

      // Replay must revert
      await expect(
        router.connect(customer).executePayment(
          orderId,
          merchant.address,
          await usdc.getAddress(),
          await usdc.getAddress(),
          payAmount,
          parseStable(49)
        )
      ).to.be.revertedWith("Order already executed");
    });

    it("TC-08: Split Payment Routing (80% Merchant, 20% Tax / Affiliate)", async function () {
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("ORDER-SPLIT-001"));
      const payAmount = parseStable(100); // 100 USDC -> 99.90 net
      const splitRecipient = stranger.address;
      const splitBps = 2000; // 20%

      // Net = 99.90 USDC. 20% to stranger = 19.98 USDC. 80% to merchant = 79.92 USDC.
      await router.connect(customer).executeSplitPayment(
        orderId,
        merchant.address,
        splitRecipient,
        splitBps,
        await usdc.getAddress(),
        await usdc.getAddress(),
        payAmount,
        parseStable(99.9)
      );

      expect(await usdc.balanceOf(splitRecipient)).to.equal(parseStable(19.98));
      expect(await usdc.balanceOf(merchant.address)).to.equal(parseStable(79.92));
    });
  });

  describe("2. Continuous Payroll Streaming Engine (TempoPayrollStream)", function () {
    const streamId = ethers.keccak256(ethers.toUtf8Bytes("STREAM-PAYROLL-001"));
    const duration = 3600; // 1 hour (3600 seconds)
    const depositAmount = parseStable(3600); // 3600 USDC = 1.00 USDC / second

    beforeEach(async function () {
      await payroll.connect(owner).createStream(
        streamId,
        employee.address,
        await usdc.getAddress(),
        depositAmount,
        duration
      );
    });

    it("TC-04: Continuous By-The-Second Payroll Accrual with Time Travel", async function () {
      // Advance time by 1800 seconds (30 minutes)
      await ethers.provider.send("evm_increaseTime", [1800]);
      await ethers.provider.send("evm_mine");

      const claimable = await payroll.availableToClaim(streamId);
      // Expected ~1800 USDC (accounting for the mined block)
      expect(Number(formatStable(claimable))).to.be.closeTo(1800, 2);

      const empPre = await usdc.balanceOf(employee.address);
      await payroll.connect(employee).withdrawFromStream(streamId);
      const empPost = await usdc.balanceOf(employee.address);

      expect(Number(formatStable(empPost - empPre))).to.be.closeTo(1800, 2);
    });

    it("TC-05: Premature Cancellation & Exact Escrow Reconciliation", async function () {
      // Advance time by 900 seconds (15 minutes = 25% of duration)
      await ethers.provider.send("evm_increaseTime", [900]);
      await ethers.provider.send("evm_mine");

      const empPre = await usdc.balanceOf(employee.address);
      const ownerPre = await usdc.balanceOf(owner.address);

      // Cancel stream
      await payroll.connect(owner).cancelStream(streamId);

      const empPost = await usdc.balanceOf(employee.address);
      const ownerPost = await usdc.balanceOf(owner.address);

      const empReceived = Number(formatStable(empPost - empPre));
      const ownerRefunded = Number(formatStable(ownerPost - ownerPre));

      // Employee should receive ~900 USDC (25%), Owner refunded ~2700 USDC (75%)
      expect(empReceived).to.be.closeTo(900, 2);
      expect(ownerRefunded).to.be.closeTo(2700, 2);
      expect(empReceived + ownerRefunded).to.equal(3600);

      // Stream should no longer be active
      const s = await payroll.getStream(streamId);
      expect(s.isActive).to.be.false;
      expect(s.remainingBalance).to.equal(0);
    });

    it("TC-06: Security Check - Unauthorized Stream Withdrawal Reverts", async function () {
      await ethers.provider.send("evm_increaseTime", [500]);
      await ethers.provider.send("evm_mine");

      // Stranger tries to withdraw from employee's stream
      await expect(
        payroll.connect(stranger).withdrawFromStream(streamId)
      ).to.be.revertedWith("Only employee");
    });
  });

  describe("3. Non-Custodial Merchant Settlement Vault (MerchantSettlementVault)", function () {
    it("TC-07: Vault Multi-Token Deposit, Auto-Forwarding and Non-Custodial Withdrawal", async function () {
      // Configure auto-forward: 20% to employee payroll reserve
      await vault.connect(merchant).configureAutoForward(employee.address, 2000);

      // Deposit 1,000 USDC into vault from customer
      await usdc.connect(customer).transfer(await vault.getAddress(), parseStable(0)); // check approval
      await usdc.connect(customer).approve(await vault.getAddress(), parseStable(1000));
      await vault.connect(customer).deposit(await usdc.getAddress(), parseStable(1000));

      // 20% (200 USDC) forwarded to employee, 80% (800 USDC) retained in vault
      expect(await usdc.balanceOf(employee.address)).to.equal(parseStable(200));
      expect(await vault.getBalance(await usdc.getAddress())).to.equal(parseStable(800));

      // Merchant withdraws the remaining 800 USDC to their cold wallet
      await vault.connect(merchant).withdraw(await usdc.getAddress(), parseStable(800), merchant.address);
      expect(await vault.getBalance(await usdc.getAddress())).to.equal(0);
    });
  });

  describe("4. Security Guards, Emergency Circuit Breaker & Living Odometer", function () {
    it("TC-09: Emergency Pause Blocks Payments & Non-Owner Cannot Pause", async function () {
      const orderId = ethers.keccak256(ethers.toUtf8Bytes("ORDER-PAUSE-TEST"));

      // Stranger cannot pause
      await expect(router.connect(stranger).pause()).to.be.revertedWith("Only owner");

      // Owner pauses
      await router.connect(owner).pause();
      expect(await router.paused()).to.be.true;

      // Payment attempt must revert
      await expect(
        router.connect(customer).executePayment(
          orderId,
          merchant.address,
          await usdc.getAddress(),
          await usdc.getAddress(),
          parseStable(50),
          parseStable(49)
        )
      ).to.be.revertedWith("Contract is paused");

      // Owner unpauses
      await router.connect(owner).unpause();
      expect(await router.paused()).to.be.false;

      // Payment now succeeds
      await router.connect(customer).executePayment(
        orderId,
        merchant.address,
        await usdc.getAddress(),
        await usdc.getAddress(),
        parseStable(50),
        parseStable(49)
      );
      expect(await router.isOrderExecuted(orderId)).to.be.true;
    });

    it("TC-10: Stream Summary & Living Odometer State Verification", async function () {
      const streamId = ethers.keccak256(ethers.toUtf8Bytes("STREAM-ODOMETER-001"));
      await payroll.connect(owner).createStream(
        streamId,
        employee.address,
        await usdc.getAddress(),
        parseStable(7200),
        7200 // 2 hours = 1 USDC / sec
      );

      const summary = await payroll.getStreamSummary(streamId);
      expect(summary.employer).to.equal(owner.address);
      expect(summary.employee).to.equal(employee.address);
      expect(summary.ratePerSecond).to.equal(parseStable(1));
      expect(summary.remainingBalance).to.equal(parseStable(7200));
      expect(summary.isActive).to.be.true;

      // Time travel 60 seconds
      await ethers.provider.send("evm_increaseTime", [60]);
      await ethers.provider.send("evm_mine");

      const claimable = await payroll.getClaimableBalance(streamId);
      expect(Number(formatStable(claimable))).to.be.closeTo(60, 2);
    });
  });
});
