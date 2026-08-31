const admin = require("firebase-admin");
const { setGlobalOptions } = require("firebase-functions/v2");
const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten
} = require("firebase-functions/v2/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { getUserDisplayName } = require("./coupleUsers");

admin.initializeApp();
setGlobalOptions({ maxInstances: 10 });

const allowedUserIds = [
  "xLUPD71OGYfG4NByDz0buh8ZIsy2",
  "orPQHip5ooOtfSSkyLYhl5hx9Kg1"
];
const SPECIAL_19TH_EVENT_ID = "2026-08-19";
const SPECIAL_19TH_COUPLE_ID = "yushef";
const SPECIAL_19TH_EVENT_START_MS = Date.parse("2026-08-19T00:00:00+03:00");
const SPECIAL_19TH_PRESENCE_THRESHOLD_MS = 60 * 1000;
const SPECIAL_19TH_REVEAL_SECONDS = 3;
const SPECIAL_19TH_MEMORY_ID = `special-19th-${SPECIAL_19TH_EVENT_ID}`;
const APOLOGY_COUPLE_ID = "yushef";
const APOLOGY_LETTER_ID = "apology-shosho-2026-08-31";
const APOLOGY_SENDER_UID = "orPQHip5ooOtfSSkyLYhl5hx9Kg1";
const APOLOGY_RECIPIENT_UID = "xLUPD71OGYfG4NByDz0buh8ZIsy2";
const APOLOGY_TITLE = "For Shosho — I’m Sorry";
const APOLOGY_DELIVERY_ID = `${APOLOGY_LETTER_ID}-published`;

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

exports.sendTheaterReadyNotification = onDocumentUpdated(
  "couples/{coupleId}/theaterSession/{sessionId}",
  async (event) => {
    const { coupleId, sessionId } = event.params;
    const sessionPath = `couples/${coupleId}/theaterSession/${sessionId}`;

    try {
      if (!event.data) {
        logger.warn("Theater session update data is missing.", {
          coupleId,
          sessionId,
          sessionPath
        });
        return;
      }

      const beforeReadyUsers = event.data.before.data()?.readyUsers || {};
      const afterReadyUsers = event.data.after.data()?.readyUsers || {};
      const newlyReadyUserIds = allowedUserIds.filter(
        (uid) => !Boolean(beforeReadyUsers[uid]?.ready) && Boolean(afterReadyUsers[uid]?.ready)
      );

      if (newlyReadyUserIds.length === 0) {
        return;
      }

      for (const readyUid of newlyReadyUserIds) {
        const recipientUid = allowedUserIds.find((uid) => uid !== readyUid);
        const readyName = getUserDisplayName(readyUid);

        if (!recipientUid) {
          logger.warn("Theater-ready notification recipient could not be resolved.", {
            coupleId,
            sessionId,
            sessionPath,
            readyUid
          });
          continue;
        }

        const eventId = String(event.id || `${sessionId}-${readyUid}`).replace(/\//g, "_");
        const deliveryRef = admin
          .firestore()
          .collection("couples")
          .doc(coupleId)
          .collection("notificationDeliveries")
          .doc(`${eventId}-${readyUid}`);

        try {
          await deliveryRef.create({
            type: "theater_ready",
            readyUid,
            recipientUid,
            sessionPath,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } catch (error) {
          const isDuplicate =
            error?.code === 6 ||
            error?.code === "already-exists" ||
            error?.code === "firestore/already-exists";

          if (isDuplicate) {
            logger.info("Duplicate Theater-ready event skipped.", {
              coupleId,
              sessionId,
              sessionPath,
              readyUid,
              recipientUid
            });
            continue;
          }

          throw error;
        }

        const tokensSnapshot = await admin
          .firestore()
          .collection("couples")
          .doc(coupleId)
          .collection("notificationTokens")
          .doc(recipientUid)
          .collection("tokens")
          .get();

        const tokenEntries = tokensSnapshot.docs
          .map((tokenDoc) => ({
            ref: tokenDoc.ref,
            token: tokenDoc.data().token
          }))
          .filter((entry) => typeof entry.token === "string" && entry.token.trim().length > 0);
        const tokens = tokenEntries.map((entry) => entry.token.trim());

        if (tokens.length === 0) {
          await deliveryRef.update({
            status: "no_tokens",
            completedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          logger.info("No notification tokens found for Theater-ready recipient.", {
            coupleId,
            sessionId,
            sessionPath,
            readyUid,
            recipientUid
          });
          continue;
        }

        const response = await admin.messaging().sendEachForMulticast({
          tokens,
          notification: {
            title: `${readyName} is ready 🍿`,
            body: "Your movie date is waiting in Yushef Theater 💗"
          },
          data: {
            type: "theater_ready",
            coupleId: String(coupleId),
            sessionId: String(sessionId),
            readyUid: String(readyUid),
            readyName: String(readyName)
          }
        });

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
        }

        await deliveryRef.update({
          status: response.successCount > 0 ? "sent" : "failed",
          successCount: response.successCount,
          failureCount: response.failureCount,
          invalidTokenCount: invalidTokenRefs.length,
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        logger.info("Theater-ready notification processed.", {
          coupleId,
          sessionId,
          sessionPath,
          readyUid,
          readyName,
          recipientUid,
          successCount: response.successCount,
          failureCount: response.failureCount,
          invalidTokenCount: invalidTokenRefs.length
        });
      }
    } catch (error) {
      logger.error("Failed to process Theater-ready notification.", {
        coupleId,
        sessionId,
        sessionPath,
        error
      });
    }
  }
);

exports.sealSpecial19thPackage = onCall(async (request) => {
  const uid = request.auth && request.auth.uid;
  const { coupleId, eventId } = request.data || {};

  assertSpecial19thCaller(uid, coupleId, eventId);

  const db = admin.firestore();
  const eventRef = getSpecial19thEventRef(db, coupleId, eventId);
  const packageRef = eventRef.collection("packages").doc(uid);
  const partnerUid = getPartnerUid(uid);
  const partnerPackageRef = eventRef.collection("packages").doc(partnerUid);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const eventSnapshot = await transaction.get(eventRef);
      const packageSnapshot = await transaction.get(packageRef);
      const partnerPackageSnapshot = await transaction.get(partnerPackageRef);

      if (!eventSnapshot.exists) {
        throw new HttpsError("not-found", "The special 19th event has not been prepared yet.");
      }

      if (!packageSnapshot.exists) {
        throw new HttpsError("failed-precondition", "Save your package before sealing it.");
      }

      const eventData = eventSnapshot.data() || {};
      const packageData = packageSnapshot.data() || {};
      const partnerPackage = partnerPackageSnapshot.data() || {};

      if (packageData.ownerUid !== uid) {
        throw new HttpsError("permission-denied", "This package does not belong to you.");
      }

      if (packageData.sealed === true) {
        return {
          sealed: true,
          bothSealed: partnerPackage.sealed === true
        };
      }

      if (eventData.revealAt) {
        throw new HttpsError("failed-precondition", "The reveal has already started.");
      }

      validateCompleteSpecial19thPackage(packageData, coupleId, eventId, uid);

      const now = admin.firestore.Timestamp.now();
      const packageStatus = {
        ownerName: getUserDisplayName(uid),
        sealed: true,
        sealedAt: now
      };

      transaction.update(packageRef, {
        sealed: true,
        sealedAt: now,
        updatedAt: now
      });
      transaction.update(eventRef, {
        [`packageStatuses.${uid}`]: packageStatus,
        updatedAt: now
      });

      return {
        sealed: true,
        bothSealed: partnerPackage.sealed === true
      };
    });

    logger.info("Special 19th package sealed.", {
      coupleId,
      eventId,
      uid,
      bothSealed: result.bothSealed
    });

    return result;
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }

    logger.error("Failed to seal Special 19th package.", {
      coupleId,
      eventId,
      uid,
      error
    });
    throw new HttpsError("internal", "Your package couldn't be sealed yet.");
  }
});

exports.startSpecial19thReveal = onCall(async (request) => {
  const uid = request.auth && request.auth.uid;
  const { coupleId, eventId } = request.data || {};

  assertSpecial19thCaller(uid, coupleId, eventId);

  const db = admin.firestore();
  const eventRef = getSpecial19thEventRef(db, coupleId, eventId);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const eventSnapshot = await transaction.get(eventRef);

      if (!eventSnapshot.exists) {
        throw new HttpsError("not-found", "The special 19th event was not found.");
      }

      const eventData = eventSnapshot.data() || {};

      if (isFirestoreTimestamp(eventData.revealAt)) {
        return {
          revealAtMs: eventData.revealAt.toMillis(),
          alreadyStarted: true
        };
      }

      const now = admin.firestore.Timestamp.now();
      const nowMs = now.toMillis();

      if (nowMs < SPECIAL_19TH_EVENT_START_MS) {
        throw new HttpsError(
          "failed-precondition",
          "The special 19th cannot be opened before 19 August in Cairo."
        );
      }

      const packageRefs = allowedUserIds.map((userId) =>
        eventRef.collection("packages").doc(userId)
      );
      const presenceRefs = allowedUserIds.map((userId) =>
        eventRef.collection("presence").doc(userId)
      );
      const packageSnapshots = [];
      const presenceSnapshots = [];

      for (const packageRef of packageRefs) {
        packageSnapshots.push(await transaction.get(packageRef));
      }

      for (const presenceRef of presenceRefs) {
        presenceSnapshots.push(await transaction.get(presenceRef));
      }

      const allPackagesSealed = packageSnapshots.every(
        (snapshot) => snapshot.exists && snapshot.data()?.sealed === true
      );

      if (!allPackagesSealed) {
        throw new HttpsError(
          "failed-precondition",
          "Both 19th packages must be sealed before opening."
        );
      }

      const bothPresent = presenceSnapshots.every((snapshot) => {
        const data = snapshot.data() || {};
        const lastSeenAtMs = isFirestoreTimestamp(data.lastSeenAt)
          ? data.lastSeenAt.toMillis()
          : 0;

        return (
          snapshot.exists &&
          data.online === true &&
          lastSeenAtMs > 0 &&
          nowMs - lastSeenAtMs <= SPECIAL_19TH_PRESENCE_THRESHOLD_MS &&
          lastSeenAtMs - nowMs < 10_000
        );
      });

      if (!bothPresent) {
        throw new HttpsError(
          "failed-precondition",
          "Both people must be present. It looks like someone stepped away."
        );
      }

      const revealAt = admin.firestore.Timestamp.fromMillis(
        nowMs + SPECIAL_19TH_REVEAL_SECONDS * 1000
      );

      transaction.update(eventRef, {
        revealStartedAt: now,
        revealAt,
        revealStartedByUid: uid,
        updatedAt: now
      });

      return {
        revealAtMs: revealAt.toMillis(),
        alreadyStarted: false
      };
    });

    logger.info("Special 19th synchronized reveal started.", {
      coupleId,
      eventId,
      uid,
      revealAtMs: result.revealAtMs,
      alreadyStarted: result.alreadyStarted
    });

    return result;
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }

    logger.error("Failed to start Special 19th reveal.", {
      coupleId,
      eventId,
      uid,
      error
    });
    throw new HttpsError("internal", "Our shared reveal couldn't start yet.");
  }
});

