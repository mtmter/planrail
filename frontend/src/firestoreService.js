import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { serializeJourney } from "./journeySerializer";
import { journeyDocumentId } from "./journeyDocumentId";

function userCollection(uid, collectionName) {
  return collection(db, "users", uid, collectionName);
}

function userDocument(uid, collectionName, documentId) {
  return doc(db, "users", uid, collectionName, String(documentId));
}

function dataWithId(documentSnapshot) {
  return {
    id: documentSnapshot.id,
    ...documentSnapshot.data(),
  };
}

async function getCollectionData(uid, collectionName) {
  const snapshot = await getDocs(userCollection(uid, collectionName));
  return snapshot.docs.map(dataWithId);
}

export async function loadScheduleData(uid) {
  const [events, preparations, journeys] = await Promise.all([
    getCollectionData(uid, "events"),
    getCollectionData(uid, "preparations"),
    getCollectionData(uid, "journeys"),
  ]);

  return { events, preparations, journeys };
}

export async function createEvent(uid, eventData) {
  const documentReference = await addDoc(
    userCollection(uid, "events"),
    eventData,
  );
  return { id: documentReference.id, ...eventData };
}

export async function updateEvent(uid, eventId, eventData) {
  await updateDoc(userDocument(uid, "events", eventId), eventData);
  return { id: String(eventId), ...eventData };
}

export async function deleteEvent(uid, eventId) {
  const preparationsSnapshot = await getDocs(
    query(
      userCollection(uid, "preparations"),
      where("event_id", "==", String(eventId)),
    ),
  );

  // Eventと関連データを同時に消せない件数では、何も削除しない。
  if (preparationsSnapshot.size + 2 > 500) {
    throw new Error("関連する準備項目が多すぎるため、この予定を一括削除できません");
  }
  const batch = writeBatch(db);

  preparationsSnapshot.docs.forEach((preparationDocument) => {
    batch.delete(preparationDocument.ref);
  });
  batch.delete(userDocument(uid, "journeys", `event-${eventId}`));
  batch.delete(userDocument(uid, "events", eventId));
  await batch.commit();
}

export async function createPreparation(uid, eventId, title) {
  const documentData = {
    event_id: String(eventId),
    title,
    completed: false,
  };
  const documentReference = await addDoc(
    userCollection(uid, "preparations"),
    documentData,
  );
  return { id: documentReference.id, ...documentData };
}

export async function updatePreparation(
  uid,
  preparationId,
  preparationData,
) {
  await updateDoc(
    userDocument(uid, "preparations", preparationId),
    preparationData,
  );
  return { id: String(preparationId), ...preparationData };
}

export async function deletePreparation(uid, eventId, preparationId) {
  const preparationDocument = userDocument(
    uid,
    "preparations",
    preparationId,
  );
  const snapshot = await getDoc(preparationDocument);
  if (
    !snapshot.exists() ||
    snapshot.data().event_id !== String(eventId)
  ) {
    throw new Error("準備項目が見つかりません");
  }
  await deleteDoc(preparationDocument);
}

export async function getJourney(uid, journeyId) {
  const snapshot = await getDoc(userDocument(uid, "journeys", journeyId));
  return snapshot.exists() ? dataWithId(snapshot) : null;
}

export async function saveJourney(uid, journey, existingId = null) {
  const documentId = journeyDocumentId(journey, existingId);
  const documentData = serializeJourney(journey);
  const reference = documentId
    ? userDocument(uid, "journeys", documentId)
    : userDocument(uid, "journeys", `standalone-${doc(userCollection(uid, "journeys")).id}`);
  await setDoc(reference, documentData);
  return { id: reference.id, ...documentData };
}

export async function deleteJourney(uid, journeyId) {
  await deleteDoc(userDocument(uid, "journeys", journeyId));
}
