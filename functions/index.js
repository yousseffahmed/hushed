const admin = require("firebase-admin");
const { setGlobalOptions } = require("firebase-functions/v2");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { getUserDisplayName } = require("./coupleUsers");

admin.initializeApp();
setGlobalOptions({ maxInstances: 10 });

const allowedUserIds = [
  "xLUPD71OGYfG4NByDz0buh8ZIsy2",
  "orPQHip5ooOtfSSkyLYhl5hx9Kg1"
];

exports.sendNudgeNotification = onDocumentCreated(
  "couples/{coupleId}/nudges/{nudgeId}",
  async (event) => {
    const { coupleId, nudgeId } = event.params;
    const functionStartMs = Date.now();

    try {
      if (!event.data) {
        logger.warn("Nudge snapshot data is missing.", { coupleId, nudgeId });
        return;
      }

      const nudge = event.data.data();

      if (!nudge) {
        logger.warn("Nudge data is missing.", { coupleId, nudgeId });
        return;
      }

      const fromUid = nudge.fromUid || nudge.fromUserId;
      const toUid = nudge.toUid || nudge.toUserId;
      const message = nudge.message || "You received a nudge ❤️";
      const fromName = getUserDisplayName(fromUid);
      const clientCreatedAtMs =
        typeof nudge.clientCreatedAtMs === "number" ? nudge.clientCreatedAtMs : null;
      const firestoreCreatedAtMs =
        nudge.createdAt && typeof nudge.createdAt.toMillis === "function"
          ? nudge.createdAt.toMillis()
          : null;

      if (!fromUid || !toUid) {
        logger.warn("Nudge sender or receiver is missing.", {
          coupleId,
          nudgeId,
          fromUid: fromUid || null,
          toUid: toUid || null
        });
        return;
      }

      logger.info("Nudge notification function started.", {
        coupleId,
        nudgeId,
        toUid,
        clientToFunctionDelayMs: clientCreatedAtMs ? functionStartMs - clientCreatedAtMs : null,
        firestoreToFunctionDelayMs: firestoreCreatedAtMs
          ? functionStartMs - firestoreCreatedAtMs
          : null
      });

      const tokenQueryStartMs = Date.now();
      const tokensSnapshot = await admin
        .firestore()
        .collection("couples")
        .doc(coupleId)
        .collection("notificationTokens")
        .doc(toUid)
        .collection("tokens")
        .get();
      const tokenQueryDurationMs = Date.now() - tokenQueryStartMs;

      if (tokensSnapshot.empty) {
        logger.info("No notification tokens found for receiver.", {
          coupleId,
          nudgeId,
          toUid,
          tokenQueryDurationMs,
          totalDurationMs: Date.now() - functionStartMs
        });
        return;
      }

      const tokenEntries = tokensSnapshot.docs
        .map((tokenDoc) => ({
          ref: tokenDoc.ref,
          token: tokenDoc.data().token
        }))
        .filter((entry) => typeof entry.token === "string" && entry.token.trim().length > 0);
      const tokens = tokenEntries.map((entry) => entry.token.trim());

      if (tokens.length === 0) {
        logger.info("Token documents exist, but no valid token values found.", {
          coupleId,
          nudgeId,
          toUid,
          tokenDocumentCount: tokensSnapshot.size,
          tokenQueryDurationMs,
          totalDurationMs: Date.now() - functionStartMs
        });
        return;
      }

      const fcmSendStartMs = Date.now();
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title: `${fromName} ❤️`,
          body: String(message)
        },
        data: {
          type: "nudge",
          coupleId: String(coupleId),
          nudgeId: String(nudgeId),
          fromUid: String(fromUid),
          fromName: String(fromName),
          message: String(message)
        }
      });
      const fcmSendDurationMs = Date.now() - fcmSendStartMs;

      const invalidTokenRefs = response.responses
        .map((sendResponse, index) => {
          if (sendResponse.success) {
            return null;
          }

          const errorCode = sendResponse.error && sendResponse.error.code;
          const isInvalidToken =
            errorCode === "messaging/registration-token-not-registered" ||
            errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/invalid-argument";

          return isInvalidToken ? tokenEntries[index].ref : null;
        })
        .filter(Boolean);

      if (invalidTokenRefs.length > 0) {
        await Promise.all(invalidTokenRefs.map((tokenRef) => tokenRef.delete()));
        logger.info("Invalid notification tokens deleted.", {
          coupleId,
          nudgeId,
          toUid,
          deletedCount: invalidTokenRefs.length
        });
      }

      await event.data.ref.update({
        delivered: response.successCount > 0,
        notificationSentAt: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.info("Nudge notification sent.", {
        coupleId,
        nudgeId,
        fromUid,
        fromName,
        toUid,
        successCount: response.successCount,
        failureCount: response.failureCount,
        tokenCount: tokens.length,
        tokenQueryDurationMs,
        fcmSendDurationMs,
        totalDurationMs: Date.now() - functionStartMs,
        clientToFunctionDelayMs: clientCreatedAtMs ? functionStartMs - clientCreatedAtMs : null,
        firestoreToFunctionDelayMs: firestoreCreatedAtMs
          ? functionStartMs - firestoreCreatedAtMs
          : null
      });
    } catch (error) {
      logger.error("Failed to send nudge notification.", {
        coupleId,
        nudgeId,
        totalDurationMs: Date.now() - functionStartMs,
        error
      });
    }
  }
);

