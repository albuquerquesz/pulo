import { createFileRoute } from '@tanstack/react-router';

import { HojeScreen } from '@/features/hoje/HojeScreen';

export const Route = createFileRoute('/_abas/')({ component: HojeScreen });