exports.sendSpecial19thPackageNotification = onDocumentUpdated(
  "couples/{coupleId}/special19ths/{eventId}/packages/{ownerUid}",
  async (event) => {
    const { coupleId, eventId, ownerUid } = event.params;

    if (
      coupleId !== SPECIAL_19TH_COUPLE_ID ||
      eventId !== SPECIAL_19TH_EVENT_ID ||
      !allowedUserIds.includes(ownerUid) ||
      !event.data
    ) {
      return;
    }

    const beforeSealed = event.data.before.data()?.sealed === true;
    const afterSealed = event.data.after.data()?.sealed === true;

    if (beforeSealed || !afterSealed) {
      return;
    }

    const recipientUid = getPartnerUid(ownerUid);
    const ownerName = getUserDisplayName(ownerUid);
    const db = admin.firestore();
    const eventRef = getSpecial19thEventRef(db, coupleId, eventId);
    const deliveryRef = db
      .collection("couples")
      .doc(coupleId)
      .collection("notificationDeliveries")
      .doc(`special19th-${eventId}-sealed-${ownerUid}`);

    try {
      try {
        await deliveryRef.create({
          type: "special_19th_package_sealed",
          eventId,
          ownerUid,
          recipientUid,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (error) {
        if (isAlreadyExistsError(error)) {
          logger.info("Duplicate Special 19th package notification skipped.", {
            coupleId,
            eventId,
            ownerUid,
            recipientUid
          });
          return;
        }

        throw error;
      }

      const eventSnapshot = await eventRef.get();
      const statuses = eventSnapshot.data()?.packageStatuses || {};
      const bothReady = allowedUserIds.every((userId) => statuses[userId]?.sealed === true);
      const title = bothReady
        ? "Our 19th is ready 💗"
        : `${ownerName} sealed something for you 💌`;
      const body = bothReady
        ? "Both surprises are sealed and waiting for us."
        : "No peeking until our 19th 👀💗";
      const delivery = await sendNotificationToUser({
        coupleId,
        recipientUid,
        title,
        body,
        data: {
          type: "special_19th",
          subtype: bothReady ? "both_ready" : "package_sealed",
          coupleId,
          eventId,
          fromUid: ownerUid,
          fromName: ownerName,
          message: body,
          url: "/special-19th"
        }
      });

      await deliveryRef.update({
        status: delivery.successCount > 0 ? "sent" : delivery.tokenCount > 0 ? "failed" : "no_tokens",
        successCount: delivery.successCount,
        failureCount: delivery.failureCount,
        invalidTokenCount: delivery.invalidTokenCount,
        completedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.info("Special 19th package notification processed.", {
        coupleId,
        eventId,
        ownerUid,
        recipientUid,
        bothReady,
        ...delivery
      });
    } catch (error) {
      logger.error("Failed to process Special 19th package notification.", {
        coupleId,
        eventId,
        ownerUid,
        recipientUid,
        error
      });
    }
  }
);

exports.finalizeSpecial19thMemory = onDocumentWritten(
  {
    document: "couples/{coupleId}/special19ths/{eventId}/momentPhotos/{uid}",
    retry: true
  },
  async (event) => {
    const { coupleId, eventId, uid } = event.params;

    if (
      coupleId !== SPECIAL_19TH_COUPLE_ID ||
      eventId !== SPECIAL_19TH_EVENT_ID ||
      !allowedUserIds.includes(uid) ||
      !event.data?.after.exists
    ) {
      return;
    }

    const db = admin.firestore();
    const eventRef = getSpecial19thEventRef(db, coupleId, eventId);
    const memoryRef = db
      .collection("couples")
      .doc(coupleId)
      .collection("monthversaries")
      .doc(SPECIAL_19TH_MEMORY_ID);

    try {
      const result = await db.runTransaction(async (transaction) => {
        const eventSnapshot = await transaction.get(eventRef);
        const momentRefs = allowedUserIds.map((userId) =>
          eventRef.collection("momentPhotos").doc(userId)
        );
        const momentSnapshots = [];

        for (const momentRef of momentRefs) {
          momentSnapshots.push(await transaction.get(momentRef));
        }

        const memorySnapshot = await transaction.get(memoryRef);

        if (!eventSnapshot.exists) {
          return { created: false, reason: "event_missing" };
        }

        const eventData = eventSnapshot.data() || {};

        if (eventData.memoryCreated === true) {
          return { created: false, reason: "already_created" };
        }

        if (
          !isFirestoreTimestamp(eventData.revealAt) ||
          eventData.revealAt.toMillis() > Date.now()
        ) {
          return { created: false, reason: "not_revealed" };
        }

        if (momentSnapshots.some((snapshot) => !snapshot.exists)) {
          return { created: false, reason: "waiting_for_both_photos" };
        }

        const momentDataByUid = Object.fromEntries(
          momentSnapshots.map((snapshot, index) => [
            allowedUserIds[index],
            snapshot.data() || {}
          ])
        );

        for (const userId of allowedUserIds) {
          validateSpecial19thMoment(momentDataByUid[userId], coupleId, eventId, userId);
        }

        const now = admin.firestore.Timestamp.now();
        const photoOrder = [
          "orPQHip5ooOtfSSkyLYhl5hx9Kg1",
          "xLUPD71OGYfG4NByDz0buh8ZIsy2"
        ];
        const photos = photoOrder.map((userId) => {
          const moment = momentDataByUid[userId];
          const uploadedAt = isFirestoreTimestamp(moment.submittedAt)
            ? moment.submittedAt.toDate().toISOString()
            : now.toDate().toISOString();

          return {
            id: `special19-${userId}`,
            url: moment.url,
            storagePath: moment.storagePath,
            fileName: moment.fileName,
            uploadedBy: userId,
            uploadedAt
          };
        });

        if (!memorySnapshot.exists) {
          transaction.set(memoryRef, {
            id: SPECIAL_19TH_MEMORY_ID,
            monthNumber: 17,
            date: SPECIAL_19TH_EVENT_ID,
            title: "Our First 19th Apart 💗",
            description: "Same 19th. Different places. 💗",
            photos,
            createdBy: "special-19th-system",
            createdAt: now,
            updatedAt: now
          });
        }

        transaction.update(eventRef, {
          memoryCreated: true,
          memoryId: SPECIAL_19TH_MEMORY_ID,
          updatedAt: now
        });

        return {
          created: !memorySnapshot.exists,
          reason: memorySnapshot.exists ? "existing_memory_linked" : "created"
        };
      });

      logger.info("Special 19th permanent memory finalized.", {
        coupleId,
        eventId,
        memoryId: SPECIAL_19TH_MEMORY_ID,
        ...result
      });
    } catch (error) {
      logger.error("Failed to finalize Special 19th permanent memory.", {
        coupleId,
        eventId,
        uid,
        memoryId: SPECIAL_19TH_MEMORY_ID,
        error
      });
      throw error;
    }
  }
);

exports.publishApologyLetter = onCall(async (request) => {
  const uid = request.auth && request.auth.uid;
  const { coupleId, letterId } = request.data || {};

  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in before sealing this letter.");
  }

  if (uid !== APOLOGY_SENDER_UID) {
    throw new HttpsError("permission-denied", "Only Yuyu can seal this letter.");
  }

  if (coupleId !== APOLOGY_COUPLE_ID || letterId !== APOLOGY_LETTER_ID) {
    throw new HttpsError("invalid-argument", "This private letter is not available.");
  }

  const db = admin.firestore();
  const coupleRef = db.collection("couples").doc(coupleId);
  const letterRef = coupleRef.collection("letters").doc(letterId);
  const publicationRef = coupleRef.collection("letterPublications").doc(letterId);
  const deliveryRef = coupleRef
    .collection("notificationDeliveries")
    .doc(APOLOGY_DELIVERY_ID);

  try {
    const publication = await db.runTransaction(async (transaction) => {
      const letterSnapshot = await transaction.get(letterRef);

      if (!letterSnapshot.exists) {
        throw new HttpsError("failed-precondition", "Save your letter before sealing it.");
      }

      const letter = letterSnapshot.data() || {};

      if (letter.status === "published") {
        throw new HttpsError("already-exists", "This letter is already sealed.");
      }

      if (
        letter.id !== APOLOGY_LETTER_ID ||
        letter.type !== "apology" ||
        letter.fromUid !== APOLOGY_SENDER_UID ||
        letter.toUid !== APOLOGY_RECIPIENT_UID ||
        letter.fromName !== "Yuyu" ||
        letter.toName !== "Shosho" ||
        letter.title !== APOLOGY_TITLE
      ) {
        throw new HttpsError("permission-denied", "This letter’s identity is invalid.");
      }

      const content = normalizeApologyLetterContent(letter);
      validateApologyLetterForPublication(content);
      const publishedAt = admin.firestore.Timestamp.now();
      const publicationData = {
        id: APOLOGY_LETTER_ID,
        letterId: APOLOGY_LETTER_ID,
        type: "apology",
        fromUid: APOLOGY_SENDER_UID,
        fromName: "Yuyu",
        toUid: APOLOGY_RECIPIENT_UID,
        toName: "Shosho",
        title: APOLOGY_TITLE,
        publishedAt
      };

      transaction.update(letterRef, {
        ...content,
        status: "published",
        publishedAt,
        updatedAt: publishedAt
      });
      transaction.set(publicationRef, publicationData);
      transaction.create(deliveryRef, {
        type: "apology_letter_published",
        letterId: APOLOGY_LETTER_ID,
        fromUid: APOLOGY_SENDER_UID,
        toUid: APOLOGY_RECIPIENT_UID,
        status: "pending",
        createdAt: publishedAt
      });

      return publicationData;
    });

    let notificationStatus = "failed";
    let notificationSent = false;

    try {
      const title = "Yuyu left you a letter 💌";
      const body = "Open it whenever you’re ready.";
      const delivery = await sendNotificationToUser({
        coupleId,
        recipientUid: APOLOGY_RECIPIENT_UID,
        title,
        body,
        data: {
          type: "apology_letter",
          coupleId,
          letterId,
          fromUid: APOLOGY_SENDER_UID,
          fromName: "Yuyu",
          toUid: APOLOGY_RECIPIENT_UID,
          message: body,
          url: "/for-shosho"
        }
      });

      notificationSent = delivery.successCount > 0;
      notificationStatus =
        delivery.tokenCount === 0
          ? "no_tokens"
          : delivery.successCount === delivery.tokenCount
            ? "sent"
            : delivery.successCount > 0
              ? "partial"
              : "failed";

      await deliveryRef.update({
        status: notificationStatus,
        successCount: delivery.successCount,
        failureCount: delivery.failureCount,
        invalidTokenCount: delivery.invalidTokenCount,
        completedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.info("Apology letter published and notification processed.", {
        coupleId,
        letterId,
        fromUid: APOLOGY_SENDER_UID,
        toUid: APOLOGY_RECIPIENT_UID,
        notificationStatus,
        successCount: delivery.successCount,
        failureCount: delivery.failureCount,
        invalidTokenCount: delivery.invalidTokenCount
      });
    } catch (notificationError) {
      await deliveryRef
        .update({
          status: "failed",
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        })
        .catch(() => undefined);
      logger.error("Apology letter was published, but its notification failed.", {
        coupleId,
        letterId,
        fromUid: APOLOGY_SENDER_UID,
        toUid: APOLOGY_RECIPIENT_UID,
        error: notificationError
      });
    }

    return {
      published: Boolean(publication),
      notificationSent,
      notificationStatus
    };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }

    logger.error("Failed to publish apology letter.", {
      coupleId,
      letterId,
      uid,
      error
    });
    throw new HttpsError("internal", "Your letter couldn’t be sealed yet.");
  }
});

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
  return secret.split("").reduce((total, digit, index) => {
    return total + (guess[index] === digit ? 1 : 0);
  }, 0);
}

function assertSpecial19thCaller(uid, coupleId, eventId) {
  if (!uid || !allowedUserIds.includes(uid)) {
    throw new HttpsError(
      "permission-denied",
      "Only Yuyu and Shosho can use this special 19th."
    );
  }

  if (coupleId !== SPECIAL_19TH_COUPLE_ID || eventId !== SPECIAL_19TH_EVENT_ID) {
    throw new HttpsError("invalid-argument", "This special 19th event is not available.");
  }
}

function getSpecial19thEventRef(db, coupleId, eventId) {
  return db
    .collection("couples")
    .doc(coupleId)
    .collection("special19ths")
    .doc(eventId);
}

function getPartnerUid(uid) {
  return allowedUserIds.find((candidate) => candidate !== uid);
}

function validateCompleteSpecial19thPackage(packageData, coupleId, eventId, uid) {
  const requiredTextFields = ["letter", "wish", "loveThisMonth"];
  const invalidText = requiredTextFields.some(
    (field) =>
      typeof packageData[field] !== "string" || packageData[field].trim().length === 0
  );

  if (invalidText) {
    throw new HttpsError("failed-precondition", "Finish each written part before sealing.");
  }

  const mediaPrefix = `couples/${coupleId}/special19ths/${eventId}/packages/${uid}`;
  const validPhotoPath =
    typeof packageData.photoStoragePath === "string" &&
    packageData.photoStoragePath.startsWith(`${mediaPrefix}/photo/`);
  const validVoicePath =
    typeof packageData.voiceNoteStoragePath === "string" &&
    packageData.voiceNoteStoragePath.startsWith(`${mediaPrefix}/voice/`);

  if (!validPhotoPath || !validVoicePath) {
    throw new HttpsError(
      "failed-precondition",
      "Add both your package photo and voice note before sealing."
    );
  }

  if (
    packageData.letter.length > 10_000 ||
    packageData.wish.length > 2_000 ||
    packageData.loveThisMonth.length > 2_000
  ) {
    throw new HttpsError("invalid-argument", "One of the package messages is too long.");
  }
}

function validateSpecial19thMoment(moment, coupleId, eventId, uid) {
  const expectedPrefix = `couples/${coupleId}/special19ths/${eventId}/momentPhotos/${uid}/`;
  const valid =
    moment.uid === uid &&
    typeof moment.name === "string" &&
    typeof moment.storagePath === "string" &&
    moment.storagePath.startsWith(expectedPrefix) &&
    typeof moment.url === "string" &&
    moment.url.startsWith("https://firebasestorage.googleapis.com/") &&
    typeof moment.fileName === "string" &&
    moment.fileName.length > 0;

  if (!valid) {
    throw new Error(`Invalid Special 19th moment document for ${uid}.`);
  }
}

async function sendNotificationToUser({
  coupleId,
  recipientUid,
  title,
  body,
  data
}) {
  const tokensSnapshot = await admin
    .firestore()
    .collection("couples")
    .doc(coupleId)
    .collection("notificationTokens")
    .doc(recipientUid)
    .collection("tokens")
    .get();
  const tokenEntries = tokensSnapshot.docs
    .map((tokenDoc) => ({
      ref: tokenDoc.ref,
      token: tokenDoc.data().token
    }))
    .filter((entry) => typeof entry.token === "string" && entry.token.trim().length > 0);
  const tokens = tokenEntries.map((entry) => entry.token.trim());

  if (tokens.length === 0) {
    return {
      tokenCount: 0,
      successCount: 0,
      failureCount: 0,
      invalidTokenCount: 0
    };
  }

  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title: String(title),
      body: String(body)
    },
    data: Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, String(value)])
    )
  });
  const invalidTokenRefs = response.responses
    .map((sendResponse, index) => {
      if (sendResponse.success) {
        return null;
      }

      const errorCode = sendResponse.error && sendResponse.error.code;
      const invalid =
        errorCode === "messaging/registration-token-not-registered" ||
        errorCode === "messaging/invalid-registration-token" ||
        errorCode === "messaging/invalid-argument";

      return invalid ? tokenEntries[index].ref : null;
    })
    .filter(Boolean);

  if (invalidTokenRefs.length > 0) {
    await Promise.all(invalidTokenRefs.map((tokenRef) => tokenRef.delete()));
  }

  return {
    tokenCount: tokens.length,
    successCount: response.successCount,
    failureCount: response.failureCount,
    invalidTokenCount: invalidTokenRefs.length
  };
}

