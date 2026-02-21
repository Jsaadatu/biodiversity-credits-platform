;; ============================================================================
;; STAKING & REWARDS CONTRACT
;; ============================================================================
;; Purpose: Enable biodiversity credit holders to stake their credits and 
;;          earn STX rewards proportional to the quantity staked and the 
;;          duration of the staking period. This incentivizes long-term 
;;          holding and active ecosystem participation.
;;
;; Key Features:
;;   - Stake verified credits with a configurable lock period
;;   - Earn time-weighted STX rewards funded by the platform treasury
;;   - Unstake after the lock period expires to reclaim credits
;;   - Early unstake with a penalty fee that is redirected to the treasury
;;   - Admin controls: set reward rate, fund treasury, pause staking
;;   - Full query suite for positions, pending rewards, and platform stats
;;
;; Architecture Notes:
;;   - Error codes in the 500-599 range to avoid collision with other contracts
;;   - Designed to be independent; references registry ownership conceptually
;;   - Reward rate is expressed per-block, per-credit-unit (in microSTX)
;;   - Lock period is measured in Stacks blocks (~10 min each)
;; ============================================================================

;; ============================================================================
;; ERROR CODES (500-599)
;; ============================================================================

(define-constant ERR-NOT-AUTHORIZED (err u500))
(define-constant ERR-STAKE-NOT-FOUND (err u501))
(define-constant ERR-INVALID-CREDIT-ID (err u502))
(define-constant ERR-INVALID-QUANTITY (err u503))
(define-constant ERR-ALREADY-STAKED (err u504))
(define-constant ERR-LOCK-NOT-EXPIRED (err u505))
(define-constant ERR-NO-REWARDS (err u506))
(define-constant ERR-INSUFFICIENT-TREASURY (err u507))
(define-constant ERR-STAKING-PAUSED (err u508))
(define-constant ERR-INVALID-RATE (err u509))
(define-constant ERR-INVALID-LOCK-PERIOD (err u510))
(define-constant ERR-ALREADY-UNSTAKED (err u511))
(define-constant ERR-TREASURY-DEPOSIT-FAILED (err u512))

;; ============================================================================
;; CONSTANTS
;; ============================================================================

(define-constant CONTRACT-OWNER tx-sender)

;; Lock period bounds (in blocks; ~10 min per block)
(define-constant MIN-LOCK-BLOCKS u144)     ;; ~1 day
(define-constant MAX-LOCK-BLOCKS u52560)   ;; ~365 days

;; Early-unstake penalty: 10 % of pending rewards are forfeited
(define-constant EARLY-UNSTAKE-PENALTY-BPS u1000) ;; 10 % in basis points

;; Stake status enumeration
(define-constant STAKE-STATUS-ACTIVE u0)
(define-constant STAKE-STATUS-UNSTAKED u1)

;; ============================================================================
;; DATA VARIABLES
;; ============================================================================

;; Auto-incrementing stake ID
(define-data-var stake-id-nonce uint u0)

;; Reward rate in microSTX per credit-unit per block
;; Example: u10 means each staked credit earns 10 microSTX per block
(define-data-var reward-rate-per-block uint u10)

;; Platform treasury balance available for reward payouts (microSTX)
(define-data-var treasury-balance uint u0)

;; Global pause flag -- when true no new stakes or claims are allowed
(define-data-var staking-paused bool false)

;; Platform-wide totals
(define-data-var total-staked-credits uint u0)
(define-data-var total-active-stakes uint u0)
(define-data-var total-rewards-distributed uint u0)

;; ============================================================================
;; DATA MAPS
;; ============================================================================

;; Primary stake record (stake-id -> details)
(define-map stakes
  uint ;; stake-id
  {
    staker: principal,
    credit-id: uint,
    quantity: uint,
    start-block: uint,
    lock-until-block: uint,
    status: uint,
    rewards-claimed: uint,
    last-claim-block: uint
  }
)

;; Tracks whether a credit-id is currently staked (prevents double-staking)
(define-map credit-staked
  uint ;; credit-id
  uint ;; stake-id
)