exports.submitNumberGuess = onCall(async (request) => {
  const functionStartMs = Date.now();
  const uid = request.auth && request.auth.uid;
  const { coupleId, roundId, guess } = request.data || {};

  if (!uid || !allowedUserIds.includes(uid)) {
    throw new HttpsError("permission-denied", "Only the two yushef players can submit guesses.");
  }

  if (coupleId !== "yushef" || typeof roundId !== "string" || !roundId) {
    throw new HttpsError("invalid-argument", "Missing game round.");
  }

  if (!isFourDigitNumber(guess)) {
    throw new HttpsError("invalid-argument", "Guess must be exactly 4 digits.");
  }

  const db = admin.firestore();
  const roundRef = db
    .collection("couples")
    .doc(coupleId)
    .collection("games")
    .doc("numberGuessDuel")
    .collection("rounds")
    .doc(roundId);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const roundSnapshot = await transaction.get(roundRef);

      if (!roundSnapshot.exists) {
        throw new HttpsError("not-found", "Round not found.");
      }

      const round = roundSnapshot.data();

      if (!round || round.status !== "in_progress") {
        throw new HttpsError("failed-precondition", "This round is not ready for guesses.");
      }

      if (round.currentTurnUid !== uid) {
        throw new HttpsError("failed-precondition", "It is not your turn yet.");
      }

      const players = round.players || {};
      const opponentUid = allowedUserIds.find((playerUid) => playerUid !== uid);

      if (!opponentUid || !players[uid] || !players[opponentUid]) {
        throw new HttpsError("failed-precondition", "Both players must join first.");
      }

      if (!players[uid].ready || !players[opponentUid].ready) {
        throw new HttpsError("failed-precondition", "Both players must lock their secrets first.");
      }

      const opponentSecretRef = roundRef.collection("secrets").doc(opponentUid);
      const opponentSecretSnapshot = await transaction.get(opponentSecretRef);
      const secretNumber = opponentSecretSnapshot.data() && opponentSecretSnapshot.data().secretNumber;

      if (!opponentSecretSnapshot.exists || !isFourDigitNumber(secretNumber)) {
        throw new HttpsError("failed-precondition", "Opponent secret is not ready.");
      }

      const rightCount = calculateRightCount(secretNumber, guess);
      const isWinningGuess = rightCount === 4;
      const previousAttempts =
        players[uid] && typeof players[uid].attempts === "number" ? players[uid].attempts : 0;
      const attemptNumber = previousAttempts + 1;
      const opponentAttempts =
        players[opponentUid] && typeof players[opponentUid].attempts === "number"
          ? players[opponentUid].attempts
          : 0;
      const scoresRef = db
        .collection("couples")
        .doc(coupleId)
        .collection("games")
        .doc("numberGuessDuel")
        .collection("scores");
      const winnerScoreRef = scoresRef.doc(uid);
      const winnerScoreSnapshot = isWinningGuess ? await transaction.get(winnerScoreRef) : null;
      const previousBest =
        winnerScoreSnapshot &&
        winnerScoreSnapshot.exists &&
        typeof winnerScoreSnapshot.data().bestWinAttempts === "number"
          ? winnerScoreSnapshot.data().bestWinAttempts
          : null;
      const guessRef = roundRef.collection("guesses").doc();
      const guessedByName = getUserDisplayName(uid);
      const targetName = getUserDisplayName(opponentUid);

      transaction.set(guessRef, {
        id: guessRef.id,
        guessedByUid: uid,
        guessedByName,
        targetUid: opponentUid,
        targetName,
        guess,
        rightCount,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        attemptNumber,
        isWinningGuess
      });

      const roundUpdate = {
        [`players.${uid}.attempts`]: attemptNumber,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (isWinningGuess) {
        roundUpdate.status = "finished";
        roundUpdate.winnerUid = uid;
        roundUpdate.winnerName = guessedByName;
        roundUpdate.currentTurnUid = "";
        roundUpdate.scoreAwarded = true;
        updateScoreDocs(
          transaction,
          coupleId,
          uid,
          opponentUid,
          attemptNumber,
          opponentAttempts,
          previousBest
        );
      } else {
        roundUpdate.currentTurnUid = opponentUid;
      }

      transaction.update(roundRef, roundUpdate);

      return {
        rightCount,
        isWinningGuess,
        nextTurnUid: isWinningGuess ? "" : opponentUid
      };
    });

    logger.info("Number Guess Duel guess submitted.", {
      coupleId,
      roundId,
      uid,
      rightCount: result.rightCount,
      isWinningGuess: result.isWinningGuess,
      totalDurationMs: Date.now() - functionStartMs
    });

    return result;
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }

    logger.error("Failed to submit Number Guess Duel guess.", {
      coupleId,
      roundId,
      uid,
      error,
      totalDurationMs: Date.now() - functionStartMs
    });
    throw new HttpsError("internal", "Could not submit the guess. Try again.");
  }
});

