const admin = require("firebase-admin");
const { setGlobalOptions } = require("firebase-functions/v2");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const { getUserDisplayName } = require("./coupleUsers");

admin.initializeApp();
setGlobalOptions({ maxInstances: 10 });

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
