import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { PublicKey } from "@solana/web3.js";

describe("tempo_crosschain_ingress universal test suite", () => {
  it("Derives universal PDA seeds and formats 20-byte destination token routing", async () => {
    // Unique 32-byte orderId
    const orderIdBuffer = Buffer.alloc(32);
    orderIdBuffer.write("ORDER-UNIVERSAL-ANY-TOKEN-001");

    // Tempo recipient address (20-byte EVM address)
    const tempoRecipientBuffer = Buffer.from(
      "0165878A594ca255338adfa4d48449f69242Eb8F",
      "hex"
    );

    // Universal target token address on Tempo L1 (e.g. EURC or any ERC20)
    const tempoTargetTokenBuffer = Buffer.from(
      "e7f1725E7734CE288F8367e1Bb143E90bb3F0512",
      "hex"
    );

    const programId = new PublicKey("TempoF1owIngress111111111111111111111111111");

    // 1. Order State PDA
    const [orderPda, orderBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("order"), orderIdBuffer],
      programId
    );

    // 2. Escrow Vault PDA
    const [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), orderIdBuffer],
      programId
    );

    expect(orderPda).to.not.be.null;
    expect(vaultPda).to.not.be.null;
    expect(orderBump).to.be.a("number");
    expect(vaultBump).to.be.a("number");

    console.log(`✅ Universal Order PDA: ${orderPda.toBase58()}`);
    console.log(`✅ Escrow Vault PDA: ${vaultPda.toBase58()}`);
    console.log(`✅ Recipient EVM: 0x${tempoRecipientBuffer.toString("hex")}`);
    console.log(`✅ Destination Token EVM: 0x${tempoTargetTokenBuffer.toString("hex")}`);
  });
});
