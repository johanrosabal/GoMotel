'use server';

import { collection, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Room } from "@/types";

export async function getRoomStatuses(): Promise<Record<string, string>> {
  try {
    const roomsCollection = collection(db, "rooms");
    const q = query(roomsCollection);
    const roomsSnapshot = await getDocs(q);
    
    const roomStatuses: Record<string, string> = {};
    roomsSnapshot.docs.forEach(doc => {
        const room = doc.data() as Omit<Room, 'id'>;
        roomStatuses[room.number] = room.status;
    });

    return roomStatuses;
  } catch (error) {
    console.error("Error fetching room statuses:", error);
    return {};
  }
}
