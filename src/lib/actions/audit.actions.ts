
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export type CancellationAudit = {
    orderId: string;
    serviceId: string;
    serviceName: string;
    quantity: number;
    previousStatus: string;
    reason: string;
    notes?: string;
    locationLabel: string;
    area: 'Kitchen' | 'Bar' | 'Other';
    timestamp: any;
};

export async function logCancellationAudit(data: Omit<CancellationAudit, 'timestamp'>) {
    try {
        await addDoc(collection(db, 'cancellationAudit'), {
            ...data,
            timestamp: serverTimestamp(),
        });
        return { success: true };
    } catch (error) {
        console.error("Error logging cancellation audit:", error);
        return { error: "No se pudo registrar la auditoría." };
    }
}
