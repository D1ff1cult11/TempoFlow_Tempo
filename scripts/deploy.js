const { ethers, network } = require("hardhat");

async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  console.log(`🚀 Deploying TempoFlow to network '${network.name}' (chainId ${chainId})...`);

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer Account: ${deployer.address}`);

  // 1. Deploy Mock Stablecoins (USDC and EURC with 6 decimals)
  console.log("\n1. Deploying Stablecoins (6 Decimals)...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log(`✅ USDC Deployed: ${usdcAddress}`);

  const eurc = await MockERC20.deploy("Euro Coin", "EURC", 6);
  await eurc.waitForDeployment();
  const eurcAddress = await eurc.getAddress();
  console.log(`✅ EURC Deployed: ${eurcAddress}`);

  // 2. Deploy Enshrined AMM Simulation Precompile
  console.log("\n2. Deploying Enshrined AMM Precompile Simulation...");
  const MockEnshrinedAMM = await ethers.getContractFactory("MockEnshrinedAMM");
  const amm = await MockEnshrinedAMM.deploy();
  await amm.waitForDeployment();
  const ammAddress = await amm.getAddress();
  console.log(`✅ Enshrined AMM Deployed: ${ammAddress}`);

  // Set exchange rate: 1 USDC = 0.92 EURC
  const fxRate = ethers.parseEther("0.92");
  await amm.setExchangeRate(usdcAddress, eurcAddress, fxRate);
  console.log(`   Configured FX Rate: 1 USDC = 0.92 EURC`);

  // Seed initial liquidity
  const seedAmount = ethers.parseUnits("1000000", 6);
  await usdc.mint(ammAddress, seedAmount);
  await eurc.mint(ammAddress, seedAmount);
  console.log(`   Seeded 1,000,000 USDC & 1,000,000 EURC reserve liquidity`);

  // 3. Deploy TempoFlowRouter
  console.log("\n3. Deploying TempoFlowRouter...");
  const treasuryAddress = deployer.address;
  const TempoFlowRouter = await ethers.getContractFactory("TempoFlowRouter");
  const router = await TempoFlowRouter.deploy(ammAddress, treasuryAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log(`✅ TempoFlowRouter Deployed: ${routerAddress}`);
  console.log(`   Protocol Treasury: ${treasuryAddress} (10 bps fee)`);

  // 4. Deploy TempoPayrollStream
  console.log("\n4. Deploying TempoPayrollStream Engine...");
  const TempoPayrollStream = await ethers.getContractFactory("TempoPayrollStream");
  const payroll = await TempoPayrollStream.deploy();
  await payroll.waitForDeployment();
  const payrollAddress = await payroll.getAddress();
  console.log(`✅ TempoPayrollStream Deployed: ${payrollAddress}`);

  // Summary Deployment Output for Frontend Integration
  console.log("\n==================================================");
  console.log("🎉 DEPLOYMENT SUMMARY FOR FRONTEND CONFIG (Phase 3)");
  console.log("==================================================");
  const deploymentInfo = {
    network: network.name,
    chainId: Number(chainId),
    contracts: {
      USDC: usdcAddress,
      EURC: eurcAddress,
      EnshrinedAMM: ammAddress,
      TempoFlowRouter: routerAddress,
      TempoPayrollStream: payrollAddress,
    },
    treasury: treasuryAddress,
    deployedAt: new Date().toISOString(),
  };

  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Save deployment addresses to json for frontend import
  const fs = require("fs");
  const path = require("path");
  const deployDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deployDir)) {
    fs.mkdirSync(deployDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(deployDir, `${network.name}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`\nDeployment artifact written to: deployments/${network.name}.json`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
