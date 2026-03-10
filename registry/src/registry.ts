import { randomUUID } from "crypto";
import { MarketStorage, createTestStorage } from "./storage/index.js";
import type {
  BookLevel,
  CreateMarketInput,
  MarketFilters,
  MarketList,
  MarketOrderBook,
  MarketPrices,
  MarketStatus,
  MintInput,
  Order,
  OrderStatus,
  PlaceOrderInput,
  Position,
  PricePoint,
  RedeemInput,
  RegistryMarket,
  ResolutionProof,
  SettlementResult,
  TokenOrderBook,
  TokenSupply,
  TokenType,
  Trade,
  Trader,
  User,
  UserRole,
  VolumeStats,
} from "./types.js";

// =============================================================================
// POLYMARKET-STYLE MARKET REGISTRY
// =============================================================================
//
// Core Invariant: 1 YES + 1 NO = $1
//
// Token Flow:
//   MINT:   Trader deposits $X → gets X YES + X NO tokens
//   TRADE:  Traders exchange tokens on order book
//   REDEEM: Trader returns X YES + X NO → gets $X back
//   SETTLE: Winning tokens = $1, losing tokens = $0
//
// =============================================================================

// =============================================================================
// MARKET REGISTRY
// =============================================================================

export class MarketRegistry {
  private storage: MarketStorage;
  
  // In-memory order book cache for fast matching
  private orderBooks: Map<string, {
    YES: { bids: Order[]; asks: Order[] };
    NO: { bids: Order[]; asks: Order[] };
  }> = new Map();

  constructor(dbPath: string = "markets.db") {
    this.storage = new MarketStorage(dbPath);
  }

  /**
   * Create a test registry with isolated in-memory storage
   */
  static createTestRegistry(): MarketRegistry {
    const registry = new MarketRegistry(":memory:");
    return registry;
  }

  // ===========================================================================
  // MARKET LIFECYCLE
  // ===========================================================================

  /**
   * Create a new market
   */
  createMarket(input: CreateMarketInput): RegistryMarket {
    if (this.storage.marketExists(input.id)) {
      throw new Error(`Market ${input.id} already exists`);
    }

    const market = this.storage.createMarket(input);
    
    // Initialize order book cache
    this.orderBooks.set(market.id, {
      YES: { bids: [], asks: [] },
      NO: { bids: [], asks: [] },
    });

    return market;
  }

  getMarket(id: string): RegistryMarket | undefined {
    return this.storage.getMarket(id);
  }

  listMarkets(filters: MarketFilters = {}, offset = 0, limit = 50): MarketList {
    let { markets, total } = this.storage.listMarkets(filters.status, 0, 10000);

    // Apply additional filters
    if (filters.tags?.length) {
      markets = markets.filter(m => filters.tags!.some(tag => m.tags.includes(tag)));
    }

    if (filters.minVolume !== undefined) {
      markets = markets.filter(m => m.volume.totalVolume >= filters.minVolume!);
    }

    if (filters.resolvingBefore) {
      markets = markets.filter(m => m.resolutionDate <= filters.resolvingBefore!);
    }

    if (filters.resolvingAfter) {
      markets = markets.filter(m => m.resolutionDate >= filters.resolvingAfter!);
    }

    // Sort by created date (newest first)
    markets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    total = markets.length;
    const paginatedMarkets = markets.slice(offset, offset + limit);

    return { markets: paginatedMarkets, total, offset, limit };
  }

  getMarketsExpiringSoon(withinHours = 24): RegistryMarket[] {
    return this.storage.getMarketsExpiringSoon(withinHours);
  }

  haltMarket(marketId: string, reason: string): RegistryMarket {
    const market = this.storage.getMarket(marketId);
    if (!market) throw new Error(`Market ${marketId} not found`);
    if (market.status !== "OPEN") {
      throw new Error(`Market ${marketId} cannot be halted (status: ${market.status})`);
    }

    market.status = "HALTED";
    this.storage.updateMarket(market);

    console.log(`[Registry] Market ${marketId} halted: ${reason}`);
    return market;
  }