function updateScoreDocs(
  transaction,
  coupleId,
  winnerUid,
  loserUid,
  winnerAttempts,
  loserAttempts,
  previousBest
) {
  const db = admin.firestore();
  const scoresRef = db
    .collection("couples")
    .doc(coupleId)
    .collection("games")
    .doc("numberGuessDuel")
    .collection("scores");
  const winnerScoreRef = scoresRef.doc(winnerUid);
  const loserScoreRef = scoresRef.doc(loserUid);

  transaction.set(
    winnerScoreRef,
    {
      uid: winnerUid,
      name: getUserDisplayName(winnerUid),
      wins: admin.firestore.FieldValue.increment(1),
      losses: admin.firestore.FieldValue.increment(0),
      roundsPlayed: admin.firestore.FieldValue.increment(1),
      totalGuesses: admin.firestore.FieldValue.increment(winnerAttempts),
      bestWinAttempts:
        typeof previousBest === "number" ? Math.min(previousBest, winnerAttempts) : winnerAttempts,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );
  transaction.set(
    loserScoreRef,
    {
      uid: loserUid,
      name: getUserDisplayName(loserUid),
      wins: admin.firestore.FieldValue.increment(0),
      losses: admin.firestore.FieldValue.increment(1),
      roundsPlayed: admin.firestore.FieldValue.increment(1),
      totalGuesses: admin.firestore.FieldValue.increment(loserAttempts),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}

function isFourDigitNumber(value) {
  return typeof value === "string" && /^\d{4}$/.test(value);
}

function calculateRightCount(secret, guess) {
  const secretCounts = Array(10).fill(0);
  const guessCounts = Array(10).fill(0);

  for (const digit of secret) {
    secretCounts[Number(digit)] += 1;
  }

  for (const digit of guess) {
    guessCounts[Number(digit)] += 1;
  }

  return secretCounts.reduce(
    (total, secretCount, digit) => total + Math.min(secretCount, guessCounts[digit]),
    0
  );
}
