import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Download,
  Flame,
  Grid3x3,
  MoveDiagonal,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Shuffle,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { SliceCanvas } from './components/SliceCanvas';
import { TitleLockup } from './components/TitleLockup';
import { soundEngine } from './game/audio';
import {
  CAMPAIGN_ROUNDS,
  HELPER_ITEMS,
  RETRY_ROUND_PENALTY,
  STREAK_SCORE_THRESHOLD,
  calculateStreakBonus,
  getFinalRank,
  getHelperItemName,
  getHelperItemsPenalty,
  loadBestCampaign,
  saveBestCampaign,
  type BestRecord,
} from './game/levels';
import { CULINARY_OBJECTS, getObjectById } from './game/objects';
import {
  downloadBlobAsPng,
  generateCampaignShareBlob,
  shareResultImage,
} from './game/share';
import {
  trackCampaignCompleted,
  trackGameStart,
  trackHelperItemUsed,
  trackRoundCompleted,
  trackShareOutcome,
} from './game/analytics';
import type { GameMode, GameState, HelperItemId, RoundResult } from './game/types';

const TITLE_BACKDROP_SRC = '/src/assets/images/title_outline_backdrop_1794927015704.jpg';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [mode, setMode] = useState<GameMode>('CAMPAIGN');
  const [muted, setMuted] = useState<boolean>(() => soundEngine.isMuted());
  const [backdropFailed, setBackdropFailed] = useState(false);

  // Campaign state
  const [roundIndex, setRoundIndex] = useState(0);
  const [campaignResults, setCampaignResults] = useState<RoundResult[]>([]);
  const [streak, setStreak] = useState(0);
  const [bestRecord, setBestRecord] = useState<BestRecord | null>(() => loadBestCampaign());

  // Free play config
  const [freeObjectId, setFreeObjectId] = useState<string>('baguette');
  const [freeTargetParts, setFreeTargetParts] = useState<number>(3);
  const [freeRoundCounter, setFreeRoundCounter] = useState<number>(1);

  // Active round runtime state
  const [roundNonce, setRoundNonce] = useState<number>(1);
  const [pieceCount, setPieceCount] = useState<number>(1);
  const [currentResult, setCurrentResult] = useState<RoundResult | null>(null);
  const [currentRoundRetries, setCurrentRoundRetries] = useState<number>(0);

  // Per-step helper items (each 1x use per round/step)
  const [usedItems, setUsedItems] = useState<HelperItemId[]>([]);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [undoTrigger, setUndoTrigger] = useState<number>(0);

  // Share & Screenshot state (Final Results)
  const shareTimerRef = useRef<number | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  const activeConfig = useMemo(() => {
    if (mode === 'CAMPAIGN') {
      return CAMPAIGN_ROUNDS[roundIndex] ?? CAMPAIGN_ROUNDS[0];
    }
    return {
      roundNumber: freeRoundCounter,
      objectId: freeObjectId,
      targetParts: freeTargetParts,
    };
  }, [mode, roundIndex, freeRoundCounter, freeObjectId, freeTargetParts]);

  const activeObject = useMemo(
    () => getObjectById(activeConfig.objectId),
    [activeConfig.objectId]
  );

  const totalBaseCampaignScore = useMemo(
    () => campaignResults.reduce((sum, r) => sum + r.score, 0),
    [campaignResults]
  );

  const totalStreakBonus = useMemo(
    () => campaignResults.reduce((sum, r) => sum + (r.streakBonus ?? 0), 0),
    [campaignResults]
  );

  const totalCampaignScore = totalBaseCampaignScore + totalStreakBonus;

  const maxStreakInRun = useMemo(
    () => campaignResults.reduce((max, r) => Math.max(max, r.streakCount ?? 0), 0),
    [campaignResults]
  );

  const totalItemPenaltyInRun = useMemo(
    () => campaignResults.reduce((sum, r) => sum + (r.itemPenalty ?? 0), 0),
    [campaignResults]
  );

  const totalItemsUsedCount = useMemo(
    () => campaignResults.reduce((sum, r) => sum + (r.usedItems?.length ?? 0), 0),
    [campaignResults]
  );

  const totalRetriesInRun = useMemo(
    () => campaignResults.reduce((sum, r) => sum + (r.retryCount ?? 0), 0),
    [campaignResults]
  );

  const totalRetryPenaltyInRun = useMemo(
    () => campaignResults.reduce((sum, r) => sum + (r.retryPenalty ?? 0), 0),
    [campaignResults]
  );

  const handleToggleMute = useCallback(() => {
    const nextMuted = soundEngine.toggleMute();
    setMuted(nextMuted);
    if (!nextMuted) {
      soundEngine.playClick();
    }
  }, []);

  const resetRoundItems = useCallback(() => {
    setUsedItems([]);
    setCanUndo(false);
  }, []);

  const handleUseHelperItem = useCallback(
    (itemId: HelperItemId) => {
      if (gameState !== 'PLAYING') return;
      if (usedItems.includes(itemId)) return;
      if (itemId === 'undo' && !canUndo) return;

      soundEngine.playClick();
      trackHelperItemUsed(itemId);
      setUsedItems((prev) => [...prev, itemId]);
      if (itemId === 'undo') {
        setUndoTrigger((t) => t + 1);
      }
    },
    [gameState, usedItems, canUndo]
  );

  const startCampaign = useCallback(() => {
    soundEngine.playClick();
    trackGameStart('CAMPAIGN');
    setMode('CAMPAIGN');
    setRoundIndex(0);
    setCampaignResults([]);
    setStreak(0);
    setCurrentResult(null);
    setCurrentRoundRetries(0);
    setPieceCount(1);
    resetRoundItems();
    setRoundNonce((n) => n + 1);
    setGameState('PLAYING');
  }, [resetRoundItems]);

  const startFreePlay = useCallback(() => {
    soundEngine.playClick();
    trackGameStart('FREE_PLAY');
    setMode('FREE_PLAY');
    setFreeRoundCounter(1);
    setCurrentResult(null);
    setCurrentRoundRetries(0);
    setPieceCount(1);
    resetRoundItems();
    setRoundNonce((n) => n + 1);
    setGameState('PLAYING');
  }, [resetRoundItems]);

  const handleStartFromTitle = useCallback(() => {
    if (mode === 'CAMPAIGN') {
      startCampaign();
    } else {
      startFreePlay();
    }
  }, [mode, startCampaign, startFreePlay]);

  const handleRoundComplete = useCallback(
    (result: RoundResult) => {
      const itemPenalty = getHelperItemsPenalty(usedItems);
      const retryCount = mode === 'CAMPAIGN' ? currentRoundRetries : 0;
      const retryPenalty = retryCount * RETRY_ROUND_PENALTY;
      const rawScore = result.score;
      const finalScore = Math.max(0, rawScore - itemPenalty - retryPenalty);

      const withPenalties: RoundResult = {
        ...result,
        rawScore,
        itemPenalty,
        usedItems: [...usedItems],
        retryCount,
        retryPenalty,
        score: finalScore,
      };

      trackRoundCompleted({
        mode,
        roundNumber: activeConfig.roundNumber,
        objectId: activeConfig.objectId,
        score: finalScore,
        ratingTier: result.ratingTier,
        avgDeviationPercent: result.avgDeviationPercent,
      });

      if (mode === 'CAMPAIGN') {
        const nextStreak = finalScore > STREAK_SCORE_THRESHOLD ? streak + 1 : 0;
        const streakBonus = calculateStreakBonus(nextStreak);
        const enrichedResult: RoundResult = {
          ...withPenalties,
          streakCount: nextStreak,
          streakBonus,
        };
        setStreak(nextStreak);
        setCurrentResult(enrichedResult);
        setCampaignResults((prev) => {
          const next = [...prev, enrichedResult];
          if (next.length === CAMPAIGN_ROUNDS.length) {
            const totalBase = next.reduce((s, r) => s + r.score, 0);
            const totalBonus = next.reduce((s, r) => s + (r.streakBonus ?? 0), 0);
            const totalWithBonus = totalBase + totalBonus;
            const avgAcc = totalBase / CAMPAIGN_ROUNDS.length;
            const updatedBest = saveBestCampaign(totalWithBonus, avgAcc);
            setBestRecord(updatedBest);

            const rankInfo = getFinalRank(totalBase, CAMPAIGN_ROUNDS.length * 100);
            trackCampaignCompleted({
              totalScore: totalWithBonus,
              grade: rankInfo.grade,
              rankTitle: rankInfo.title,
              maxStreak: Math.max(nextStreak, streak),
            });
          }
          return next;
        });
      } else {
        setCurrentResult(withPenalties);
      }
      setGameState('ROUND_SUMMARY');
    },
    [mode, streak, usedItems, currentRoundRetries, activeConfig]
  );

  const handleRetryCampaignRound = useCallback(() => {
    soundEngine.playClick();
    setCampaignResults((prev) => {
      const sliced = prev.slice(0, -1);
      const prevStreak = sliced.length > 0 ? (sliced[sliced.length - 1].streakCount ?? 0) : 0;
      setStreak(prevStreak);
      return sliced;
    });
    setCurrentRoundRetries((c) => c + 1);
    setCurrentResult(null);
    setPieceCount(1);
    resetRoundItems();
    setRoundNonce((n) => n + 1);
    setGameState('PLAYING');
  }, [resetRoundItems]);

  const handleNextRound = useCallback(() => {
    soundEngine.playClick();
    if (mode === 'CAMPAIGN') {
      if (roundIndex + 1 >= CAMPAIGN_ROUNDS.length) {
        setGameState('GAME_OVER');
        return;
      }
      setRoundIndex((i) => i + 1);
      setCurrentResult(null);
      setCurrentRoundRetries(0);
      setPieceCount(1);
      resetRoundItems();
      setRoundNonce((n) => n + 1);
      setGameState('PLAYING');
    } else {
      setFreeRoundCounter((c) => c + 1);
      setCurrentResult(null);
      setCurrentRoundRetries(0);
      setPieceCount(1);
      resetRoundItems();
      setRoundNonce((n) => n + 1);
      setGameState('PLAYING');
    }
  }, [mode, roundIndex, resetRoundItems]);

  const handleFreePlayShuffleNext = useCallback(() => {
    soundEngine.playClick();
    const otherObjects = CULINARY_OBJECTS.filter((o) => o.id !== freeObjectId);
    const randomObj = otherObjects[Math.floor(Math.random() * otherObjects.length)] ?? CULINARY_OBJECTS[0];
    const nextParts = randomObj.shape === 'round' ? (Math.random() > 0.45 ? 4 : 2) : 2 + Math.floor(Math.random() * 4);
    setFreeObjectId(randomObj.id);
    setFreeTargetParts(nextParts);
    setFreeRoundCounter((c) => c + 1);
    setCurrentResult(null);
    setCurrentRoundRetries(0);
    setPieceCount(1);
    resetRoundItems();
    setRoundNonce((n) => n + 1);
    setGameState('PLAYING');
  }, [freeObjectId, resetRoundItems]);

  const handleRetryFreeRound = useCallback(() => {
    soundEngine.playClick();
    setCurrentResult(null);
    setPieceCount(1);
    resetRoundItems();
    setRoundNonce((n) => n + 1);
    setGameState('PLAYING');
  }, [resetRoundItems]);

  const handleBackToTitle = useCallback(() => {
    soundEngine.playClick();
    setCurrentResult(null);
    setGameState('TITLE_MENU');
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') {
        handleToggleMute();
        return;
      }

      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (gameState === 'PLAYING') {
          setGameState('PAUSED');
        } else if (gameState === 'PAUSED') {
          setGameState('PLAYING');
        }
        return;
      }

      if (e.key === 'Enter' || e.key === ' ') {
        if (gameState === 'TITLE_MENU') {
          const activeTag = document.activeElement?.tagName;
          if (activeTag !== 'SELECT' && activeTag !== 'BUTTON') {
            e.preventDefault();
            handleStartFromTitle();
          }
        } else if (gameState === 'ROUND_SUMMARY') {
          e.preventDefault();
          handleNextRound();
        } else if (gameState === 'GAME_OVER') {
          e.preventDefault();
          startCampaign();
        }
      }

      if ((e.key === 'r' || e.key === 'R') && mode === 'FREE_PLAY' && (gameState === 'PLAYING' || gameState === 'ROUND_SUMMARY')) {
        handleRetryFreeRound();
      }

      if (gameState === 'PLAYING') {
        if (e.key === '1') {
          handleUseHelperItem('grid');
        } else if (e.key === '2') {
          handleUseHelperItem('straight');
        } else if (e.key === 'z' || e.key === 'Z') {
          handleUseHelperItem('undo');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    gameState,
    mode,
    handleToggleMute,
    handleStartFromTitle,
    handleNextRound,
    startCampaign,
    handleRetryFreeRound,
    handleUseHelperItem,
  ]);

  const remainingCuts = Math.max(0, activeConfig.targetParts - pieceCount);
  const maxCampaignScore = CAMPAIGN_ROUNDS.length * 100;
  const finalRank = getFinalRank(totalBaseCampaignScore, maxCampaignScore);

  const showShareNotice = useCallback((msg: string) => {
    setShareNotice(msg);
    if (shareTimerRef.current !== null) {
      window.clearTimeout(shareTimerRef.current);
    }
    shareTimerRef.current = window.setTimeout(() => {
      setShareNotice(null);
    }, 2800);
  }, []);

  useEffect(() => {
    setShareNotice(null);
  }, [gameState, roundNonce]);

  const handleShareCampaign = useCallback(
    async (action: 'share' | 'download') => {
      if (isSharing || campaignResults.length === 0) return;
      soundEngine.playClick();
      setIsSharing(true);
      try {
        const blob = await generateCampaignShareBlob({
          results: campaignResults,
          totalScore: totalCampaignScore,
          baseScore: totalBaseCampaignScore,
          streakBonus: totalStreakBonus,
          maxStreak: maxStreakInRun,
          rank: finalRank,
        });
        const filename = `iris-presisi-hasil-${totalCampaignScore}.png`;
        trackShareOutcome(action, totalCampaignScore);
        if (action === 'download') {
          downloadBlobAsPng(blob, filename);
          showShareNotice('Screenshot hasil akhir tersimpan!');
        } else {
          const outcome = await shareResultImage({
            blob,
            filename,
            title: `Iris Presisi · ${finalRank.title} (${totalCampaignScore} poin)`,
            text: `Peringkat ${finalRank.grade} (${finalRank.title}) dengan skor ${totalCampaignScore} dan streak terbaik ${maxStreakInRun}x di Iris Presisi!`,
          });
          if (outcome === 'shared') showShareNotice('Hasil berhasil dibagikan!');
          else if (outcome === 'copied_and_downloaded') showShareNotice('Gambar disalin & diunduh!');
          else if (outcome === 'downloaded') showShareNotice('Screenshot hasil diunduh!');
        }
      } catch {
        showShareNotice('Gagal membuat gambar.');
      } finally {
        setIsSharing(false);
      }
    },
    [
      isSharing,
      campaignResults,
      totalCampaignScore,
      totalBaseCampaignScore,
      totalStreakBonus,
      maxStreakInRun,
      finalRank,
      showShareNotice,
    ]
  );

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden drafting-grid text-[#18181B]">
      {/* TITLE SCREEN */}
      {gameState === 'TITLE_MENU' && (
        <main className="relative w-full h-full flex flex-col items-center justify-center px-4 py-6">
          {/* Illustrated key-art backdrop */}
          {!backdropFailed && (
            <img
              src={TITLE_BACKDROP_SRC}
              alt="Ilustrasi outline roti, wortel, timun, keju, dan pisau dapur"
              referrerPolicy="no-referrer"
              onError={() => setBackdropFailed(true)}
              className="pointer-events-none select-none absolute inset-0 w-full h-full object-cover opacity-90"
            />
          )}

          {/* Calm centered surface over backdrop negative space */}
          <div className="relative z-10 w-full max-w-[460px] ink-card rounded-2xl px-6 py-7 sm:px-8 sm:py-8 flex flex-col items-center gap-5">
            <TitleLockup />

            <p className="text-sm sm:text-[15px] text-zinc-600 text-center leading-relaxed max-w-[36ch] text-balance">
              Potong roti, sayuran, dan beragam benda menjadi bagian sama rata dengan ketajaman mata dan tangan.
            </p>

            {/* Mode switcher */}
            <div className="w-full flex items-center gap-1.5 p-1 bg-[#F4F6F8] border-2 border-[#18181B] rounded-xl">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setMode('CAMPAIGN');
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                  mode === 'CAMPAIGN'
                    ? 'bg-[#18181B] text-white'
                    : 'text-zinc-700 hover:text-[#18181B]'
                }`}
              >
                Tantangan 10 Ronde
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setMode('FREE_PLAY');
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                  mode === 'FREE_PLAY'
                    ? 'bg-[#18181B] text-white'
                    : 'text-zinc-700 hover:text-[#18181B]'
                }`}
              >
                Latihan Bebas
              </button>
            </div>

            {/* Free play configuration */}
            {mode === 'FREE_PLAY' && (
              <div className="w-full flex flex-col gap-3 pt-1">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="free-object-select" className="text-xs font-semibold text-zinc-700 whitespace-nowrap">
                    Pilih Benda
                  </label>
                  <select
                    id="free-object-select"
                    value={freeObjectId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setFreeObjectId(nextId);
                      const def = getObjectById(nextId);
                      if (def.shape === 'round' && freeTargetParts > 4) {
                        setFreeTargetParts(4);
                      }
                    }}
                    className="flex-1 max-w-[230px] h-10 px-3 text-sm font-medium bg-white border-2 border-[#18181B] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
                  >
                    {CULINARY_OBJECTS.map((obj) => (
                      <option key={obj.id} value={obj.id}>
                        {obj.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-zinc-700 whitespace-nowrap">
                    Target Potongan
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[2, 3, 4, 5, 6].map((num) => {
                      const isRound = getObjectById(freeObjectId).shape === 'round';
                      const disabled = isRound && num > 4;
                      return (
                        <button
                          key={num}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            soundEngine.playClick();
                            setFreeTargetParts(num);
                          }}
                          className={`w-9 h-9 rounded-lg text-sm font-mono font-bold border-2 transition-colors ${
                            disabled
                              ? 'border-zinc-200 text-zinc-300 cursor-not-allowed bg-zinc-50'
                              : freeTargetParts === num
                                ? 'bg-[#E11D48] text-white border-[#18181B]'
                                : 'bg-white text-[#18181B] border-[#18181B] hover:bg-zinc-100'
                          }`}
                        >
                          {num}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Primary Start CTA */}
            <button
              type="button"
              onClick={handleStartFromTitle}
              className="w-full ink-btn-primary rounded-xl py-3 px-6 text-base font-bold flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Mulai Bermain</span>
            </button>

            {/* Unboxed Best Record & Mute row */}
            <div className="w-full flex items-center justify-between text-xs text-zinc-600 pt-1 border-t border-zinc-200">
              <div className="flex items-center gap-1.5 tabular-nums">
                {bestRecord ? (
                  <>
                    <span>Rekor: {bestRecord.score} poin</span>
                    <span aria-hidden="true">·</span>
                    <span>Rata-rata {bestRecord.avgAccuracy.toFixed(1)}%</span>
                  </>
                ) : (
                  <span>Target: 100 poin per benda</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleToggleMute}
                aria-label={muted ? 'Nyalakan suara' : 'Matikan suara'}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 hover:text-[#18181B] py-1 px-2 rounded-md"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                <span>{muted ? 'Bisu' : 'Suara'}</span>
              </button>
            </div>
          </div>

          {/* Single flat control hint line */}
          <p className="relative z-10 mt-4 text-xs text-zinc-600 font-medium text-center">
            Klik &amp; seret melintasi benda untuk memotong · Enter mulai · M suara
          </p>
        </main>
      )}

      {/* ACTIVE PLAYFIELD & HUD */}
      {gameState !== 'TITLE_MENU' && (
        <div className="relative w-full h-full">
          {/* Isolated 60fps Canvas */}
          <SliceCanvas
            roundKey={`${mode}-${roundNonce}-${activeConfig.roundNumber}-${activeConfig.objectId}`}
            roundNumber={activeConfig.roundNumber}
            objectId={activeConfig.objectId}
            targetParts={activeConfig.targetParts}
            gameState={gameState}
            roundResult={currentResult}
            gridActive={usedItems.includes('grid')}
            straightSnapActive={usedItems.includes('straight')}
            undoTrigger={undoTrigger}
            onPieceCountChange={setPieceCount}
            onCanUndoChange={setCanUndo}
            onRoundComplete={handleRoundComplete}
          />

          {/* Top Low-Occlusion HUD (pointer-events-none wrapper) */}
          <header className="pointer-events-none absolute top-0 left-0 right-0 z-20 flex items-start justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
            {/* Left Cluster: Round & Task */}
            <div className="pointer-events-auto bg-white/95 border-2 border-[#18181B] rounded-xl px-3.5 py-2 shadow-[3px_3px_0_#18181B] flex flex-col gap-0.5 max-w-[66vw]">
              <div className="flex items-center gap-2 text-xs text-zinc-600 font-medium">
                <span className="font-mono font-bold text-[#18181B] tabular-nums">
                  {mode === 'CAMPAIGN'
                    ? `Ronde ${activeConfig.roundNumber} / ${CAMPAIGN_ROUNDS.length}`
                    : `Latihan #${activeConfig.roundNumber}`}
                </span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{activeObject.name}</span>
                {mode === 'CAMPAIGN' && currentRoundRetries > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono font-semibold text-amber-700 tabular-nums whitespace-nowrap">
                      Ulang {currentRoundRetries}x (-{currentRoundRetries * RETRY_ROUND_PENALTY})
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-sm sm:text-base font-bold text-[#18181B] font-[family-name:var(--font-display)] whitespace-nowrap">
                  Potong menjadi {activeConfig.targetParts} bagian
                </h1>
                <span className="text-xs font-mono font-semibold text-[#E11D48] tabular-nums whitespace-nowrap">
                  {remainingCuts > 0 ? `(${remainingCuts} potong lagi)` : '(Selesai)'}
                </span>
              </div>
            </div>

            {/* Right Cluster: Score + Controls */}
            <div className="pointer-events-auto flex items-center gap-2">
              {mode === 'CAMPAIGN' && (
                <>
                  {/* Combo / Streak Indicator */}
                  <div
                    className={`border-2 border-[#18181B] rounded-xl px-3 py-2 shadow-[3px_3px_0_#18181B] flex items-center gap-2 transition-colors ${
                      streak >= 2
                        ? 'bg-amber-50'
                        : streak === 1
                          ? 'bg-emerald-50/90'
                          : 'bg-white/95'
                    }`}
                    title="Skor di atas 90 berturut-turut untuk bonus combo"
                  >
                    <Flame
                      className={`w-4 h-4 shrink-0 ${
                        streak >= 2
                          ? 'text-[#E11D48] fill-[#F59E0B]'
                          : streak === 1
                            ? 'text-emerald-600'
                            : 'text-zinc-400'
                      }`}
                    />
                    <div className="text-left">
                      <div className="text-[11px] font-medium text-zinc-500 leading-none">
                        Combo
                      </div>
                      <div className="flex items-baseline gap-1 mt-0.5 leading-tight">
                        <span
                          className={`text-base sm:text-lg font-mono font-bold tabular-nums ${
                            streak >= 2
                              ? 'text-[#E11D48]'
                              : streak === 1
                                ? 'text-emerald-700'
                                : 'text-zinc-500'
                          }`}
                        >
                          {streak}x
                        </span>
                        {streak >= 2 && (
                          <span className="text-[11px] font-mono font-bold text-amber-700 tabular-nums">
                            +{calculateStreakBonus(streak)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Total Score */}
                  <div className="bg-white/95 border-2 border-[#18181B] rounded-xl px-3.5 py-2 shadow-[3px_3px_0_#18181B] text-right">
                    <div className="text-[11px] font-medium text-zinc-500 leading-none">Skor</div>
                    <div className="text-base sm:text-lg font-mono font-bold text-[#18181B] tabular-nums leading-tight mt-0.5">
                      {totalCampaignScore}
                    </div>
                  </div>
                </>
              )}

              {mode === 'FREE_PLAY' && gameState === 'PLAYING' && (
                <button
                  type="button"
                  onClick={handleRetryFreeRound}
                  aria-label="Ulangi potongan"
                  title="Ulangi (R)"
                  className="w-11 h-11 ink-btn-secondary rounded-xl flex items-center justify-center"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={handleToggleMute}
                aria-label={muted ? 'Nyalakan suara' : 'Matikan suara'}
                title="Suara (M)"
                className="w-11 h-11 ink-btn-secondary rounded-xl flex items-center justify-center"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setGameState('PAUSED');
                }}
                aria-label="Jeda permainan"
                title="Jeda (Esc)"
                className="w-11 h-11 ink-btn-secondary rounded-xl flex items-center justify-center"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Bottom Helper Items Bar & Hint while Playing */}
          {gameState === 'PLAYING' && (
            <div className="pointer-events-none absolute bottom-3 left-0 right-0 z-20 flex flex-col items-center gap-2 px-4">
              {/* 1x-per-step Helper Items */}
              <div className="pointer-events-auto flex items-center gap-2 bg-white/95 border-2 border-[#18181B] rounded-xl px-2.5 py-1.5 shadow-[3px_3px_0_#18181B]">
                {HELPER_ITEMS.map((item) => {
                  const isUsed = usedItems.includes(item.id);
                  const isUndoDisabled = item.id === 'undo' && !canUndo;
                  const disabled = isUsed || isUndoDisabled;
                  const Icon =
                    item.id === 'grid' ? Grid3x3 : item.id === 'undo' ? Undo2 : MoveDiagonal;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleUseHelperItem(item.id)}
                      title={`${item.shortDesc} (-${item.penalty} poin · 1x per ronde)`}
                      className={`h-9 px-2.5 sm:px-3 rounded-lg border-2 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                        isUsed
                          ? item.id === 'undo'
                            ? 'bg-zinc-100 border-zinc-300 text-zinc-400 cursor-not-allowed'
                            : 'bg-blue-50 border-blue-600 text-blue-700 cursor-default'
                          : isUndoDisabled
                            ? 'bg-zinc-50 border-zinc-200 text-zinc-300 cursor-not-allowed'
                            : 'bg-white border-[#18181B] text-[#18181B] hover:bg-zinc-100'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{item.name}</span>
                      <span
                        className={`font-mono text-[11px] tabular-nums ${
                          isUsed
                            ? item.id === 'undo'
                              ? 'text-zinc-400'
                              : 'text-blue-700'
                            : isUndoDisabled
                              ? 'text-zinc-300'
                              : 'text-[#E11D48]'
                        }`}
                      >
                        {isUsed ? (item.id === 'undo' ? 'Terpakai' : 'Aktif') : `-${item.penalty}`}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] sm:text-xs text-zinc-600 font-medium bg-white/85 px-3 py-1 rounded-lg border border-zinc-300 text-center">
                {activeConfig.hint ?? 'Klik & seret melintasi benda untuk memotong · Item bantuan 1x/ronde (-poin)'}
              </p>
            </div>
          )}

          {/* Non-Blocking Bottom Inspection Card for Round Summary */}
          {gameState === 'ROUND_SUMMARY' && currentResult && (
            <div className="pointer-events-none absolute bottom-3 sm:bottom-5 left-0 right-0 z-30 flex justify-center px-4">
              <div className="pointer-events-auto w-full max-w-[680px] ink-card rounded-2xl px-4 py-3.5 sm:px-6 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-5">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  {/* Score readout */}
                  <div className="flex flex-col items-center justify-center min-w-[74px] py-1.5 px-3 bg-[#F4F6F8] border-2 border-[#18181B] rounded-xl">
                    <span className="text-[11px] font-semibold text-zinc-500">Skor</span>
                    <span
                      className={`text-2xl font-mono font-bold tabular-nums leading-tight ${
                        currentResult.score >= 95
                          ? 'text-emerald-700'
                          : currentResult.score >= 80
                            ? 'text-blue-700'
                            : 'text-[#E11D48]'
                      }`}
                    >
                      {currentResult.score}
                    </span>
                  </div>

                  {/* Rating & Deviation & Item Notes */}
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 ${
                          currentResult.ratingTier === 'S'
                            ? 'text-emerald-600'
                            : currentResult.ratingTier === 'A'
                              ? 'text-blue-600'
                              : 'text-amber-600'
                        }`}
                      />
                      <span className="text-base font-bold text-[#18181B] font-[family-name:var(--font-display)]">
                        {currentResult.ratingLabel}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-600 tabular-nums flex flex-wrap items-center gap-x-2">
                      <span>Ideal {(100 / currentResult.targetParts).toFixed(1)}% / bagian</span>
                      <span aria-hidden="true">·</span>
                      <span>Selisih ±{currentResult.avgDeviationPercent.toFixed(1)}%</span>
                      {mode === 'CAMPAIGN' && (currentResult.streakBonus ?? 0) > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-bold text-amber-700">
                            +{currentResult.streakBonus} Bonus Streak ({currentResult.streakCount}x)
                          </span>
                        </>
                      )}
                      {mode === 'CAMPAIGN' && currentResult.streakCount === 1 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-emerald-700">
                            Streak 1x (1 ronde lagi &gt;90 untuk bonus)
                          </span>
                        </>
                      )}
                    </div>
                    {((currentResult.usedItems && currentResult.usedItems.length > 0) ||
                      (currentResult.retryCount ?? 0) > 0) && (
                      <div className="text-xs font-medium text-amber-800 tabular-nums">
                        Catatan:{' '}
                        {[
                          (currentResult.retryCount ?? 0) > 0
                            ? `Ulang ronde ${currentResult.retryCount}x (-${currentResult.retryPenalty})`
                            : null,
                          currentResult.usedItems && currentResult.usedItems.length > 0
                            ? `Item ${currentResult.usedItems.map(getHelperItemName).join(', ')} (-${currentResult.itemPenalty})`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}{' '}
                        (Dasar {currentResult.rawScore})
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                  {mode === 'FREE_PLAY' ? (
                    <>
                      <button
                        type="button"
                        onClick={handleRetryFreeRound}
                        className="ink-btn-secondary rounded-xl py-2.5 px-3.5 text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Ulangi</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleFreePlayShuffleNext}
                        className="ink-btn-primary rounded-xl py-2.5 px-4 text-sm font-bold flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Shuffle className="w-4 h-4" />
                        <span>Benda Acak</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleRetryCampaignRound}
                        title={`Ulangi ronde ini dengan penalti -${RETRY_ROUND_PENALTY} poin`}
                        className="ink-btn-secondary rounded-xl py-2.5 px-3.5 text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Ulangi</span>
                        <span className="font-mono text-xs text-[#E11D48]">-{RETRY_ROUND_PENALTY}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleNextRound}
                        className="ink-btn-primary rounded-xl py-2.5 px-5 text-sm font-bold whitespace-nowrap"
                      >
                        {roundIndex + 1 >= CAMPAIGN_ROUNDS.length
                          ? 'Lihat Hasil Akhir'
                          : 'Ronde Berikutnya'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PAUSE MODAL */}
          {gameState === 'PAUSED' && (
            <div className="absolute inset-0 z-40 bg-zinc-900/35 flex items-center justify-center px-4">
              <div className="w-full max-w-[360px] ink-card rounded-2xl p-6 flex flex-col gap-4 text-center">
                <h2 className="text-2xl font-bold font-[family-name:var(--font-display)]">
                  Permainan Dijeda
                </h2>
                <p className="text-sm text-zinc-600">
                  {mode === 'CAMPAIGN'
                    ? `Ronde ${activeConfig.roundNumber} dari ${CAMPAIGN_ROUNDS.length} · ${activeObject.name}`
                    : `Latihan Bebas · ${activeObject.name}`}
                </p>

                <div className="flex flex-col gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setGameState('PLAYING');
                    }}
                    className="w-full ink-btn-primary rounded-xl py-2.5 px-4 text-sm font-bold"
                  >
                    Lanjutkan
                  </button>
                  <button
                    type="button"
                    onClick={mode === 'CAMPAIGN' ? startCampaign : handleRetryFreeRound}
                    className="w-full ink-btn-secondary rounded-xl py-2.5 px-4 text-sm font-semibold"
                  >
                    {mode === 'CAMPAIGN' ? 'Ulangi Dari Ronde 1' : 'Ulangi Benda Ini'}
                  </button>
                  <button
                    type="button"
                    onClick={handleBackToTitle}
                    className="w-full py-2 px-4 text-sm font-semibold text-zinc-600 hover:text-[#18181B]"
                  >
                    Kembali ke Menu Utama
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* GAME OVER / CAMPAIGN SUMMARY MODAL */}
          {gameState === 'GAME_OVER' && (
            <div className="absolute inset-0 z-40 bg-zinc-900/40 flex items-center justify-center px-4 py-4">
              <div className="w-full max-w-[560px] max-h-[90dvh] ink-card rounded-2xl p-6 sm:p-7 flex flex-col gap-5 overflow-y-auto">
                <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
                      <Award className="w-4 h-4 text-[#E11D48]" />
                      <span>Tantangan Selesai · 10 Ronde</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold font-[family-name:var(--font-display)] mt-1">
                      {finalRank.title}
                    </h2>
                  </div>
                  <div className="flex flex-col items-center justify-center w-16 h-16 bg-[#F4F6F8] border-2 border-[#18181B] rounded-xl shrink-0">
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase">Peringkat</span>
                    <span className="text-2xl font-mono font-bold text-[#E11D48]">{finalRank.grade}</span>
                  </div>
                </div>

                {/* Aggregate Stats */}
                <div className="grid grid-cols-3 gap-3 py-1">
                  <div>
                    <div className="text-xs text-zinc-500 font-medium">Total Skor</div>
                    <div className="text-2xl sm:text-3xl font-mono font-bold tabular-nums text-[#18181B]">
                      {totalCampaignScore}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 font-medium">Rata-rata Presisi</div>
                    <div className="text-2xl sm:text-3xl font-mono font-bold tabular-nums text-emerald-700">
                      {(totalBaseCampaignScore / CAMPAIGN_ROUNDS.length).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 font-medium">Streak Terbaik</div>
                    <div className="text-2xl sm:text-3xl font-mono font-bold tabular-nums text-amber-700">
                      {maxStreakInRun}x
                      {totalStreakBonus > 0 && (
                        <span className="block text-xs font-semibold text-zinc-500">
                          +{totalStreakBonus} bonus
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Catatan Penalti (Item Bantuan & Ulang Ronde) */}
                <div
                  className={`text-xs font-medium px-3.5 py-2 rounded-lg border tabular-nums ${
                    totalItemPenaltyInRun > 0 || totalRetryPenaltyInRun > 0
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  }`}
                >
                  {totalItemPenaltyInRun > 0 || totalRetryPenaltyInRun > 0
                    ? `Catatan Penalti: ${[
                        totalItemsUsedCount > 0
                          ? `Item bantuan ${totalItemsUsedCount}x (-${totalItemPenaltyInRun})`
                          : null,
                        totalRetriesInRun > 0
                          ? `Ulang ronde ${totalRetriesInRun}x (-${totalRetryPenaltyInRun})`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')} poin.`
                    : 'Catatan: Tanpa item bantuan & tanpa ulang ronde (Murni Presisi).'}
                </div>

                {/* Per-Round Breakdown (clean hairline list, zero nested cards) */}
                <div className="border-t border-b border-zinc-200 divide-y divide-zinc-100 max-h-[240px] overflow-y-auto">
                  {campaignResults.map((res) => (
                    <div
                      key={res.roundNumber}
                      className="flex items-center justify-between py-2 text-sm gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-xs font-bold text-zinc-400 w-5 tabular-nums">
                          {String(res.roundNumber).padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#18181B] truncate">
                              {res.objectName}
                            </span>
                            <span className="text-xs text-zinc-500 whitespace-nowrap">
                              {res.targetParts} bagian
                            </span>
                          </div>
                          {((res.retryCount ?? 0) > 0 || (res.usedItems && res.usedItems.length > 0)) && (
                            <div className="text-[11px] text-amber-800 font-medium tabular-nums">
                              {[
                                (res.retryCount ?? 0) > 0
                                  ? `Ulang ${res.retryCount}x (-${res.retryPenalty})`
                                  : null,
                                res.usedItems && res.usedItems.length > 0
                                  ? `Item: ${res.usedItems.map(getHelperItemName).join(', ')} (-${res.itemPenalty})`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 tabular-nums">
                        {(res.streakBonus ?? 0) > 0 && (
                          <span className="text-xs font-mono font-semibold text-amber-700">
                            +{res.streakBonus}
                          </span>
                        )}
                        <span className="text-xs text-zinc-500">
                          ±{res.avgDeviationPercent.toFixed(1)}%
                        </span>
                        <span
                          className={`font-mono font-bold w-9 text-right ${
                            res.score >= 95
                              ? 'text-emerald-700'
                              : res.score >= 80
                                ? 'text-blue-700'
                                : 'text-[#E11D48]'
                          }`}
                        >
                          {res.score}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Share Notice */}
                {shareNotice && (
                  <div className="text-center text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg py-2 px-3">
                    {shareNotice}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-2.5 pt-1">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      disabled={isSharing}
                      onClick={() => handleShareCampaign('share')}
                      className="flex-1 ink-btn-secondary rounded-xl py-2.5 px-4 text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Bagikan Hasil</span>
                    </button>
                    <button
                      type="button"
                      disabled={isSharing}
                      onClick={() => handleShareCampaign('download')}
                      className="ink-btn-secondary rounded-xl py-2.5 px-4 text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <Download className="w-4 h-4" />
                      <span>Screenshot</span>
                    </button>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-2.5">
                    <button
                      type="button"
                      onClick={startCampaign}
                      className="w-full sm:flex-1 ink-btn-primary rounded-xl py-3 px-5 text-sm font-bold whitespace-nowrap"
                    >
                      Main Lagi
                    </button>
                    <button
                      type="button"
                      onClick={handleBackToTitle}
                      className="w-full sm:w-auto ink-btn-secondary rounded-xl py-3 px-5 text-sm font-semibold whitespace-nowrap"
                    >
                      Menu Utama
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
