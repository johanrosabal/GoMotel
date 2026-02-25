import { config } from 'dotenv';
config();

import '@/ai/flows/realtime-order-status-updates.ts';
import '@/ai/flows/realtime-inventory-updates.ts';
import '@/ai/flows/realtime-room-availability-updates.ts';
import '@/ai/flows/performance-analysis.ts';
