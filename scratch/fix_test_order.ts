
import { db } from '../src/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

async function fixOrder() {
  const stayId = 'uGp4vMP8Deji6UhMdjJr';
  const q = query(collection(db, 'orders'), where('stayId', '==', stayId));
  const snap = await getDocs(q);
  
  for (const orderDoc of snap.docs) {
    const data = orderDoc.data();
    if (data.total === 3690) {
      console.log('Fixing order:', orderDoc.id);
      
      const total = 3000;
      const subtotal = 2439.02; // Roughly 3000 / 1.23
      const taxes = [
        { taxId: 'iva_id', name: 'IVA', percentage: 13, amount: 325.20 }, // 2439.02 * 0.13
        { taxId: 'service_id', name: 'Servicio 10%', percentage: 10, amount: 235.78 } // 2439.02 * 0.10
      ];
      
      await updateDoc(doc(db, 'orders', orderDoc.id), {
        total,
        subtotal,
        taxes
      });
      console.log('Order fixed!');
    }
  }
}

fixOrder().catch(console.error);
