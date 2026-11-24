import { createFileRoute } from '@tanstack/react-router';

import { IlhaScreen } from '@/features/ilha/IlhaScreen';

export const Route = createFileRoute('/_abas/ilha')({ component: IlhaScreen });