function normalizeApologyLetterContent(letter) {
  return {
    apology: typeof letter.apology === "string" ? letter.apology.trim() : "",
    shouldHaveDone:
      typeof letter.shouldHaveDone === "string" ? letter.shouldHaveDone.trim() : "",
    whatImChanging:
      typeof letter.whatImChanging === "string" ? letter.whatImChanging.trim() : "",
    commitments: Array.isArray(letter.commitments)
      ? letter.commitments.map((commitment) =>
          typeof commitment === "string" ? commitment.trim() : ""
        )
      : []
  };
}

function validateApologyLetterForPublication(content) {
  const requiredSections = [
    content.apology,
    content.shouldHaveDone,
    content.whatImChanging
  ];

  if (requiredSections.some((section) => section.length < 3)) {
    throw new HttpsError(
      "failed-precondition",
      "Finish each written part before sealing the letter."
    );
  }

  if (
    content.apology.length > 12_000 ||
    content.shouldHaveDone.length > 8_000 ||
    content.whatImChanging.length > 8_000
  ) {
    throw new HttpsError("invalid-argument", "One of the letter sections is too long.");
  }

  if (
    content.commitments.length < 1 ||
    content.commitments.length > 6 ||
    content.commitments.some(
      (commitment) => commitment.length < 3 || commitment.length > 500
    )
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Add between one and six clear commitments before sealing."
    );
  }
}

function isFirestoreTimestamp(value) {
  return value && typeof value.toMillis === "function";
}

function isAlreadyExistsError(error) {
  return (
    error?.code === 6 ||
    error?.code === "already-exists" ||
    error?.code === "firestore/already-exists"
  );
}