  resumeMarket(marketId: string): RegistryMarket {
    const market = this.storage.getMarket(marketId);
    if (!market) throw new Error(`Market ${marketId} not found`);
    if (market.status !== "HALTED") {
      throw new Error(`Market ${marketId} cannot be resumed (status: ${market.status})`);
    }

    market.status = "OPEN";
    this.storage.updateMarket(market);

    return market;
  }

  invalidateMarket(marketId: string, reason: string): RegistryMarket {
    const market = this.storage.getMarket(marketId);
    if (!market) throw new Error(`Market ${marketId} not found`);

    market.status = "INVALID";
    this.storage.updateMarket(market);
    
    this.cancelAllOrdersForMarket(marketId);

    console.log(`[Registry] Market ${marketId} invalidated: ${reason}`);
    return market;
  }

  // ===========================================================================
  // TOKEN OPERATIONS: MINT & REDEEM
  // ===========================================================================

  /**
   * Mint YES + NO tokens by depositing collateral
   * 
   * $X → X YES + X NO tokens
   */
  mint(input: MintInput): { yesTokens: number; noTokens: number } {
    const { marketId, traderId, amount } = input;
    
    if (amount <= 0) throw new Error("Amount must be positive");
    
    const market = this.storage.getMarket(marketId);
    if (!market) throw new Error(`Market ${marketId} not found`);
    if (market.status !== "OPEN") {
      throw new Error(`Market ${marketId} is not open`);
    }
    
    const trader = this.getOrCreateTrader(traderId);
    if (trader.balance < amount) {
      throw new Error(`Insufficient balance: have $${trader.balance}, need $${amount}`);
    }
    
    // Deduct cash
    trader.balance -= amount;
    
    // Create tokens with cost basis
    const position = this.getOrCreatePosition(trader, marketId);
    position.yesTokens += amount;
    position.noTokens += amount;
    position.yesCostBasis += amount / 2;
    position.noCostBasis += amount / 2;
    
    // Update market supply
    market.supply.yesSupply += amount;
    market.supply.noSupply += amount;
    market.supply.collateral += amount;
    
    // Persist changes
    this.storage.updateTrader(trader);
    this.storage.updateMarket(market);
    
    return { yesTokens: amount, noTokens: amount };
  }

  /**
   * Redeem YES + NO tokens for collateral
   * 
   * X YES + X NO → $X
   */
  redeem(input: RedeemInput): { cashReturned: number } {
    const { marketId, traderId, amount } = input;
    
    if (amount <= 0) throw new Error("Amount must be positive");
    
    const market = this.storage.getMarket(marketId);
    if (!market) throw new Error(`Market ${marketId} not found`);
    if (market.status !== "OPEN") {
      throw new Error(`Market ${marketId} is not open for redemption`);
    }
    
    const trader = this.storage.getTrader(traderId);
    if (!trader) throw new Error(`Trader ${traderId} not found`);
    
    const position = trader.positions.get(marketId);
    if (!position) throw new Error(`No position in market ${marketId}`);
    
    if (position.yesTokens < amount || position.noTokens < amount) {
      throw new Error(
        `Insufficient tokens: have ${position.yesTokens} YES and ${position.noTokens} NO, need ${amount} of each`
      );
    }
    
    // Burn tokens
    position.yesTokens -= amount;
    position.noTokens -= amount;
    
    // Return cash
    trader.balance += amount;
    
    // Update market supply
    market.supply.yesSupply -= amount;
    market.supply.noSupply -= amount;
    market.supply.collateral -= amount;
    
    // Persist
    this.storage.updateTrader(trader);
    this.storage.updateMarket(market);
    
    return { cashReturned: amount };
  }

  // ===========================================================================
  // ORDER OPERATIONS
  // ===========================================================================

