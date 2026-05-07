
import { db } from './src/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

async function checkGhostOrders() {
    console.log("Checking for ghost orders for HAB.001...");
    const q = query(collection(db, 'orders'), where('locationLabel', '==', 'HAB.001'));
    const snap = await getDocs(q);
    
    snap.forEach(doc => {
        const data = doc.data();
        console.log(`Order ID: ${doc.id}`);
        console.log(`Status: ${data.status}`);
        console.log(`Payment Status: ${data.paymentStatus}`);
        console.log(`Items: ${data.items.length}`);
        console.log(`CreatedAt: ${data.createdAt.toDate()}`);
        console.log("-------------------");
    });
}

checkGhostOrders();
