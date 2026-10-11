import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import type { AudioSource } from '../src/audio/AudioSource';
import { MovementPlayer } from '../src/audio/MovementPlayer';
import { flattenMovements, type AudioSpec, type PiecesFile } from '../src/data';

/** 시각과 재생 상태를 테스트가 직접 정하는 가짜 플레이어 */
class FakeSource implements AudioSource {
  time = 0;
  playing = false;
  loads: { spec: AudioSpec; autoplay: boolean }[] = [];
  seeks: number[] = [];
  private ended: (() => void)[] = [];

  load(spec: AudioSpec, autoplay: boolean): void {
    this.loads.push({ spec, autoplay });
    if (autoplay) this.playing = true;
  }
  play(): void { this.playing = true; }
  pause(): void { this.playing = false; }
  seek(seconds: number): void { this.seeks.push(seconds); }
  getCurrentTime(): number { return this.time; }  isPlaying(): boolean { return this.playing; }
  setPlaybackRate(): void {}
  onEnded(cb: () => void): void { this.ended.push(cb); }
  onStateChange(): void {}
  fireEnded(): void { this.ended.forEach((cb) => cb()); }
}

const pieces = JSON.parse(fs.readFileSync('data/pieces.json', 'utf8')) as PiecesFile;
const entries = flattenMovements(pieces);
const indexOf = (id: string) => entries.findIndex((e) => e.movement.id === id);

describe('MovementPlayer', () => {
  let source: FakeSource;
  let player: MovementPlayer;
  let changes: string[];

  /** 악장을 고르고 재생해 영상이 그 악장 시작에 도착한 상태로 만든다 */
  function startAt(id: string): void {
    player.select(indexOf(id), true);
    source.time = entries[indexOf(id)].movement.audio.start;
    player.tick(source.time);
    source.loads = [];
    changes = [];
  }

  beforeEach(() => {
    source = new FakeSource();
    player = new MovementPlayer(source, entries);
    changes = [];
    player.onMovementChange((e) => changes.push(e.movement.id));
  });

  it('K.331 2악장 재생 중 740초를 지나면 3악장으로 바뀐다 (같은 영상, 다시 불러오지 않음)', () => {
    startAt('k331-2');
    source.time = 739.9;
    player.tick(source.time);
    expect(player.entry.movement.id).toBe('k331-2');

    source.time = 740.02;
    player.tick(source.time);
    expect(player.entry.movement.id).toBe('k331-3');
    expect(changes).toEqual(['k331-3']);
    expect(source.loads).toEqual([]); // 영상은 끊기지 않고 그대로 이어서 재생
  });

  it('사용자가 YouTube 화면에서 시간을 옮기면 그 시각의 악장으로 바뀐다 (멈춤 상태 포함)', () => {
    startAt('k331-3');
    source.time = 100;
    player.tick(source.time);
    expect(player.entry.movement.id).toBe('k331-1');

    source.pause();
    source.time = 600;
    player.tick(source.time);
    expect(player.entry.movement.id).toBe('k331-2');
    expect(changes).toEqual(['k331-1', 'k331-2']);
    expect(source.loads).toEqual([]);
  });

  it('같은 구간 안에서는 악장 변경 이벤트를 다시 내지 않는다', () => {
    startAt('k331-3');
    [750, 800, 900].forEach((t) => player.tick(t));
    expect(changes).toEqual([]);
  });

  it('곡의 마지막 악장이 끝나면(영상 끝) 다음 곡 영상을 불러온다', () => {
    startAt('k282-3');
    source.fireEnded();
    expect(player.entry.movement.id).toBe('k333-1');
    expect(source.loads).toEqual([{ spec: entries[indexOf('k333-1')].movement.audio, autoplay: true }]);
  });

  it('end가 있는 구간을 넘었는데 같은 영상에 맞는 악장이 없으면 다음 곡 영상으로 넘어간다', () => {
    const a = (start: number, end: number | null): AudioSpec => ({ type: 'youtube', videoId: 'A', start, end });
    const custom = [
      { ...entries[0], movement: { ...entries[0].movement, id: 'a-1', audio: a(0, 10) } },
      { ...entries[1], movement: { ...entries[1].movement, id: 'a-2', audio: a(10, 20) } },
      { ...entries[3], movement: { ...entries[3].movement, id: 'b-1', audio: { ...a(5, null), videoId: 'B' } } },
    ];
    player = new MovementPlayer(source, custom);
    player.select(1, true);
    player.tick(10);
    player.tick(20.1); // a-2 끝, 영상 A에 20초 이후 악장 없음 (박수 구간)
    expect(player.entry.movement.id).toBe('b-1');
    expect(source.loads.at(-1)).toEqual({ spec: custom[2].movement.audio, autoplay: true });
  });

  it('악장을 고른 직후 영상이 시작점에 도착하기 전의 시각(이전 영상 값·0)으로는 악장을 바꾸지 않는다', () => {
    player.select(indexOf('k331-3'), false);
    changes = [];
    player.tick(0); // 아직 cue 중이라 0을 돌려줌
    expect(player.entry.movement.id).toBe('k331-3');

    player.tick(740.1); // 도착
    player.tick(100); // 이제부터는 사용자 이동으로 본다
    expect(player.entry.movement.id).toBe('k331-1');
    expect(changes).toEqual(['k331-1']);
  });

  it('다른 영상으로 넘어간 직후 이전 영상 시각이 잠깐 보여도 무시한다', () => {
    startAt('k282-3');
    source.fireEnded(); // → k333-1 (start 0)
    changes = [];
    player.tick(900); // 이전 영상(K.282)의 시각. 판정하면 k333-3(862~)으로 잘못 튄다
    expect(player.entry.movement.id).toBe('k333-1');
    player.tick(0.3);
    expect(player.entry.movement.id).toBe('k333-1');
    expect(changes).toEqual([]);
  });

  it('마지막 악장(K.331 3악장)이 끝나면 멈춘다', () => {
    startAt('k331-3');
    source.fireEnded();
    expect(source.playing).toBe(false);
    expect(player.entry.movement.id).toBe('k331-3');
  });

  it('재생 버튼: 구간 밖이면 구간 처음으로 옮긴 뒤 재생', () => {
    startAt('k331-3');
    source.pause();
    source.time = 10;
    player.toggle();
    expect(source.seeks).toEqual([740]);
    expect(source.playing).toBe(true);
  });
});