;; Staker -> list of their stake-ids
(define-map staker-stakes
  principal
  (list 100 uint)
)

;; ============================================================================
;; READ-ONLY FUNCTIONS
;; ============================================================================

;; Get stake record by ID
;; @param stake-id: Unique stake identifier
;; @returns: Stake details tuple or none
(define-read-only (get-stake (stake-id uint))
  (map-get? stakes stake-id)
)

;; Get all stake IDs for a given staker
;; @param staker: Principal address
;; @returns: List of stake IDs
(define-read-only (get-staker-stakes (staker principal))
  (default-to (list) (map-get? staker-stakes staker))
)

;; Check whether a credit is currently staked
;; @param credit-id: Credit identifier
;; @returns: true if staked, false otherwise
(define-read-only (is-credit-staked (credit-id uint))
  (is-some (map-get? credit-staked credit-id))
)

;; Calculate pending (unclaimed) rewards for a stake
;; Rewards = (current-block - last-claim-block) * quantity * reward-rate
;; @param stake-id: Stake identifier
;; @returns: Pending reward amount in microSTX, or u0 if not found
(define-read-only (get-pending-rewards (stake-id uint))
  (match (map-get? stakes stake-id)
    stake
      (if (is-eq (get status stake) STAKE-STATUS-ACTIVE)
        (let
          (
            (blocks-elapsed (- stacks-block-height (get last-claim-block stake)))
            (rate (var-get reward-rate-per-block))
          )
          (* (* blocks-elapsed (get quantity stake)) rate)
        )
        u0
      )
    u0
  )
)

;; Get current reward rate
;; @returns: Reward rate in microSTX per credit-unit per block
(define-read-only (get-reward-rate)
  (var-get reward-rate-per-block)
)

;; Get treasury balance
;; @returns: Available treasury balance in microSTX
(define-read-only (get-treasury-balance)
  (var-get treasury-balance)
)

;; Get current stake nonce
;; @returns: Next stake ID that will be assigned
(define-read-only (get-stake-nonce)
  (var-get stake-id-nonce)
)

;; Check whether staking is paused
;; @returns: true when paused
(define-read-only (is-staking-paused)
  (var-get staking-paused)
)

;; Get platform-wide staking statistics
;; @returns: Tuple with totals
(define-read-only (get-staking-stats)
  {
    total-staked-credits: (var-get total-staked-credits),
    total-active-stakes: (var-get total-active-stakes),
    total-rewards-distributed: (var-get total-rewards-distributed),
    treasury-balance: (var-get treasury-balance),
    reward-rate: (var-get reward-rate-per-block),
    is-paused: (var-get staking-paused)
  }
)

;; Check whether a stake's lock period has expired
;; @param stake-id: Stake identifier
;; @returns: true if expired or stake not found, false if still locked
(define-read-only (is-lock-expired (stake-id uint))
  (match (map-get? stakes stake-id)
    stake (>= stacks-block-height (get lock-until-block stake))
    true
  )
)

;; ============================================================================
;; PUBLIC FUNCTIONS
;; ============================================================================

