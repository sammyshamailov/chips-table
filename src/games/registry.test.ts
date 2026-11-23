import { describe, expect, it } from 'vitest';
import { GAMES, gameMode } from './registry';

describe('gameMode', () => {
  it("is Hold'em only when the game says so, Blackjack otherwise (as the views always drew it)", () => {
    expect(gameMode('holdem')).toBe(GAMES.holdem);
    expect(gameMode('blackjack')).toBe(GAMES.blackjack);
    for (const g of [undefined, null, '', 'poker']) expect(gameMode(g)).toBe(GAMES.blackjack);
  });
  it('gives each game its own limits, bound to the room fields', () => {
    expect(GAMES.holdem.limits.map(f => f.key)).toEqual(['bb', 'sb']);
    expect(GAMES.blackjack.limits.map(f => f.key)).toEqual(['minBet', 'maxBet']);
    expect(GAMES.holdem.dealerPlays).toBe(true);
    expect(GAMES.blackjack.dealerPlays).toBe(false);
  });
  it('draws every game with components: a table, a dock and the dealer controls', () => {
    for (const g of [GAMES.holdem, GAMES.blackjack])
      expect(Object.keys(g.views)).toEqual(['Table', 'Dock', 'HostPanel']);
    expect(GAMES.holdem.views).not.toBe(GAMES.blackjack.views);
  });
});
