import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local BEFORE importing any app code!
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { getDashboardStats } from '../src/lib/actions/report.actions';

async function check() {
    try {
        const data = await getDashboardStats(7);
        console.log("Services in reports:", data.allServices.map((s: any) => ({ name: s.name, catName: s.categoryName })));
    } catch (e) {
        console.error("Error calling getDashboardStats:", e);
    }
}
check();