;; Stake a credit for a given lock period
;; The credit must not already be staked. Staking is conceptual -- no actual
;; token transfer occurs, but the credit-id is marked as locked.
;; @param credit-id: Credit identifier to stake
;; @param quantity: Number of credit units to stake
;; @param lock-blocks: How many blocks the credit stays locked
;; @returns: New stake ID on success
(define-public (stake-credit
    (credit-id uint)
    (quantity uint)
    (lock-blocks uint)
  )
  (let
    (
      (staker tx-sender)
      (new-stake-id (var-get stake-id-nonce))
      (lock-until (+ stacks-block-height lock-blocks))
    )

    ;; Guard: staking must not be paused
    (asserts! (not (var-get staking-paused)) ERR-STAKING-PAUSED)

    ;; Guard: credit-id must be positive
    (asserts! (> credit-id u0) ERR-INVALID-CREDIT-ID)

    ;; Guard: quantity must be positive
    (asserts! (> quantity u0) ERR-INVALID-QUANTITY)

    ;; Guard: lock period within bounds
    (asserts! (and (>= lock-blocks MIN-LOCK-BLOCKS) (<= lock-blocks MAX-LOCK-BLOCKS))
      ERR-INVALID-LOCK-PERIOD)

    ;; Guard: credit not already staked
    (asserts! (not (is-credit-staked credit-id)) ERR-ALREADY-STAKED)

    ;; Create stake record
    (map-set stakes new-stake-id
      {
        staker: staker,
        credit-id: credit-id,
        quantity: quantity,
        start-block: stacks-block-height,
        lock-until-block: lock-until,
        status: STAKE-STATUS-ACTIVE,
        rewards-claimed: u0,
        last-claim-block: stacks-block-height
      }
    )

    ;; Mark credit as staked
    (map-set credit-staked credit-id new-stake-id)

    ;; Update staker's list
    (map-set staker-stakes staker
      (unwrap-panic (as-max-len?
        (append (get-staker-stakes staker) new-stake-id)
        u100
      ))
    )

    ;; Update global counters
    (var-set total-staked-credits (+ (var-get total-staked-credits) quantity))
    (var-set total-active-stakes (+ (var-get total-active-stakes) u1))
    (var-set stake-id-nonce (+ new-stake-id u1))

    (ok new-stake-id)
  )
)

;; Claim accrued rewards for an active stake without unstaking
;; Rewards are paid from the platform treasury to the staker in STX.
;; @param stake-id: Stake identifier
;; @returns: Amount of rewards claimed in microSTX
(define-public (claim-rewards (stake-id uint))
  (let
    (
      (stake (unwrap! (map-get? stakes stake-id) ERR-STAKE-NOT-FOUND))
      (staker tx-sender)
      (pending (get-pending-rewards stake-id))
    )

    ;; Guard: staking not paused
    (asserts! (not (var-get staking-paused)) ERR-STAKING-PAUSED)

    ;; Guard: caller must own the stake
    (asserts! (is-eq staker (get staker stake)) ERR-NOT-AUTHORIZED)

    ;; Guard: stake must be active
    (asserts! (is-eq (get status stake) STAKE-STATUS-ACTIVE) ERR-ALREADY-UNSTAKED)

    ;; Guard: there must be rewards to claim
    (asserts! (> pending u0) ERR-NO-REWARDS)

    ;; Guard: treasury has sufficient funds
    (asserts! (>= (var-get treasury-balance) pending) ERR-INSUFFICIENT-TREASURY)

    ;; Transfer rewards from contract deployer (treasury custodian) to staker
    (try! (as-contract (stx-transfer? pending tx-sender staker)))

    ;; Update stake record
    (map-set stakes stake-id
      (merge stake {
        rewards-claimed: (+ (get rewards-claimed stake) pending),
        last-claim-block: stacks-block-height
      })
    )

    ;; Update treasury and stats
    (var-set treasury-balance (- (var-get treasury-balance) pending))
    (var-set total-rewards-distributed (+ (var-get total-rewards-distributed) pending))

    (ok pending)
  )
)

;; Unstake a credit after the lock period has expired
;; Any unclaimed rewards are automatically paid out.
;; @param stake-id: Stake identifier
;; @returns: Tuple with unstaked quantity and rewards paid
(define-public (unstake-credit (stake-id uint))
  (let
    (
      (stake (unwrap! (map-get? stakes stake-id) ERR-STAKE-NOT-FOUND))
      (staker tx-sender)
      (pending (get-pending-rewards stake-id))
    )

    ;; Guard: caller must own the stake
    (asserts! (is-eq staker (get staker stake)) ERR-NOT-AUTHORIZED)

    ;; Guard: stake must be active
    (asserts! (is-eq (get status stake) STAKE-STATUS-ACTIVE) ERR-ALREADY-UNSTAKED)

    ;; Guard: lock period must have expired
    (asserts! (>= stacks-block-height (get lock-until-block stake)) ERR-LOCK-NOT-EXPIRED)

    ;; Pay out any remaining rewards if treasury allows
    (if (and (> pending u0) (>= (var-get treasury-balance) pending))
      (begin
        (try! (as-contract (stx-transfer? pending tx-sender staker)))
        (var-set treasury-balance (- (var-get treasury-balance) pending))
        (var-set total-rewards-distributed (+ (var-get total-rewards-distributed) pending))
        true
      )
      true
    )

    ;; Mark stake as unstaked
    (map-set stakes stake-id
      (merge stake {
        status: STAKE-STATUS-UNSTAKED,
        rewards-claimed: (+ (get rewards-claimed stake) pending),
        last-claim-block: stacks-block-height
      })
    )

    ;; Remove credit lock
    (map-delete credit-staked (get credit-id stake))

    ;; Update global counters
    (var-set total-staked-credits (- (var-get total-staked-credits) (get quantity stake)))
    (var-set total-active-stakes (- (var-get total-active-stakes) u1))

    (ok {
      quantity: (get quantity stake),
      rewards-paid: pending
    })
  )
)