  /**
   * Place an order to buy or sell tokens
   */
  placeOrder(input: PlaceOrderInput): { order: Order; trades: Trade[] } {
    const { marketId, traderId, tokenType, side, type, quantity } = input;
    let { price } = input;
    
    const market = this.storage.getMarket(marketId);
    if (!market) throw new Error(`Market ${marketId} not found`);
    if (market.status !== "OPEN") {
      throw new Error(`Market ${marketId} is not open for trading`);
    }
    
    // Validate
    if (quantity <= 0) throw new Error("Quantity must be positive");
    if (type === "LIMIT") {
      if (price === undefined || price <= 0 || price >= 1) {
        throw new Error("Limit order price must be between 0 and 1 (exclusive)");
      }
    } else {
      price = side === "BUY" ? 0.99 : 0.01;
    }
    
    const trader = this.getOrCreateTrader(traderId);
    
    // Validate trader can fulfill the order
    if (side === "BUY") {
      const cost = price! * quantity;
      if (trader.balance < cost) {
        throw new Error(`Insufficient balance: have $${trader.balance}, need $${cost}`);
      }
    } else {
      const position = trader.positions.get(marketId);
      const tokens = tokenType === "YES" ? position?.yesTokens : position?.noTokens;
      if (!tokens || tokens < quantity) {
        throw new Error(`Insufficient ${tokenType} tokens: have ${tokens || 0}, need ${quantity}`);
      }
    }
    
    const now = new Date().toISOString();
    const order: Order = {
      id: randomUUID(),
      marketId,
      traderId,
      tokenType,
      side,
      type,
      price: price!,
      quantity,
      filledQuantity: 0,
      status: "OPEN",
      createdAt: now,
      updatedAt: now,
    };
    
    this.storage.createOrder(order);
    
    // Match order
    const trades = this.matchOrder(order, market);
    
    return { order, trades };
  }

