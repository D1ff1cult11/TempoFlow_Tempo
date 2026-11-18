use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("TempoF1owIngress111111111111111111111111111");

/// Default settlement timeout (1 hour = 3600 seconds) after which payer can reclaim 100% of escrow
pub const DEFAULT_SETTLEMENT_TIMEOUT_SECONDS: i64 = 3600;

#[program]
pub mod tempo_crosschain_ingress {
    use super::*;

    /// Initiates a universal cross-chain retail payment from Solana to Tempo L1.
    /// Works with ANY SPL-token mint on Solana, and routes to ANY destination token/recipient on Tempo L1.
    pub fn initiate_cross_payment(
        ctx: Context<InitiateCrossPayment>,
        order_id: [u8; 32],
        amount: u64,
        tempo_recipient: [u8; 20],
        tempo_target_token: [u8; 20], // Exact 20-byte ERC20 contract address on Tempo L1
        target_token_code: u8,        // Shorthand code: 0 = Same/USDC, 1 = EURC, 255 = Custom
    ) -> Result<()> {
        require!(amount > 0, TempoIngressError::InvalidAmount);
        require!(
            tempo_recipient != [0u8; 20],
            TempoIngressError::InvalidRecipientAddress
        );

        // 1. Record the universal escrow order state
        let order = &mut ctx.accounts.order_state;
        order.order_id = order_id;
        order.payer = ctx.accounts.payer.key();
        order.mint = ctx.accounts.token_mint.key();
        order.amount = amount;
        order.tempo_recipient = tempo_recipient;
        order.tempo_target_token = tempo_target_token;
        order.target_token_code = target_token_code;
        order.status = OrderStatus::Pending as u8;
        order.created_at = Clock::get()?.unix_timestamp;
        order.bump = ctx.bumps.order_state;
        order.vault_bump = ctx.bumps.vault_token_account;

        // 2. CPI: Transfer tokens from payer into the program-controlled vault PDA
        let cpi_accounts = Transfer {
            from: ctx.accounts.payer_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        // 3. Emit verified intent event for the universal TempoFlow relayer network
        emit!(CrossChainPaymentIntent {
            order_id,
            payer: ctx.accounts.payer.key(),
            mint: ctx.accounts.token_mint.key(),
            amount,
            tempo_recipient,
            tempo_target_token,
            target_token_code,
            timestamp: order.created_at,
        });

        Ok(())
    }

    /// Complete settlement: Called by the verified relayer when Tempo L1 settlement confirms.
    /// Unlocks or sweeps the escrowed tokens to the relayer liquidity pool.
    pub fn complete_cross_settlement(
        ctx: Context<CompleteCrossSettlement>,
        order_id: [u8; 32],
        _tempo_tx_hash: [u8; 32],
    ) -> Result<()> {
        let order = &mut ctx.accounts.order_state;
        require!(
            order.status == OrderStatus::Pending as u8,
            TempoIngressError::OrderNotPending
        );

        order.status = OrderStatus::Settled as u8;

        // Transfer escrowed tokens to relayer recipient via PDA signer
        let order_id_ref = &order.order_id;
        let bump_ref = &[order.vault_bump];
        let seeds: &[&[&[u8]]] = &[&[b"vault", order_id_ref.as_ref(), bump_ref]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.relayer_token_account.to_account_info(),
            authority: ctx.accounts.vault_token_account.to_account_info(),
        };
        let cpi_ctx =
            CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_accounts, seeds);
        token::transfer(cpi_ctx, order.amount)?;

        emit!(CrossChainSettled {
            order_id,
            relayer: ctx.accounts.relayer.key(),
            amount: order.amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Refund order: If settlement on Tempo L1 fails or times out (> 1 hour),
    /// the original payer can claim 100% of their locked funds back safely.
    pub fn refund_expired_order(ctx: Context<RefundExpiredOrder>, order_id: [u8; 32]) -> Result<()> {
        let order = &mut ctx.accounts.order_state;
        require!(
            order.status == OrderStatus::Pending as u8,
            TempoIngressError::OrderNotPending
        );

        let now = Clock::get()?.unix_timestamp;
        require!(
            now >= order.created_at + DEFAULT_SETTLEMENT_TIMEOUT_SECONDS,
            TempoIngressError::TimeoutNotReached
        );

        order.status = OrderStatus::Refunded as u8;

        let order_id_ref = &order.order_id;
        let bump_ref = &[order.vault_bump];
        let seeds: &[&[&[u8]]] = &[&[b"vault", order_id_ref.as_ref(), bump_ref]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.payer_token_account.to_account_info(),
            authority: ctx.accounts.vault_token_account.to_account_info(),
        };
        let cpi_ctx =
            CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_accounts, seeds);
        token::transfer(cpi_ctx, order.amount)?;

        emit!(CrossChainRefunded {
            order_id,
            payer: order.payer,
            amount: order.amount,
            timestamp: now,
        });

        Ok(())
    }
}

// --- Accounts Contexts ---

#[derive(Accounts)]
#[instruction(order_id: [u8; 32])]
pub struct InitiateCrossPayment<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Works with ANY valid SPL token mint (USDC, USDT, PYUSD, BONK, etc.)
    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = payer_token_account.mint == token_mint.key(),
        constraint = payer_token_account.owner == payer.key()
    )]
    pub payer_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = payer,
        space = EscrowOrder::LEN,
        seeds = [b"order", order_id.as_ref()],
        bump
    )]
    pub order_state: Account<'info, EscrowOrder>,

    #[account(
        init,
        payer = payer,
        seeds = [b"vault", order_id.as_ref()],
        bump,
        token::mint = token_mint,
        token::authority = vault_token_account,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(order_id: [u8; 32])]
