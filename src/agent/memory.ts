import { createHash } from 'node:crypto';

export class ExplorationMemory {
  private visitedStates = new Set<string>();
  private actionHistory: Array<{ url: string; action: string; ref?: string }> = [];
  private consecutiveSameState = 0;
  private lastStateHash = '';

  recordVisit(url: string, snapshotText: string): void {
    const hash = this.hashSnapshot(url, snapshotText);

    if (hash === this.lastStateHash) {
      this.consecutiveSameState++;
    } else {
      this.consecutiveSameState = 0;
    }

    this.lastStateHash = hash;
    this.visitedStates.add(hash);
  }

  recordAction(url: string, action: string, ref?: string): void {
    this.actionHistory.push({ url, action, ref });
  }

  isStuck(): boolean {
    return this.consecutiveSameState >= 3;
  }

  hasVisited(url: string, snapshotText: string): boolean {
    return this.visitedStates.has(this.hashSnapshot(url, snapshotText));
  }

  getVisitedCount(): number {
    return this.visitedStates.size;
  }

  getRecentActions(count = 5): Array<{ url: string; action: string; ref?: string }> {
    return this.actionHistory.slice(-count);
  }

  private hashSnapshot(url: string, snapshotText: string): string {
    return createHash('sha256').update(`${url}::${snapshotText}`).digest('hex').slice(0, 16);
  }
}