  /**
   * Cancel an order
   */
  cancelOrder(orderId: string): Order {
    const order = this.storage.getOrder(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    if (order.status === "FILLED" || order.status === "CANCELLED") {
      throw new Error(`Order ${orderId} cannot be cancelled (status: ${order.status})`);
    }

    order.status = "CANCELLED";
    order.updatedAt = new Date().toISOString();
    this.storage.updateOrder(order);

    return order;
  }

  getOrder(orderId: string): Order | undefined {
    return this.storage.getOrder(orderId);
  }

  getOrdersForTrader(traderId: string, status?: OrderStatus[]): Order[] {
    return this.storage.getOrdersForTrader(traderId, status);
  }

  /**
   * Get order book for a market
   */
  getOrderBook(marketId: string): MarketOrderBook {
    const market = this.storage.getMarket(marketId);
    if (!market) throw new Error(`Market ${marketId} not found`);

    const aggregateBook = (tokenType: TokenType): TokenOrderBook => {
      const { bids, asks } = this.storage.getActiveOrdersForMarketAndToken(marketId, tokenType);
      
      const aggregateLevels = (orders: Order[], sortDesc: boolean): BookLevel[] => {
        const levels = new Map<number, { quantity: number; count: number }>();
        orders.forEach(o => {
          const remaining = o.quantity - o.filledQuantity;
          if (remaining > 0) {
            const existing = levels.get(o.price) || { quantity: 0, count: 0 };
            existing.quantity += remaining;
            existing.count += 1;
            levels.set(o.price, existing);
          }
        });
        const arr = [...levels.entries()]
          .map(([price, { quantity, count }]) => ({ price, quantity, orderCount: count }));
        return sortDesc 
          ? arr.sort((a, b) => b.price - a.price)
          : arr.sort((a, b) => a.price - b.price);
      };

      const bidLevels = aggregateLevels(bids, true);
      const askLevels = aggregateLevels(asks, false);
      
      const bestBid = bidLevels[0]?.price ?? null;
      const bestAsk = askLevels[0]?.price ?? null;
      const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;

      return { tokenType, bids: bidLevels, asks: askLevels, bestBid, bestAsk, spread };
    };

    return {
      marketId,
      yes: aggregateBook("YES"),
      no: aggregateBook("NO"),
      updatedAt: new Date().toISOString(),
    };
  }

  // ===========================================================================
  // USER OPERATIONS
  // ===========================================================================

  createUser(input: { name: string; role?: UserRole; twitterHandle?: string }): User {
    return this.storage.createUser(input);
  }

  getUser(id: string): User | undefined {
    return this.storage.getUser(id);
  }

  getUserByToken(token: string): User | undefined {
    return this.storage.getUserByToken(token);
  }

  getUserByTraderId(traderId: string): User | undefined {
    return this.storage.getUserByTraderId(traderId);
  }

  getUserByTwitterHandle(handle: string): User | undefined {
    return this.storage.getUserByTwitterHandle(handle);
  }

  listUsers(offset = 0, limit = 50): { users: User[]; total: number } {
    return this.storage.listUsers(offset, limit);
  }

  updateUser(user: User): void {
    this.storage.updateUser(user);
  }

  // ===========================================================================
  // TRADER OPERATIONS (Trading State)
  // ===========================================================================

  getTrader(id: string): Trader | undefined {
    return this.storage.getTrader(id);
  }

  getPosition(traderId: string, marketId: string): Position | undefined {
    const trader = this.storage.getTrader(traderId);
    return trader?.positions.get(marketId);
  }

  creditBalance(traderId: string, amount: number): Trader {
    const trader = this.storage.getTrader(traderId);
    if (!trader) throw new Error(`Trader ${traderId} not found`);
    trader.balance += amount;
    this.storage.updateTrader(trader);
    return trader;
  }

  // ===========================================================================
  // DIRECT SETTLEMENT (for agent-to-agent trades)
  // ===========================================================================

  /**
   * Get position directly (alias for getPosition)
   */
  getPositionDirect(traderId: string, marketId: string): Position | undefined {
    return this.getPosition(traderId, marketId);
  }

  /**
   * Execute a direct transfer between two traders (bypasses order book)
   * Used when both parties have already agreed on the trade off-chain.
   */
  executeDirectTransfer(params: {
    marketId: string;
    fromTraderId: string;
    toTraderId: string;
    tokenType: "YES" | "NO";
    quantity: number;
    price: number;
  }): void {
    const { marketId, fromTraderId, toTraderId, tokenType, quantity, price } = params;
    const totalCost = quantity * price;
    
    const seller = this.storage.getTrader(fromTraderId);
    const buyer = this.storage.getTrader(toTraderId);
    
    if (!seller) throw new Error(`Seller ${fromTraderId} not found`);
    if (!buyer) throw new Error(`Buyer ${toTraderId} not found`);
    
    // Get/create positions
    const sellerPos = this.getOrCreatePosition(seller, marketId);
    const buyerPos = this.getOrCreatePosition(buyer, marketId);
    
    // Verify seller has tokens
    const sellerTokens = tokenType === "YES" ? sellerPos.yesTokens : sellerPos.noTokens;
    if (sellerTokens < quantity) {
      throw new Error(`Seller has ${sellerTokens} ${tokenType}, needs ${quantity}`);
    }
    
    // Verify buyer has cash
    if (buyer.balance < totalCost) {
      throw new Error(`Buyer has $${buyer.balance.toFixed(2)}, needs $${totalCost.toFixed(2)}`);
    }
    
    // Execute transfer: tokens from seller to buyer
    if (tokenType === "YES") {
      sellerPos.yesTokens -= quantity;
      buyerPos.yesTokens += quantity;
      buyerPos.yesCostBasis += totalCost;
    } else {
      sellerPos.noTokens -= quantity;
      buyerPos.noTokens += quantity;
      buyerPos.noCostBasis += totalCost;
    }
    
    // Execute transfer: cash from buyer to seller
    buyer.balance -= totalCost;
    seller.balance += totalCost;
    
    // Persist changes
    this.storage.updateTrader(seller);
    this.storage.updateTrader(buyer);
  }

  /**
   * Record a settled trade (for history/volume tracking)
   */
  recordSettledTrade(params: {
    marketId: string;
    buyerId: string;
    sellerId: string;
    tokenType: "YES" | "NO";
    quantity: number;
    price: number;
  }): Trade {
    const { marketId, buyerId, sellerId, tokenType, quantity, price } = params;
    
    const trade: Trade = {
      id: `trade_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      marketId,
      buyerOrderId: `settled_${buyerId}`,
      sellerOrderId: `settled_${sellerId}`,
      buyerId,
      sellerId,
      tokenType,
      price,
      quantity,
      value: quantity * price,
      minted: true, // Settlement always involves minting
      executedAt: new Date().toISOString(),
    };
    
    // Update market volume AND prices
    const market = this.storage.getMarket(marketId);
    if (market) {
      market.volume.totalVolume += trade.value;
      market.volume.tradeCount += 1;
      market.volume.uniqueTraders.add(buyerId);
      market.volume.uniqueTraders.add(sellerId);
      
      // Update prices based on last trade
      if (tokenType === "YES") {
        market.prices.yesPrice = price;
        market.prices.noPrice = 1 - price;
      } else {
        market.prices.noPrice = price;
        market.prices.yesPrice = 1 - price;
      }
      market.prices.lastTradeAt = trade.executedAt;
      
      // Add to price history
      market.priceHistory.push({
        timestamp: trade.executedAt,
        yesPrice: market.prices.yesPrice,
        volume: trade.value,
      });
      
      this.storage.updateMarket(market);
    }
    
    // Save trade
    this.storage.createTrade(trade);
    
    return trade;
  }

  // ===========================================================================
  // RESOLUTION & SETTLEMENT
  // ===========================================================================

  /**
   * Resolve a market and settle all positions
   */
  resolveMarket(
    marketId: string,
    outcome: "YES" | "NO",
    proof: Omit<ResolutionProof, "outcome" | "timestamp">
  ): RegistryMarket {
    const market = this.storage.getMarket(marketId);
    if (!market) throw new Error(`Market ${marketId} not found`);
    if (market.status !== "OPEN" && market.status !== "HALTED") {
      throw new Error(`Market ${marketId} cannot be resolved (status: ${market.status})`);
    }

    const newStatus: MarketStatus = outcome === "YES" ? "RESOLVED_YES" : "RESOLVED_NO";
    const now = new Date().toISOString();

    // Update market
    market.status = newStatus;
    market.resolvedAt = now;
    market.resolutionProof = { ...proof, outcome, timestamp: now };
    
    // Final prices
    market.prices.yesPrice = outcome === "YES" ? 1 : 0;
    market.prices.noPrice = outcome === "NO" ? 1 : 0;
    market.prices.lastTradeAt = now;

    // Add final price point
    market.priceHistory.push({
      timestamp: now,
      yesPrice: market.prices.yesPrice,
      volume: 0,
    });

    // Cancel all open orders
    this.cancelAllOrdersForMarket(marketId);

    // Settle all positions
    this.settleMarket(marketId, outcome);

    // Persist
    this.storage.updateMarket(market);

    return market;
  }

  /**
   * Settle all positions in a resolved market
   */
  private settleMarket(marketId: string, outcome: "YES" | "NO"): SettlementResult[] {
    const results: SettlementResult[] = [];
    const { markets } = this.storage.listMarkets(undefined, 0, 1);
    
    // Get all traders with positions in this market
    // This is a simplified version - in production you'd want a dedicated query
    const allTraders = this.getAllTradersWithPositions(marketId);
    
    for (const trader of allTraders) {
      const position = trader.positions.get(marketId);
      if (!position) continue;
      
      const { yesTokens, noTokens, yesCostBasis, noCostBasis } = position;
      
      // Calculate payout
      let payout = 0;
      if (outcome === "YES") {
        payout = yesTokens;
      } else {
        payout = noTokens;
      }
      
      // Calculate profit
      const totalCost = yesCostBasis + noCostBasis;
      const profit = payout - totalCost;
      
      // Update trader
      trader.balance += payout;
      trader.realizedPnl += profit;
      
      if (profit > 0) {
        trader.wins += 1;
      } else if (profit < 0) {
        trader.losses += 1;
      }
      
      // Clear position
      position.yesTokens = 0;
      position.noTokens = 0;
      
      // Persist
      this.storage.updateTrader(trader);
      
      results.push({
        traderId: trader.id,
        marketId,
        yesTokens,
        noTokens,
        payout,
        profit,
      });
    }
    
    return results;
  }

  // ===========================================================================
  // TRADE QUERIES
  // ===========================================================================

  getTradesForMarket(marketId: string, limit = 50): Trade[] {
    return this.storage.getTradesForMarket(marketId, limit);
  }

  getTradesForTrader(traderId: string, limit = 50): Trade[] {
    return this.storage.getTradesForTrader(traderId, limit);
  }

  // ===========================================================================
  // STATS
  // ===========================================================================

  getStats(): {
    totalMarkets: number;
    openMarkets: number;
    resolvedMarkets: number;
    totalVolume: number;
    totalTrades: number;
    totalTraders: number;
  } {
    return this.storage.getStats();
  }

  // ===========================================================================
  // LEADERBOARD
  // ===========================================================================

  /**
   * Get trader leaderboard (sorted by P&L)
   */
  getTraderLeaderboard(limit = 50, offset = 0) {
    return this.storage.getTraderLeaderboard(limit, offset);
  }

  /**
   * Get stats for a specific trader
   */
  getTraderStats(traderId: string) {
    return this.storage.getTraderStats(traderId);
  }

  // ===========================================================================
  // INTERNAL: ORDER MATCHING
  // ===========================================================================

  /**
   * Match an incoming order against the book
   */
  private matchOrder(order: Order, market: RegistryMarket): Trade[] {
    const { bids, asks } = this.storage.getActiveOrdersForMarketAndToken(order.marketId, order.tokenType);
    const trades: Trade[] = [];
    
    if (order.side === "BUY") {
      // Match against asks (people selling)
      const sortedAsks = asks.filter(o => o.id !== order.id).sort((a, b) => a.price - b.price);
      
      let remainingQty = order.quantity - order.filledQuantity;
      
      for (const ask of sortedAsks) {
        if (remainingQty <= 0) break;
        if (order.price < ask.price && order.type === "LIMIT") break;
        
        const askRemaining = ask.quantity - ask.filledQuantity;
        const fillQty = Math.min(remainingQty, askRemaining);
        const fillPrice = ask.price;
        
        const trade = this.executeTrade(order, ask, fillPrice, fillQty, market);
        trades.push(trade);
        
        remainingQty -= fillQty;
      }
      
      if (order.filledQuantity >= order.quantity) {
        order.status = "FILLED";
      }
      
    } else {
      // SELL - match against bids
      const sortedBids = bids.filter(o => o.id !== order.id).sort((a, b) => b.price - a.price);
      
      let remainingQty = order.quantity - order.filledQuantity;
      
      for (const bid of sortedBids) {
        if (remainingQty <= 0) break;
        if (order.price > bid.price && order.type === "LIMIT") break;
        
        const bidRemaining = bid.quantity - bid.filledQuantity;
        const fillQty = Math.min(remainingQty, bidRemaining);
        const fillPrice = bid.price;
        
        const trade = this.executeTrade(bid, order, fillPrice, fillQty, market);
        trades.push(trade);
        
        remainingQty -= fillQty;
      }
      
      if (order.filledQuantity >= order.quantity) {
        order.status = "FILLED";
      }
    }
    
    // Update order in storage
    this.storage.updateOrder(order);
    
    // Update market prices
    this.updateMarketPrices(market);
    this.storage.updateMarket(market);
    
    return trades;
  }

  /**
   * Execute a trade between a buyer and seller
   */
  private executeTrade(
    buyOrder: Order,
    sellOrder: Order,
    price: number,
    quantity: number,
    market: RegistryMarket
  ): Trade {
    const now = new Date().toISOString();
    const value = price * quantity;
    
    // Update order states
    buyOrder.filledQuantity += quantity;
    sellOrder.filledQuantity += quantity;
    buyOrder.updatedAt = now;
    sellOrder.updatedAt = now;
    
    if (buyOrder.filledQuantity >= buyOrder.quantity) buyOrder.status = "FILLED";
    else if (buyOrder.filledQuantity > 0) buyOrder.status = "PARTIALLY_FILLED";
    
    if (sellOrder.filledQuantity >= sellOrder.quantity) sellOrder.status = "FILLED";
    else if (sellOrder.filledQuantity > 0) sellOrder.status = "PARTIALLY_FILLED";
    
    // Persist order updates
    this.storage.updateOrder(buyOrder);
    this.storage.updateOrder(sellOrder);
    
    // Transfer tokens and cash
    const buyer = this.storage.getTrader(buyOrder.traderId)!;
    const seller = this.storage.getTrader(sellOrder.traderId)!;
    const tokenType = buyOrder.tokenType;
    
    // Buyer: pay cash, receive tokens
    buyer.balance -= value;
    const buyerPos = this.getOrCreatePosition(buyer, market.id);
    if (tokenType === "YES") {
      buyerPos.yesTokens += quantity;
      buyerPos.yesCostBasis += value;
    } else {
      buyerPos.noTokens += quantity;
      buyerPos.noCostBasis += value;
    }
    buyer.tradeCount += 1;
    
    // Seller: receive cash, give tokens, realize P&L
    seller.balance += value;
    const sellerPos = this.getOrCreatePosition(seller, market.id);
    if (tokenType === "YES") {
      const tokensBefore = sellerPos.yesTokens;
      const costBasisBefore = sellerPos.yesCostBasis;
      const avgCost = tokensBefore > 0 ? costBasisBefore / tokensBefore : 0;
      const costOfSold = avgCost * quantity;
      
      const realizedPnl = value - costOfSold;
      seller.realizedPnl += realizedPnl;
      
      sellerPos.yesTokens -= quantity;
      sellerPos.yesCostBasis -= costOfSold;
    } else {
      const tokensBefore = sellerPos.noTokens;
      const costBasisBefore = sellerPos.noCostBasis;
      const avgCost = tokensBefore > 0 ? costBasisBefore / tokensBefore : 0;
      const costOfSold = avgCost * quantity;
      
      const realizedPnl = value - costOfSold;
      seller.realizedPnl += realizedPnl;
      
      sellerPos.noTokens -= quantity;
      sellerPos.noCostBasis -= costOfSold;
    }
    seller.tradeCount += 1;
    
    // Persist trader updates
    this.storage.updateTrader(buyer);
    this.storage.updateTrader(seller);
    
    // Create trade record
    const trade: Trade = {
      id: randomUUID(),
      marketId: market.id,
      tokenType,
      price,
      quantity,
      value,
      buyerId: buyOrder.traderId,
      buyerOrderId: buyOrder.id,
      sellerId: sellOrder.traderId,
      sellerOrderId: sellOrder.id,
      minted: false,
      executedAt: now,
    };
    
    this.storage.createTrade(trade);
    
    // Update market stats
    market.volume.totalVolume += value;
    market.volume.volume24h += value;
    market.volume.tradeCount += 1;
    market.volume.uniqueTraders.add(buyOrder.traderId);
    market.volume.uniqueTraders.add(sellOrder.traderId);
    
    // Update price history
    if (tokenType === "YES") {
      market.prices.yesPrice = price;
      market.prices.noPrice = 1 - price;
    } else {
      market.prices.noPrice = price;
      market.prices.yesPrice = 1 - price;
    }
    market.prices.lastTradeAt = now;
    
    market.priceHistory.push({
      timestamp: now,
      yesPrice: market.prices.yesPrice,
      volume: value,
    });
    
    return trade;
  }

  /**
   * Update market prices from order book
   */
  private updateMarketPrices(market: RegistryMarket): void {
    const book = this.getOrderBook(market.id);
    market.prices.yesBestBid = book.yes.bestBid;
    market.prices.yesBestAsk = book.yes.bestAsk;
    market.prices.noBestBid = book.no.bestBid;
    market.prices.noBestAsk = book.no.bestAsk;
  }

  // ===========================================================================
  // INTERNAL: HELPERS
  // ===========================================================================

  private getOrCreateTrader(traderId: string): Trader {
    const trader = this.storage.getTrader(traderId);
    if (!trader) {
      throw new Error(`Trader ${traderId} not found. Register a user first.`);
    }
    return trader;
  }

  private getOrCreatePosition(trader: Trader, marketId: string): Position {
    let position = trader.positions.get(marketId);
    if (!position) {
      position = {
        marketId,
        yesTokens: 0,
        noTokens: 0,
        yesCostBasis: 0,
        noCostBasis: 0,
      };
      trader.positions.set(marketId, position);
    }
    return position;
  }

  private cancelAllOrdersForMarket(marketId: string): void {
    this.storage.cancelOrdersForMarket(marketId);
  }

  /**
   * Get all traders with positions in a market
   */
  private getAllTradersWithPositions(marketId: string): Trader[] {
    return this.storage.getTradersWithPositionsInMarket(marketId);
  }
}

