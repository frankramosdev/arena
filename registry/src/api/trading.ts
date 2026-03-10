/**
 * Trading API
 * 
 * Mint, redeem, orders - all require authentication.
 */

import { Hono } from "hono";
import { registry } from "./index.js";
import { authMiddleware } from "./middleware.js";
import type { PlaceOrderInput } from "../types.js";

export const tradingApi = new Hono();

// All trading endpoints require auth
tradingApi.use("*", authMiddleware);

// =============================================================================
// TOKEN OPERATIONS
// =============================================================================

/**
 * Mint YES+NO tokens
 * POST /trade/mint
 * 
 * Deposits USD and receives equal YES + NO tokens.
 * Cost: $X → X YES + X NO
 */
tradingApi.post("/mint", async (c) => {
  const user = c.get("user");
  const body = await c.req.json() as { marketId: string; amount: number };
  
  try {
    const result = registry.mint({
      marketId: body.marketId,
      traderId: user.traderId,
      amount: body.amount,
    });
    
    // Get updated balance
    const trader = registry.getTrader(user.traderId);
    
    return c.json({
      ...result,
      balance: trader?.balance,
    }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 400);
  }
});

/**
 * Redeem YES+NO tokens for cash
 * POST /trade/redeem
 * 
 * Burns equal YES + NO tokens and returns USD.
 * Return: X YES + X NO → $X
 */
tradingApi.post("/redeem", async (c) => {
  const user = c.get("user");
  const body = await c.req.json() as { marketId: string; amount: number };
  
  try {
    const result = registry.redeem({
      marketId: body.marketId,
      traderId: user.traderId,
      amount: body.amount,
    });
    
    // Get updated balance
    const trader = registry.getTrader(user.traderId);
    
    return c.json({
      ...result,
      balance: trader?.balance,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 400);
  }
});

// =============================================================================
// ORDER OPERATIONS
// =============================================================================

/**
 * Place an order
 * POST /trade/order
 * 
 * Place a limit or market order to buy/sell tokens.
 */
tradingApi.post("/order", async (c) => {
  const user = c.get("user");
  const body = await c.req.json() as Omit<PlaceOrderInput, "traderId">;
  
  try {
    const result = registry.placeOrder({
      ...body,
      traderId: user.traderId,
    });
    
    return c.json(result, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 400);
  }
});

/**
 * Cancel an order
 * DELETE /trade/order/:id
 * 
 * Can only cancel your own orders.
 */
tradingApi.delete("/order/:id", (c) => {
  const user = c.get("user");
  const orderId = c.req.param("id");
  
  // Verify ownership
  const order = registry.getOrder(orderId);
  if (!order) {
    return c.json({ error: "Order not found" }, 404);
  }
  if (order.traderId !== user.traderId) {
    return c.json({ error: "Cannot cancel another user's order" }, 403);
  }
  
  try {
    const cancelled = registry.cancelOrder(orderId);
    return c.json(cancelled);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 400);
  }
});

/**
 * Get an order
 * GET /trade/order/:id
 */
tradingApi.get("/order/:id", (c) => {
  const orderId = c.req.param("id");
  const order = registry.getOrder(orderId);
  
  if (!order) {
    return c.json({ error: "Order not found" }, 404);
  }
  
  return c.json(order);
});

// =============================================================================
// ATOMIC SETTLEMENT (for agent-to-agent trades)
// =============================================================================

/**
 * Settle a trade atomically
 * POST /trade/settle
 * 
 * Executes a pre-agreed trade between two agents:
 * 1. Mints tokens to seller (if needed)
 * 2. Transfers tokens from seller to buyer
 * 3. Transfers cash from buyer to seller
 * 
 * This bypasses the order book - used when both parties have already agreed.
 */
tradingApi.post("/settle", async (c) => {
  const body = await c.req.json() as {
    marketId: string;
    buyerId: string;      // traderId of buyer
    sellerId: string;     // traderId of seller
    tokenType: "YES" | "NO";
    quantity: number;
    price: number;
  };
  
  const { marketId, buyerId, sellerId, tokenType, quantity, price } = body;
  const totalCost = quantity * price;
  
  try {
    // Validate market exists and is open
    const market = registry.getMarket(marketId);
    if (!market) {
      return c.json({ error: "Market not found" }, 404);
    }
    if (market.status !== "OPEN") {
      return c.json({ error: `Market is ${market.status}` }, 400);
    }
    
    // Get both traders
    const buyer = registry.getTrader(buyerId);
    const seller = registry.getTrader(sellerId);
    
    if (!buyer) return c.json({ error: "Buyer not found" }, 404);
    if (!seller) return c.json({ error: "Seller not found" }, 404);
    
    // Check buyer has enough cash
    if (buyer.balance < totalCost) {
      return c.json({ error: `Buyer insufficient balance: has $${buyer.balance.toFixed(2)}, needs $${totalCost.toFixed(2)}` }, 400);
    }
    
    // Mint tokens to seller (they need tokens to sell)
    // This costs the seller $quantity but gives them quantity YES + quantity NO
    registry.mint({
      marketId,
      traderId: sellerId,
      amount: quantity,
    });
    
    // Now transfer the specific token from seller to buyer
    // And transfer cash from buyer to seller
    const sellerPosition = registry.getPositionDirect(sellerId, marketId);
    const buyerPosition = registry.getPositionDirect(buyerId, marketId);
    
    // Verify seller has the tokens after minting
    const sellerTokens = tokenType === "YES" ? sellerPosition?.yesTokens : sellerPosition?.noTokens;
    if (!sellerTokens || sellerTokens < quantity) {
      return c.json({ error: `Seller insufficient ${tokenType} tokens after minting` }, 400);
    }
    
    // Execute the atomic swap
    registry.executeDirectTransfer({
      marketId,
      fromTraderId: sellerId,
      toTraderId: buyerId,
      tokenType,
      quantity,
      price,
    });
    
    // Record the trade
    const trade = registry.recordSettledTrade({
      marketId,
      buyerId,
      sellerId,
      tokenType,
      quantity,
      price,
    });
    
    return c.json({
      success: true,
      trade,
      message: `Settled ${quantity} ${tokenType} @ $${price.toFixed(2)} = $${totalCost.toFixed(2)}`,
    }, 201);
    
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 400);
  }
});
