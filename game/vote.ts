import { PlayerStatus, PlayerVoteStatus, type GameState, type PlayerState } from './session';

/** 投票管理类 */
export class VoteManager {
  private _voteTime = 5;
  private _startIndex = -1;
  private _from = '';
  private _to = '';
  private _voteOffset = 0;

  get voteTime() {
    return this._voteTime;
  }

  set voteTime(time: number) {
    this._voteTime = time;
  }

  get startIndex() {
    return this._startIndex;
  }

  get from() {
    return this._from;
  }

  get to() {
    return this._to;
  }

  private voteTimer: { timer: NodeJS.Timeout; reject: (reason?: any) => void } | null = null;

  constructor(
    private readonly players: PlayerState[],
    private readonly state: Pick<GameState, 'voting' | 'votingEnd' | 'votingStart' | 'voteInfo'>,
    private readonly updatePlayerList: () => void,
  ) {}

  private updateVotingLine = () => {
    if (this._startIndex === -1) {
      // 普通投票没有那么多数据
      const current = this.state.voteInfo.value;
      const lines = current.split('\n');
      lines[1] = `投票：${this.players.reduce((acc, cur) => acc + cur.vote.count, 0)}`;
      this.state.voteInfo.set(lines.join('\n'));
      return;
    }

    const started = this.state.votingStart.value > 0;

    const current = this.state.voteInfo.value;
    const lines = current.split('\n');
    const countingPlayer = this.players.find(
      (p) => p.vote.status === PlayerVoteStatus.COUNTING,
    )?.id;
    lines[1] = `投票：${this.players.reduce((acc, cur) => acc + cur.vote.count, this._voteOffset)} / ${this.players.filter((p) => p.status === PlayerStatus.ALIVE).length}${countingPlayer != null ? `　　(font)${started ? '正在计入：' : '起始玩家：'}(font)[${started ? 'purple' : 'body'}](met)${countingPlayer}(met)` : ''}`;
    this.state.voteInfo.set(lines.join('\n'));
  };

  /**
   * 是否为提名投票
   */
  isNomination() {
    return this._startIndex !== -1;
  }

  /** 进入提名投票 */
  enterNomination(from: string, to: string) {
    this._from = from;
    this._to = to;

    const index = (this.players.findIndex((p) => p.id === this._to) + 1) % this.players.length;
    this._startIndex = index;

    // 重置玩家投票数据
    this.players.forEach((p, i) => {
      p.vote.count = 0;
      p.vote.status = i === index ? PlayerVoteStatus.COUNTING : PlayerVoteStatus.NONE;
    });
    this._voteOffset = 0;

    this.state.voteInfo.set(
      `(met)${this.from}(met) 发起提名，投票(font)处决(font)[danger] (met)${this.to}(met)`,
    );
    // 开启投票状态
    this.state.voting.set(true);
    // 禁用倒计时
    this.state.votingStart.set(0);
    this.state.votingEnd.set(0);

    this.updateVotingLine();
    this.updatePlayerList();
  }

  /** 进入普通投票 */
  enterNormal() {
    this._startIndex = -1;

    // 重置玩家投票数据
    this.players.forEach((p, i) => {
      p.vote.count = 0;
      p.vote.status = PlayerVoteStatus.NONE;
    });
    this._voteOffset = 0;

    this.updateVotingLine();
    // 开启投票状态
    this.state.voting.set(true);
    // 禁用倒计时
    this.state.votingStart.set(0);
    this.state.votingEnd.set(0);
    this.updatePlayerList();
  }

  wait(time: number) {
    return new Promise<void>((resolve, reject) => {
      this.voteTimer = {
        timer: setTimeout(() => {
          resolve();
          this.voteTimer = null;
        }, time),
        reject,
      };
    });
  }

  voteToggle(userId: string) {
    const player = this.players.find((p) => p.id === userId);
    if (!player) return;

    // 说书人只能在投票锁定后更改投票
    if (player.vote.status !== PlayerVoteStatus.COUNTED) return;
    if (player.vote.count === 0) {
      player.vote.count = 1;
    } else {
      player.vote.count = 0;
    }
    this.updateVotingLine();
    this.updatePlayerList();
  }

  voteAdd() {
    this._voteOffset++;
    this.updateVotingLine();
    this.updatePlayerList();
  }

  voteRemove() {
    this._voteOffset--;
    this.updateVotingLine();
    this.updatePlayerList();
  }

  playerVoteNone(userId: string) {
    const player = this.players.find((p) => p.id === userId);
    if (!player) return;
    if (player.vote.status === PlayerVoteStatus.COUNTED) return;

    player.vote.count = 0;
    this.updateVotingLine();
    this.updatePlayerList();
  }

  playerVoteOne(userId: string) {
    const player = this.players.find((p) => p.id === userId);
    if (!player) return;
    if (player.vote.status === PlayerVoteStatus.COUNTED) return;

    player.vote.count = 1;
    this.updateVotingLine();
    this.updatePlayerList();
  }

  playerVoteTwo(userId: string) {
    const player = this.players.find((p) => p.id === userId);
    if (!player) return;
    if (player.vote.status === PlayerVoteStatus.COUNTED) return;

    player.vote.count = 2;
    this.updateVotingLine();
    this.updatePlayerList();
  }

  /**
   * 开始提名投票
   */
  private async startNomination() {
    try {
      const start = Date.now();
      this.state.votingStart.set(start);
      this.state.votingEnd.set(start + this.voteTime * 1000 * this.players.length);

      const playerCount = this.players.length;
      for (let i = 0; i < playerCount; i++) {
        const index = (this.startIndex + i) % playerCount;
        const player = this.players[index];
        if (!player) break;
        player.vote.status = PlayerVoteStatus.COUNTING;
        this.updateVotingLine();
        this.updatePlayerList();
        await this.wait(this.voteTime * 1000);
        player.vote.status = PlayerVoteStatus.COUNTED;
      }

      this.updateVotingLine();
      this.updatePlayerList();
    } catch (err: any) {
      if (err?.message == 'stopped') {
        // 手动停止不用管
        return;
      }
      throw err;
    }
  }

  /**
   * 开始普通投票
   */
  private async startNormal() {
    try {
      const start = Date.now();
      this.state.votingStart.set(start);
      this.state.votingEnd.set(start + this.voteTime * 1000 * this.players.length);
      await this.wait(this.voteTime * 1000 * this.players.length);

      // 锁定所有人投票
      this.players.forEach((p) => {
        p.vote.status = PlayerVoteStatus.COUNTED;
      });
      this.updatePlayerList();
    } catch (err: any) {
      if (err?.message == 'stopped') {
        // 手动停止不用管
      }
    }
  }

  /**
   * 开始投票
   */
  start() {
    if (this._startIndex === -1) {
      this.startNormal();
    } else {
      this.startNomination();
    }
  }

  /**
   * 重新开始提名投票
   */
  async reset() {
    this.stop();
    if (this._startIndex === -1) {
      this.enterNormal();
    } else {
      this.enterNomination(this._from, this._to);
    }
  }

  private stop() {
    if (this.voteTimer) {
      clearTimeout(this.voteTimer.timer);
      this.voteTimer.reject(new Error('stopped'));
      this.voteTimer = null;
    }
  }

  /**
   * 终止并退出投票
   */
  exit() {
    this.stop();

    this.state.voting.set(false);
    this.state.votingStart.set(0);
    this.state.votingEnd.set(0);
    this.updatePlayerList();
  }
}