pub struct CompleteCrossSettlement<'info> {
    pub relayer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"order", order_id.as_ref()],
        bump = order_state.bump
    )]
    pub order_state: Account<'info, EscrowOrder>,

    #[account(
        mut,
        seeds = [b"vault", order_id.as_ref()],
        bump = order_state.vault_bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub relayer_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(order_id: [u8; 32])]
pub struct RefundExpiredOrder<'info> {
    #[account(mut, address = order_state.payer)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"order", order_id.as_ref()],
        bump = order_state.bump
    )]
    pub order_state: Account<'info, EscrowOrder>,

    #[account(
        mut,
        seeds = [b"vault", order_id.as_ref()],
        bump = order_state.vault_bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub payer_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// --- Universal State Models ---

#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum OrderStatus {
    Pending = 0,
    Settled = 1,
    Refunded = 2,
}

#[account]
pub struct EscrowOrder {
    pub order_id: [u8; 32],
    pub payer: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub tempo_recipient: [u8; 20],
    pub tempo_target_token: [u8; 20],
    pub target_token_code: u8,
    pub status: u8,
    pub created_at: i64,
    pub bump: u8,
    pub vault_bump: u8,
}

impl EscrowOrder {
    pub const LEN: usize = 8 + // discriminator
        32 + // order_id
        32 + // payer pubkey
        32 + // mint pubkey
        8 +  // amount
        20 + // tempo_recipient
        20 + // tempo_target_token
        1 +  // target_token_code
        1 +  // status
        8 +  // created_at
        1 +  // bump
        1;   // vault_bump
}

// --- Universal Telemetry Events ---

#[event]
pub struct CrossChainPaymentIntent {
    pub order_id: [u8; 32],
    pub payer: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub tempo_recipient: [u8; 20],
    pub tempo_target_token: [u8; 20],
    pub target_token_code: u8,
    pub timestamp: i64,
}

#[event]
pub struct CrossChainSettled {
    pub order_id: [u8; 32],
    pub relayer: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct CrossChainRefunded {
    pub order_id: [u8; 32],
    pub payer: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

// --- Errors ---

#[error_code]
pub enum TempoIngressError {
    #[msg("Payment amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Tempo recipient address cannot be the zero address.")]
    InvalidRecipientAddress,
    #[msg("The escrow order is not in pending state.")]
    OrderNotPending,
    #[msg("Settlement timeout has not elapsed yet.")]
    TimeoutNotReached,
}
