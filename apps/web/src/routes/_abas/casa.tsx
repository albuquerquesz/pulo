import { createFileRoute } from '@tanstack/react-router';

import { FocoScreen } from '@/features/foco/FocoScreen';
import { lerVinculoDaCasa } from '@/features/foco/vinculo';

export const Route = createFileRoute('/_abas/casa')({ validateSearch: lerVinculoDaCasa, component: FocoScreen });
