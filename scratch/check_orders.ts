
import { db } from './src/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

async function checkOrders() {
  const q = query(collection(db, 'orders'), where('stayId', '==', 'uGp4vMP8Deji6UhMdjJr'));
  const snap = await getDocs(q);
  snap.forEach(doc => {
    console.log('Order ID:', doc.id);
    console.log('Total:', doc.data().total);
    console.log('Items:', JSON.stringify(doc.data().items, null, 2));
  });
}

checkOrders();