;; Emergency early unstake -- available before the lock period ends
;; A penalty of 10 % of pending rewards is forfeited to the treasury.
;; @param stake-id: Stake identifier
;; @returns: Tuple with unstaked quantity and net rewards after penalty
(define-public (early-unstake (stake-id uint))
  (let
    (
      (stake (unwrap! (map-get? stakes stake-id) ERR-STAKE-NOT-FOUND))
      (staker tx-sender)
      (pending (get-pending-rewards stake-id))
      (penalty (/ (* pending EARLY-UNSTAKE-PENALTY-BPS) u10000))
      (net-rewards (- pending penalty))
    )

    ;; Guard: caller must own the stake
    (asserts! (is-eq staker (get staker stake)) ERR-NOT-AUTHORIZED)

    ;; Guard: stake must be active
    (asserts! (is-eq (get status stake) STAKE-STATUS-ACTIVE) ERR-ALREADY-UNSTAKED)

    ;; Pay out net rewards (after penalty) if treasury allows
    (if (and (> net-rewards u0) (>= (var-get treasury-balance) net-rewards))
      (begin
        (try! (as-contract (stx-transfer? net-rewards tx-sender staker)))
        ;; Deduct only net rewards from treasury; penalty stays
        (var-set treasury-balance (- (var-get treasury-balance) net-rewards))
        (var-set total-rewards-distributed (+ (var-get total-rewards-distributed) net-rewards))
        true
      )
      true
    )

    ;; Mark stake as unstaked
    (map-set stakes stake-id
      (merge stake {
        status: STAKE-STATUS-UNSTAKED,
        rewards-claimed: (+ (get rewards-claimed stake) net-rewards),
        last-claim-block: stacks-block-height
      })
    )

    ;; Remove credit lock
    (map-delete credit-staked (get credit-id stake))

    ;; Update global counters
    (var-set total-staked-credits (- (var-get total-staked-credits) (get quantity stake)))
    (var-set total-active-stakes (- (var-get total-active-stakes) u1))

    (ok {
      quantity: (get quantity stake),
      rewards-paid: net-rewards,
      penalty-amount: penalty
    })
  )
)

;; ============================================================================
;; ADMIN FUNCTIONS
;; ============================================================================

;; Fund the reward treasury -- anyone can deposit STX
;; @param amount: Amount in microSTX to deposit
;; @returns: New treasury balance
(define-public (fund-treasury (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-QUANTITY)
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (var-set treasury-balance (+ (var-get treasury-balance) amount))
    (ok (var-get treasury-balance))
  )
)

;; Update the per-block reward rate (admin only)
;; @param new-rate: New reward rate in microSTX per credit-unit per block
;; @returns: true on success
(define-public (set-reward-rate (new-rate uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> new-rate u0) ERR-INVALID-RATE)
    (var-set reward-rate-per-block new-rate)
    (ok true)
  )
)

;; Pause or resume staking (admin only)
;; @param paused: true to pause, false to resume
;; @returns: true on success
(define-public (set-staking-paused (paused bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set staking-paused paused)
    (ok true)
  )
)
